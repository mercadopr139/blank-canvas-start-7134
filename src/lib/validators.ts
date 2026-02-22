// ─── Phone ────────────────────────────────────────────────────────────────────

/** Strip everything except digits and leading + */
export function digitsOnly(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

/** Format digits to (XXX) XXX-XXXX as user types */
export function formatPhoneDisplay(digits: string): string {
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

/** Convert to E.164 format (+1XXXXXXXXXX). Returns null if invalid. */
export function toE164(raw: string): string | null {
  const digits = digitsOnly(raw);
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** Check if a phone string is valid (10 or 11 digit US number) */
export function isValidPhone(raw: string): boolean {
  if (!raw.trim()) return true; // empty is ok (optional field)
  return toE164(raw) !== null;
}

/** Extract 10 digits from E.164 for display formatting */
export function e164ToDisplay(e164: string | null): string {
  if (!e164) return "";
  const digits = digitsOnly(e164);
  const last10 = digits.length === 11 ? digits.slice(1) : digits;
  if (last10.length === 10) return formatPhoneDisplay(last10);
  return e164; // fallback for non-standard stored values
}

// ─── Email ───────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(raw: string): boolean {
  if (!raw.trim()) return true; // empty is ok (optional field)
  return EMAIL_REGEX.test(raw.trim());
}

export function normalizeEmail(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  return v || null;
}

// ─── Address ─────────────────────────────────────────────────────────────────

export interface StructuredAddress {
  address: string;        // full display string
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  address_country: string | null;
}

export interface NominatimResult {
  display_name: string;
  place_id: number;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
    country_code?: string;
  };
}

export function nominatimToStructured(result: NominatimResult): StructuredAddress {
  const a = result.address;
  const street = a
    ? [a.house_number, a.road].filter(Boolean).join(" ") || null
    : null;
  const city = a ? (a.city || a.town || a.village || null) : null;
  const state = a?.state || null;
  const zip = a?.postcode || null;
  const country = a?.country_code?.toUpperCase() || "US";

  return {
    address: result.display_name,
    address_street: street,
    address_city: city,
    address_state: state,
    address_zip: zip,
    address_country: country,
  };
}
