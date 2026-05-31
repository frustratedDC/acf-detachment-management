import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { X, Save } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const ITEMS = [
  { key: 'beret', label: 'Beret', scoreField: 'BeretScore', commentField: 'BeretComments' },
  { key: 'shirt', label: 'Shirt/Smock', scoreField: 'ShirtSmockScore', commentField: 'ShirtSmockComments' },
  { key: 'trousers', label: 'Trousers', scoreField: 'TrousersScore', commentField: 'TrousersComments' },
  { key: 'boots', label: 'Boots', scoreField: 'BootsScore', commentField: 'BootsComments' },
  { key: 'accessories', label: 'Accessories', scoreField: 'AccessoriesScore', commentField: 'AccessoriesComments' },
  { key: 'appearance', label: 'General Appearance', scoreField: 'AppearanceScore', commentField: 'AppearanceComments' },
];

export default function UniformInspectionForm({ onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const { personnel: me } = usePersonnel();
  const [selectedPNumber, setSelectedPNumber] = useState('');
  const [scores, setScores] = useState({});
  const [comments, setComments] = useState({});
  const [missingItems, setMissingItems] = useState(false);

  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const { data: recentInspections = [] } = useQuery({
    queryKey: ['inspections-recent', selectedPNumber],
    queryFn: () =>
      selectedPNumber
        ? base44.entities.UniformInspection.filter({ PNumber: selectedPNumber })
        : Promise.resolve([]),
    enabled: !!selectedPNumber,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPNumber) {
        throw new Error('Please select a cadet');
      }

      // Validate that comments are provided for scores < 3
      for (const item of ITEMS) {
        const score = parseInt(scores[item.key] || 0);
        if (score > 0 && score < 3 && !comments[item.key]) {
          throw new Error(`Comments required for ${item.label} when score is less than 3`);
        }
      }

      const totalScore = ITEMS.reduce((sum, item) => sum + (parseInt(scores[item.key] || 0) || 0), 0);

      const data = {
        PNumber: selectedPNumber,
        Date: format(new Date(), 'yyyy-MM-dd'),
        InspectedByPNumber: me.PNumber,
        TotalScore: totalScore,
      };

      ITEMS.forEach(item => {
        const score = parseInt(scores[item.key] || 0);
        if (score > 0) {
          data[item.scoreField] = score;
          if (comments[item.key]) {
            data[item.commentField] = comments[item.key];
          }
        }
      });

      await base44.entities.UniformInspection.create(data);

      if (missingItems) {
        // Create tasks in ProgressLedger (generic task tracking)
        await base44.entities.ProgressLedger.create({
          UserPNumber: selectedPNumber,
          Status: 'Pending',
          Description: `Missing uniform items - inspection on ${format(new Date(), 'dd/MM/yyyy')}`,
          AssignedTo: 'Detachment Commander',
          DueDate: format(new Date(), 'yyyy-MM-dd'),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections-recent'] });
      toast.success('Inspection saved successfully');
      setScores({});
      setComments({});
      setMissingItems(false);
      setSelectedPNumber('');
      if (onSuccess) onSuccess();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save inspection');
    },
  });

  const recentList = recentInspections.slice(0, 3).sort((a, b) => new Date(b.Date) - new Date(a.Date));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between pb-3 sticky top-0 bg-card">
          <CardTitle>Uniform Inspection</CardTitle>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Cadet Selection */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Select Cadet</Label>
            <Select value={selectedPNumber} onValueChange={setSelectedPNumber}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a cadet..." />
              </SelectTrigger>
              <SelectContent>
                {allPersonnel
                  .filter(p => p.Type === 'Cadet' && (p.PersonnelStatus || 'Active') === 'Active')
                  .map(p => (
                    <SelectItem key={p.id} value={p.PNumber}>
                      {p.Rank} {p.FirstName} {p.Surname}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPNumber && (
            <>
              {/* Scoring */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Inspection Scores (1-5)</h3>
                {ITEMS.map(item => (
                  <div key={item.key} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-medium text-sm">{item.label}</Label>
                      <RadioGroup
                        value={scores[item.key] || ''}
                        onValueChange={v => setScores(prev => ({ ...prev, [item.key]: v }))}
                        className="flex gap-2"
                      >
                        {[1, 2, 3, 4, 5].map(n => (
                          <div key={n} className="flex items-center">
                            <RadioGroupItem value={String(n)} id={`${item.key}-${n}`} />
                            <Label htmlFor={`${item.key}-${n}`} className="text-xs cursor-pointer ml-1">
                              {n === 1 ? 'Poor' : n === 5 ? 'Good' : n}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                    {parseInt(scores[item.key] || 0) < 3 && parseInt(scores[item.key] || 0) > 0 && (
                      <Textarea
                        placeholder={`Comments required for ${item.label}...`}
                        value={comments[item.key] || ''}
                        onChange={e => setComments(prev => ({ ...prev, [item.key]: e.target.value }))}
                        className="text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Missing Items */}
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Checkbox
                  checked={missingItems}
                  onCheckedChange={setMissingItems}
                  id="missing-items"
                />
                <Label htmlFor="missing-items" className="text-sm cursor-pointer">
                  Missing/Damaged Items — Create task for DC
                </Label>
              </div>

              {/* Recent Inspections */}
              {recentList.length > 0 && (
                <div className="border rounded-lg p-3 space-y-2">
                  <h3 className="font-semibold text-sm">Last 3 Inspections</h3>
                  <div className="space-y-1">
                    {recentList.map(insp => (
                      <div key={insp.id} className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded">
                        <span>{format(new Date(insp.Date), 'dd/MM/yyyy')}</span>
                        <span className="font-semibold">Score: {insp.TotalScore}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {saveMutation.isPending ? 'Saving...' : 'Save Inspection'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}