// Hawk Squad — the shared shape of a registration, and the pick-lists.
//
// A separate programme in its own tables (see migration 20260929120000). The
// column names mirror youth_registrations where the concept is the same, so
// the address component, the photo helper and the validators work unchanged;
// the lists here are the ones the form and the admin editor both use, so a
// dropdown can never offer something the other side does not know.

export const HAWK_GRADES = ["9th", "10th", "11th", "12th"] as const;

export const HAWK_CTE_PROGRAMS = [
  "Automotive Technology",
  "Allied Medical",
  "Career Exploratory",
  "Carpentry & Property Management",
  "Coastal & Marine Science",
  "Communication Arts",
  "Computer Technology",
  "Cosmetology",
  "Culinary Arts/Hospitality",
  "Electrical Trades",
  "Environmental Science & Sustainability",
  "Future Educator",
  "HVAC-R/Sustainable Energy",
  "Law & Public Safety",
  "Marine Maintenance",
  "Powersports",
  "Pre-Engineering",
  "Veterinary Science",
  "Welding",
] as const;

export const HAWK_SEX = ["Male", "Female"] as const;

export const HAWK_RACE = [
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Hispanic or Latino",
  "Native Hawaiian or Other Pacific Islander",
  "White",
  "Two or More Races",
] as const;

/** The dismissal waiver's field key — the one optional waiver on the form. */
export const HAWK_DISMISSAL_WAIVER_KEY = "hawk_dismissal";

export interface HawkWaiverRecord {
  title: string;
  name: string;
  signaturePath: string;
}

export interface HawkRegistration {
  id: string;
  created_at: string;
  updated_at: string;
  submission_date: string;
  program_year: string;
  child_first_name: string;
  child_last_name: string;
  child_sex: string | null;
  child_date_of_birth: string | null;
  child_race_ethnicity: string | null;
  grade_level: string | null;
  cte_program: string | null;
  child_primary_address: string | null;
  latitude: number | null;
  longitude: number | null;
  parent_first_name: string | null;
  parent_last_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  free_or_reduced_lunch: string | null;
  allergies: string | null;
  has_asthma: boolean | null;
  asthma_inhaler_info: string | null;
  important_child_notes: string | null;
  child_headshot_url: string | null;
  waivers_data: Record<string, HawkWaiverRecord> | null;
  dismissal_waiver_signed_at: string | null;
  final_signature_name: string | null;
  custom_fields_data: Record<string, string> | null;
  approved_for_attendance: boolean;
  archived_at: string | null;
  youth_link_id: string | null;
}

/** Public URL of a headshot stored in the youth-photos bucket. */
export const hawkPhotoUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const clean = path.startsWith("youth-photos/") ? path.slice("youth-photos/".length) : path;
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/youth-photos/${clean}`;
};

/** Public URL of a signature image in the registration-signatures bucket. */
export const hawkSignatureUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/registration-signatures/${path}`;
};

/** Can this student be dismissed from NLA rather than ride the bus? */
export const canBeDismissed = (r: Pick<HawkRegistration, "dismissal_waiver_signed_at">) =>
  !!r.dismissal_waiver_signed_at;
