import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Award as AwardIcon, Plus, Pencil, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { ACCESS_LEVELS, hasAccess } from '@/lib/accessLevels';
import AwardFormDialog from '@/components/awards/AwardFormDialog';

export default function Awards() {
  const { personnel: me } = usePersonnel();
  const queryClient = useQueryClient();
  const canManage = hasAccess(me?.AccessLevel ?? 0, ACCESS_LEVELS.DET_2IC);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAward, setEditingAward] = useState(null);

  const { data: awards = [], isLoading } = useQuery({
    queryKey: ['awards-all'],
    queryFn: () => base44.entities.Award.filter({}),
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const personnelMap = useMemo(() => {
    const m = {};
    personnel.forEach(p => { m[p.PNumber] = p; });
    return m;
  }, [personnel]);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Award.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['awards-all'] });
      toast.success('Award deleted');
    },
    onError: (err) => toast.error(err.message),
  });

  const sortedAwards = useMemo(
    () => [...awards].sort((a, b) => (b.DateAwarded || '').localeCompare(a.DateAwarded || '')),
    [awards]
  );

  function openAdd() {
    setEditingAward(null);
    setDialogOpen(true);
  }

  function openEdit(award) {
    setEditingAward(award);
    setDialogOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Awards"
        description="Awards achieved by cadets and adult instructors"
        icon={AwardIcon}
        actions={canManage && (
          <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1.5" />Add Award</Button>
        )}
      />

      {isLoading ? (
        <Card className="animate-pulse"><CardContent className="p-6 h-24" /></Card>
      ) : sortedAwards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AwardIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">No awards logged yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {sortedAwards.map(award => {
                const person = personnelMap[award.PNumber];
                return (
                  <div key={award.id} className="flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{award.AwardName}</span>
                        <Badge variant="secondary" className="text-xs">
                          {person ? `${person.Rank ? person.Rank + ' ' : ''}${person.FirstName} ${person.Surname}` : award.PNumber}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{award.DateAwarded ? format(parseISO(award.DateAwarded), 'dd MMM yyyy') : '—'}</span>
                        {award.Notes && <span className="truncate">{award.Notes}</span>}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(award)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => { if (confirm(`Delete award "${award.AwardName}"?`)) deleteMutation.mutate(award.id); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {dialogOpen && (
        <AwardFormDialog
          award={editingAward}
          personnel={personnel}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </div>
  );
}