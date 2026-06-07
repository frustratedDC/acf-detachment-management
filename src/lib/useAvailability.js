import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useMemo } from 'react';

/**
 * Unified availability hook.
 * Merges records from both InstructorAvailability (new) and StaffAvailability (legacy)
 * into a single consistent shape:
 *   { id, InstructorPNumber, Date, Status, Reason }
 *
 * New records take precedence over legacy records for the same instructor+date combo.
 */
export function useAvailability() {
  const { data: newRecords = [], isLoading: loadingNew } = useQuery({
    queryKey: ['instructor-availability'],
    queryFn: () => base44.entities.InstructorAvailability.list(),
    refetchOnWindowFocus: true,
  });

  const { data: legacyRecords = [], isLoading: loadingLegacy } = useQuery({
    queryKey: ['staff-availability-legacy'],
    queryFn: () => base44.entities.StaffAvailability.list(),
    refetchOnWindowFocus: true,
  });

  const merged = useMemo(() => {
    // Build a set of keys already covered by new records
    const covered = new Set(newRecords.map(r => `${r.InstructorPNumber}__${r.Date}`));

    // Map legacy records into the same shape, skipping any already in the new system
    const bridged = legacyRecords
      .filter(r => r.PNumber && r.EventDate && !covered.has(`${r.PNumber}__${r.EventDate}`))
      .map(r => ({
        id: `legacy__${r.id}`,
        InstructorPNumber: r.PNumber,
        Date: r.EventDate,
        Status: r.IsAvailable === false ? 'Unavailable' : 'Available',
        Reason: r.Notes || '',
        _isLegacy: true,
      }));

    return [...newRecords, ...bridged];
  }, [newRecords, legacyRecords]);

  return {
    availability: merged,
    isLoading: loadingNew || loadingLegacy,
    newRecords,
    legacyRecords,
  };
}