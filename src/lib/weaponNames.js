// Formal weapon names for WHT display
export const WEAPON_FORMAL_NAMES = {
  'L98A2': 'Cadet Small Bore Target Rifle',
  'L85A2': 'L85A2 Cadet Rifle',
  'L86A2': 'L86A2 Light Support Weapon',
  'SA80': 'SA80 Individual Weapon',
  'Other': 'Other Weapon System',
};

export function getFormalWeaponName(code) {
  return WEAPON_FORMAL_NAMES[code] || code;
}