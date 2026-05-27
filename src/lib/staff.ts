// Shared helper for picking the right name to show in the UI.
//
// staff_profiles has both `full_name` (the real legal name) and
// `display_name` (an optional short label the team uses when first
// names collide — e.g., two Joshes). Use this helper anywhere a
// staff label is rendered so the convention is consistent across
// the admin and Workbench surfaces.
//
// Initials are intentionally NOT touched by this helper — avatars
// still derive from `full_name` via initialsOf() so the bubbles stay
// predictable (JS / JM / CC / AM).

export interface NameLike {
  display_name?: string | null;
  full_name: string;
}

export const displayNameFor = (s: NameLike | null | undefined): string => {
  if (!s) return "";
  const dn = s.display_name?.trim();
  return dn && dn.length > 0 ? dn : s.full_name;
};
