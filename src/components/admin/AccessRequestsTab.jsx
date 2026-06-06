import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function AccessRequestsTab() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.asServiceRole.entities.AccessRequest.filter({})
      .then(recs => {
        const sorted = recs.sort((a, b) => {
          const statusOrder = { Pending: 0, Approved: 1, Rejected: 2 };
          if (statusOrder[a.Status] !== statusOrder[b.Status]) {
            return statusOrder[a.Status] - statusOrder[b.Status];
          }
          return new Date(b.created_date) - new Date(a.created_date);
        });
        setRequests(sorted);
      })
      .finally(() => setLoading(false));
  }, []);

  const approveMutation = useMutation({
    mutationFn: async (request) => {
      // Update request status
      await base44.asServiceRole.entities.AccessRequest.update(request.id, {
        Status: 'Approved',
        RespondedByPNumber: 'system',
        ResponseDate: new Date().toISOString().split('T')[0],
      });

      // Update user access flag
      const personnel = await base44.asServiceRole.entities.PersonnelManager.filter({
        PNumber: request.RequesterPNumber,
      });

      if (personnel.length > 0) {
        const updateData = {};
        if (request.FeatureKey === 'KeepingActiveAccess') {
          updateData.KeepingActiveAccess = true;
        } else if (request.FeatureKey === 'CEAccess') {
          updateData.CEAccess = true;
        }
        await base44.asServiceRole.entities.PersonnelManager.update(
          personnel[0].id,
          updateData
        );
      }
    },
    onSuccess: (_, request) => {
      setRequests(prev => prev.map(r => 
        r.id === request.id ? { ...r, Status: 'Approved' } : r
      ));
      toast.success('Access granted successfully');
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
    },
    onError: () => toast.error('Failed to approve request'),
  });

  const rejectMutation = useMutation({
    mutationFn: async (request) => {
      await base44.asServiceRole.entities.AccessRequest.update(request.id, {
        Status: 'Rejected',
        RespondedByPNumber: 'system',
        ResponseDate: new Date().toISOString().split('T')[0],
      });
    },
    onSuccess: (_, request) => {
      setRequests(prev => prev.map(r => 
        r.id === request.id ? { ...r, Status: 'Rejected' } : r
      ));
      toast.success('Request rejected');
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
    },
    onError: () => toast.error('Failed to reject request'),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const pendingRequests = requests.filter(r => r.Status === 'Pending');
  const processedRequests = requests.filter(r => r.Status !== 'Pending');

  return (
    <div className="space-y-6">
      {pendingRequests.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent-foreground" />
            Pending Requests ({pendingRequests.length})
          </h3>
          <div className="space-y-2">
            {pendingRequests.map(req => (
              <Card key={req.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm">{req.RequesterName} ({req.RequesterPNumber})</p>
                      <p className="text-xs text-muted-foreground mt-1">{req.FeatureLabel}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectMutation.mutate(req)}
                        disabled={rejectMutation.isPending}
                        className="gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate(req)}
                        disabled={approveMutation.isPending}
                        className="gap-1"
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

      {processedRequests.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm mb-3">Request History</h3>
          <div className="space-y-2">
            {processedRequests.slice(0, 20).map(req => (
              <Card key={req.id} className="opacity-75">
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{req.RequesterName} ({req.RequesterPNumber})</p>
                      <p className="text-xs text-muted-foreground">{req.FeatureLabel}</p>
                    </div>
                    <Badge variant={req.Status === 'Approved' ? 'default' : 'destructive'}>
                      {req.Status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {requests.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No access requests</p>
        </div>
      )}
    </div>
  );
}