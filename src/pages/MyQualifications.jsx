import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, AlertCircle } from 'lucide-react';

function getQualificationColor(status) {
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

export default function MyQualifications() {
  const { personnel: me } = usePersonnel();

  const { data: myQualifications = [], isLoading } = useQuery({
    queryKey: ['my-qualifications', me?.PNumber],
    queryFn: () =>
      base44.entities.QualificationMatrix.filter({
        InstructorPNumber: me?.PNumber,
      }),
    enabled: !!me?.PNumber,
  });

  const { data: teamQualifications = [] } = useQuery({
    queryKey: ['team-qualifications'],
    queryFn: () => base44.entities.QualificationMatrix.filter({}),
  });

  const currentQuals = myQualifications.filter((q) => q.Status === 'Current').length;
  const expiringQuals = myQualifications.filter((q) => q.Status === 'Expiring Soon').length;
  const expiredQuals = myQualifications.filter((q) => q.Status === 'Expired').length;

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <PageHeader
          title="My Qualifications"
          description="Your training and qualifications record"
          icon={GraduationCap}
        />
        <div className="flex justify-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="My Qualifications"
        description="Your training and qualifications record"
        icon={GraduationCap}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-chart-2 flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              Current
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{currentQuals}</p>
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
            <p className="text-2xl font-bold text-amber-700">{expiringQuals}</p>
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
            <p className="text-2xl font-bold text-destructive">{expiredQuals}</p>
          </CardContent>
        </Card>
      </div>

      {/* Your Qualifications */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Your Qualifications</h2>
        {myQualifications.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground text-sm">No qualifications registered yet.</p>
            </CardContent>
          </Card>
        ) : (
          myQualifications.map((qual) => (
            <Card key={qual.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{qual.QualificationType}</p>
                    {qual.AwardedDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Awarded: {new Date(qual.AwardedDate).toLocaleDateString()}
                      </p>
                    )}
                    {qual.ExpiryDate && (
                      <p className="text-xs text-muted-foreground">
                        Expires: {new Date(qual.ExpiryDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Badge className={getQualificationColor(qual.Status)}>{qual.Status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Team Summary */}
      <div className="space-y-4 mt-8">
        <h2 className="text-lg font-semibold">Team Overview</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Qualification Types in Team</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                ...new Set(teamQualifications.map((q) => q.QualificationType)),
              ]
                .sort()
                .map((type) => {
                  const withThisQual = teamQualifications.filter(
                    (q) => q.QualificationType === type && q.Status === 'Current'
                  ).length;
                  const total = new Set(
                    teamQualifications
                      .filter((q) => q.QualificationType === type)
                      .map((q) => q.InstructorPNumber)
                  ).size;

                  return (
                    <div key={type} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{type}</span>
                      <span className="font-medium">
                        {withThisQual}/{total} current
                      </span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}