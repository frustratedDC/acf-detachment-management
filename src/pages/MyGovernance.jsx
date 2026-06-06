import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, FileText, AlertCircle } from 'lucide-react';

function getComplianceColor(status) {
  switch (status) {
    case 'Current':
      return 'bg-chart-2/10 text-chart-2';
    case 'Expiring Soon':
      return 'bg-amber-100/50 text-amber-700';
    case 'Expired':
      return 'bg-destructive/10 text-destructive';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export default function MyGovernance() {
  const { personnel: me } = usePersonnel();
  const isDC = me?.AccessLevel >= 5;

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ['policy-registry'],
    queryFn: () => base44.entities.PolicyRegistry.filter({}),
  });

  const currentPolicies = policies.filter((p) => p.ComplianceStatus === 'Current').length;
  const expiringPolicies = policies.filter((p) => p.ComplianceStatus === 'Expiring Soon').length;
  const expiredPolicies = policies.filter((p) => p.ComplianceStatus === 'Expired').length;

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <PageHeader title="My Governance" description="Training and compliance records" icon={ShieldCheck} />
        <div className="flex justify-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="My Governance" description="Training and compliance records" icon={ShieldCheck} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Current Policies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{currentPolicies}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-700">{expiringPolicies}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Expired
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{expiredPolicies}</p>
          </CardContent>
        </Card>
      </div>

      {/* Policies List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Policy Documents</h2>
        {policies.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground text-sm">No policies registered yet.</p>
            </CardContent>
          </Card>
        ) : (
          policies.map((policy) => (
            <Card key={policy.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{policy.Title}</p>
                    {policy.Description && (
                      <p className="text-xs text-muted-foreground mt-1">{policy.Description}</p>
                    )}
                    {policy.ExpiryDate && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Expires: {new Date(policy.ExpiryDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Badge className={getComplianceColor(policy.ComplianceStatus)}>
                    {policy.ComplianceStatus}
                  </Badge>
                </div>
                {policy.DocumentUrl && (
                  <a
                    href={policy.DocumentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline mt-3 inline-block"
                  >
                    View Document →
                  </a>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}