import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { hasAccess, ACCESS_LEVELS } from '@/lib/accessLevels';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';

export default function AttentionBadge() {
  const { personnel } = usePersonnel();
  const level = personnel?.AccessLevel ?? 0;
  const isDC = hasAccess(level, ACCESS_LEVELS.DET_COMMANDER);

  const { data: pendingProgress = [] } = useQuery({
    queryKey: ['pending-progress-badge'],
    queryFn: () => base44.entities.ProgressLedger.filter({ Status: 'Pending' }),
    enabled: isDC,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  const { data: pendingCE = [] } = useQuery({
    queryKey: ['pending-ce-badge'],
    queryFn: () => base44.entities.CommunityEngagementLedger.filter({ Status: 'Pending' }),
    enabled: isDC,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  const { data: pendingKA = [] } = useQuery({
    queryKey: ['pending-access-badge'],
    queryFn: () => base44.entities.AccessRequest.filter({ Status: 'Pending' }),
    enabled: isDC,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  if (!isDC) return null;

  const total = pendingProgress.length + pendingCE.length + pendingKA.length;
  if (total === 0) return null;

  return (
    <Link
      to="/tasks"
      className="flex items-center gap-1.5 bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 rounded-lg px-2.5 py-1 transition-colors shrink-0"
      title={`${total} item(s) require attention`}
    >
      <Bell className="w-3.5 h-3.5 text-destructive" />
      <span className="text-xs font-semibold text-destructive">{total} Pending</span>
    </Link>
  );
}