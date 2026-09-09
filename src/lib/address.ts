// What a home address must look like before the registration form will take it.
//
// Written after a season's worth of the Youth-per-District map: one parent
// typed their email into the address box, one typed "Elemental 2", one gave a
// PO box. None of those is where a child lives. The field autocompletes and
// asks the parent to pick their address from the list — that is the real
// confirmation — but a parent can always type past the list, so this is the
// floor underneath it.
//
// Deliberately loose. It refuses the things that cannot be a home and lets
// everything else through to the geocoder; a rule that also rejected real
// addresses would cost registrations, which is worse than a missing dot.

/** Why this cannot be a home address, in the parent's words, or null. */
export const addressProblem = (value: string | null | undefined): string | null => {
  const v = (value ?? "").trim();
  if (!v) return null; // "required" is the form's job, not this one's

  if (/@/.test(v)) {
    return "That looks like an email address. Please enter the street address where your child lives.";
  }
  if (/\bp\.?\s*o\.?\s*box\b/i.test(v) || /\bpost office box\b/i.test(v)) {
    return "Please enter a street address, not a PO box — we need to know where your child lives.";
  }
  if (!/\d/.test(v)) {
    return "Please include the house number.";
  }
  if (v.split(/\s+/).filter(Boolean).length < 3) {
    return "That doesn't look like a full address. Please include the street and the town.";
  }
  return null;
};
