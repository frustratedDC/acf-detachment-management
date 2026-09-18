export const EVENT_TYPES = ['County', 'Company', 'Detachment', 'Other'];

export const ACTIVITY_TAGS = [
  'Fieldcraft',
  'Sports/Fitness',
  'Navigation/Expedition',
  'Skill At Arms/Shooting',
  'Drill and Turnout',
  'Public Event/Community Engagement',
  'General Training',
  'First Aid',
  'Radios',
  'DofE',
  'Adventurous Training',
  'Admin',
];

export const QUALIFIED_STATUS_OPTIONS = [
  'SPTA',
  'BIT1',
  'BIT2',
  'BIT3',
  'BIT4',
  'BIT5',
  'Qualified',
];

// Lower number = higher priority
export const QUALIFIED_STATUS_PRIORITY = {
  SPTA: 1,
  BIT1: 2,
  BIT2: 3,
  BIT3: 4,
  BIT4: 5,
  BIT5: 6,
  Qualified: 7,
};

export const SUBJECT_QUAL_DOMAINS = {
  'SAA': ['Skill At Arms Instructor (SAAI)'],
  'CIS': [
    'CIS Instructor Basic (B+1*)',
    'CIS Instructor Intermediate (B,1*+2*)',
    'CIS Instructor Advanced (B,1*,2*,3*,4*)',
  ],
  'SHOOTING/RANGES': [
    'KQUAL Range Safety',
    'RCO SR',
    'RCO LR',
    'YPS',
    'DCCT',
    'Shooting Coach AR',
    'Shooting Coach GP',
  ],
  'NAVIGATION/EXPEDITION/DOFE': [
    'Exped Comdts Auth',
    'DofE EAS',
    'DofE EA',
    'DofE ES',
    'LLA',
    'HMLA',
    'MLA',
    'NNAS B',
    'NNAS S',
    'NNAS G',
  ],
  'FIRST AID': ['EFAW', 'FAW', 'FAI'],
  'DRILL & TURNOUT': ['ACDI'],
  'FIELDCRAFT': ['MQUAL ECO'],
};

export const CI_QUALIFICATIONS = ['JCIC', 'SCIC'];
export const CI_SUBJECT_QUALS = ['EFAW', 'FAW'];

export const STAR_LEVELS = ['Basic', '1 Star', '2 Star', '3 Star', '4 Star', 'Adult', 'Admin'];

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

export const TRANSPORT_DRESS_STATES = ['MTP', 'CIV', 'Other'];

export const SLOT_TYPES = ['BREAKFAST', 'LUNCH', 'EVENING MEAL', 'BREAK', 'OTHER'];

export const KIT_CATEGORIES = [
  {
    number: 1,
    name: 'Issued Uniform',
    disclaimer:
      'Quantity auto-calculated based on transport dress state. CIV = 2x issued uniform, MTP = 1x issued uniform. Items marked with * allow multiple quantities.',
    items: ['Beret', 'Smock', 'Shirt*', 'T-shirt*', 'Trousers*', 'Belt', 'Socks*', 'Boots'],
    multiQuantityItems: ['Shirt*', 'T-shirt*', 'Trousers*', 'Socks*'],
  },
  {
    number: 2,
    name: 'Civilian Clothing',
    disclaimer: 'No clothing displaying offensive slogans or imagery. Appropriate for weather conditions.',
    items: [
      'Waterproof/Outdoor Jacket/Coat',
      'Jumper/Hoodie',
      'T-shirt',
      'Trousers/shorts',
      'Trainers',
      'Underwear',
      'Socks',
      'Hat/Cap',
    ],
    multiQuantityItems: [],
  },
  {
    number: 3,
    name: 'Personal Hygiene',
    disclaimer:
      'NO AEROSOLS. Washkit must contain as a minimum: soap, toothbrush, toothpaste, towel, deodorant (roll-on/stick only). No jewelry except plain stud earrings.',
    items: ['Washkit (min contents)', 'Baby Wipes', 'Other hygiene items'],
    multiQuantityItems: [],
  },
  {
    number: 4,
    name: 'Sleeping Systems',
    disclaimer: 'Check if own sleeping equipment is required for this event.',
    items: ['Sleeping Bag', 'Sleeping Bag (outdoor use)', 'Pillow (optional)'],
    multiQuantityItems: [],
  },
  {
    number: 5,
    name: 'Personal Safety',
    disclaimer: 'Torch must have spare batteries. Suncream minimum SPF 30.',
    items: ['Torch', 'Suncream', 'Lip Balm', 'Personal first aid kit'],
    multiQuantityItems: [],
  },
  {
    number: 6,
    name: 'Admin Items',
    disclaimer: 'Small combination padlock for locker/kit security.',
    items: ['Charging Cable & Plug', 'Powerbank', 'Notebook & Pen/Pencil', 'Small Combination Padlock'],
    multiQuantityItems: [],
  },
  {
    number: 7,
    name: 'Medication',
    disclaimer:
      'All prescribed medication must be declared on enrolment. MAR sheet reference, quantities, and handover protocols must be completed before departure.',
    items: [
      'Prescribed medication (compliance check)',
      'MAR sheet reference',
      'Quantities logged',
      'Handover protocol completed',
    ],
    multiQuantityItems: [],
  },
];