// Preset awards seeded on every new event, and the default competition scoring model.
// Matches the reference Recruit Cadre Plan competition section.

export const PRESET_AWARDS = [
  {
    AwardName: 'Best Section',
    AwardType: 'preset',
    Prize: 'One medal per person in the winning section',
    Description: 'Awarded to the section with the most accrued points.',
    SortOrder: 1,
  },
  {
    AwardName: 'Top Recruit',
    AwardType: 'preset',
    Prize: 'Mounted miniature GP Rifle',
    Description: 'Awarded to the recruit who has earned the most points.',
    SortOrder: 2,
  },
  {
    AwardName: 'Silly Sausage',
    AwardType: 'preset',
    Prize: 'Mounted silly sausage',
    Description: 'Awarded to the recruit who made a blunder, but demonstrated true resilience, and bounced back.',
    SortOrder: 3,
  },
  {
    AwardName: 'Subject Certificates',
    AwardType: 'preset',
    Prize: 'Certificate',
    Description: 'Given to those who standout in each subject being delivered. Nominated by the instructor.',
    SortOrder: 4,
  },
];

// 3 pts = best recruit in stance, 2 pts = 2nd, 1 pt = 3rd, plus 1 instructor bonus point.
export const DEFAULT_SCORING = { pointsPerRank: [3, 2, 1], bonusPoints: 1 };

export const COMPLETION_STATUSES = [
  { value: 'Pass', label: 'Pass', color: 'bg-chart-2/20 text-chart-2' },
  { value: 'Stance', label: 'Stance', color: 'bg-blue-500/20 text-blue-600' },
  { value: 'REVAL', label: 'REVAL', color: 'bg-destructive/20 text-destructive' },
  { value: '', label: '—', color: 'bg-muted text-muted-foreground' },
];