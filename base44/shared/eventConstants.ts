export const QUALIFIED_STATUS_PRIORITY = {
  SPTA: 1,
  BIT1: 2,
  BIT2: 3,
  BIT3: 4,
  BIT4: 5,
  BIT5: 6,
  Qualified: 7,
};

export const STAR_TRAJECTORY_ORDER = [
  'New Joiner',
  'Basic',
  '1 Star',
  '2 Star',
  '3 Star',
  '4 Star',
  'Adult',
  'Admin',
];

// Map subject qualification strings to broad subject domains for matching
export const QUAL_TO_DOMAIN = {
  'Skill At Arms Instructor (SAAI)': 'SAA',
  'KQUAL Range Safety': 'SHOOTING',
  'RCO SR': 'SHOOTING',
  'RCO LR': 'SHOOTING',
  'YPS': 'SHOOTING',
  'DCCT': 'SHOOTING',
  'Shooting Coach AR': 'SHOOTING',
  'Shooting Coach GP': 'SHOOTING',
  'Exped Comdts Auth': 'NAVIGATION',
  'DofE EAS': 'NAVIGATION',
  'DofE EA': 'NAVIGATION',
  'DofE ES': 'NAVIGATION',
  'LLA': 'NAVIGATION',
  'HMLA': 'NAVIGATION',
  'MLA': 'NAVIGATION',
  'NNAS B': 'NAVIGATION',
  'NNAS S': 'NAVIGATION',
  'NNAS G': 'NAVIGATION',
  'EFAW': 'FIRST AID',
  'FAW': 'FIRST AID',
  'FAI': 'FIRST AID',
  'ACDI': 'DRILL',
  'MQUAL ECO': 'FIELDCRAFT',
};