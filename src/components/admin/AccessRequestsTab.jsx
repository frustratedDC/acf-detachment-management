import React from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, Clock, InboxIcon } from 'lucide-react';
import { toast } from 'sonner';
import { usePersonnel } from '@/lib/usePersonnel';

export default function AccessRequestsTab() {
  const queryClient = useQueryClient();
  const { personnel: me } = usePersonnel();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['access-requests'],
    queryFn: () => base44.entities.AccessRequest.list('-created_date', 100),
  });

  const sorted = [...requests].sort((a, b) => {
    const order = { Pending: 0, Approved: 1, Rejected: 2 };
    if (order[a.Status] !== order[b.Status]) return order[a.Status] - order[b.Status];
    return new Date(b.created_date) - new Date(a.created_date);
  });

  const approveMutation = useMutation({
    mutationFn: async (request) => {
      // Mark request approved
      await base44.entities.AccessRequest.update(request.id, {
        Status: 'Approved',
        RespondedByPNumber: me?.PNumber || 'ADMIN',
        ResponseDate: new Date().toISOString().split('T')[0],
      });

      // Find and update the cadet's personnel record
      const matches = await base44.entities.PersonnelManager.filter({ PNumber: request.RequesterPNumber });
      if (matches.length > 0) {
        const updateData = {};
        if (request.FeatureKey === 'KeepingActiveAccess') updateData.KeepingActiveAccess = true;
        if (request.FeatureKey === 'CEAccess') updateData.CEAccess = true;
        if (Object.keys(updateData).length > 0) {
          await base44.entities.PersonnelManager.update(matches[0].id, updateData);
        }
      }
    },
    onSuccess: () => {
      toast.success('Access granted successfully');
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
    },
    onError: (err) => toast.error(`Failed to approve: ${err.message}`),
  });

  const rejectMutation = useMutation({
    mutationFn: async (request) => {
      await base44.entities.AccessRequest.update(request.id, {
        Status: 'Rejected',
        RespondedByPNumber: me?.PNumber || 'ADMIN',
        ResponseDate: new Date().toISOString().split('T')[0],
      });
    },
    onSuccess: () => {
      toast.success('Request rejected');
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
    },
    onError: (err) => toast.error(`Failed to reject: ${err.message}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const pending = sorted.filter(r => r.Status === 'Pending');
  const processed = sorted.filter(r => r.Status !== 'Pending');

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <InboxIcon className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No access requests found</p>
      </div>
    );
  }

  const isBusy = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            Pending Requests ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map(req => (
              <Card key={req.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm">
                        {req.RequesterName || req.RequesterPNumber}
                        {req.RequesterName && <span className="text-muted-foreground font-normal ml-1">({req.RequesterPNumber})</span>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {req.FeatureLabel || req.FeatureKey}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Requested: {req.created_date ? new Date(req.created_date).toLocaleDateString('en-GB') : '—'}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectMutation.mutate(req)}
                        disabled={isBusy}
                        className="gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate(req)}
                        disabled={isBusy}
                        className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {processed.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm mb-3 text-muted-foreground">Request History</h3>
          <div className="space-y-2">
            {processed.slice(0, 30).map(req => (
              <Card key={req.id} className="opacity-70">
                <CardContent className="pt-3 pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">
                        {req.RequesterName || req.RequesterPNumber}
                        {req.RequesterName && <span className="text-muted-foreground font-normal ml-1">({req.RequesterPNumber})</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{req.FeatureLabel || req.FeatureKey}</p>
                    </div>
                    <Badge variant={req.Status === 'Approved' ? 'default' : 'destructive'} className="shrink-0">
                      {req.Status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}