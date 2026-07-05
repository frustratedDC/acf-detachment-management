import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Singleton onboarding status for the detachment. Auto-creates the record on first read.
export function useOnboardingStatus(enabled = true) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: async () => {
      const records = await base44.entities.OnboardingStatus.list();
      if (records.length > 0) return records[0];
      return base44.entities.OnboardingStatus.create({ CurrentPhase: 1 });
    },
    enabled,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });

  return { status: data, isLoading, refresh };
}