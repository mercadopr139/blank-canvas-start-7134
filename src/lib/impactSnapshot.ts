// Youth-reached snapshot for the Forms & Waivers module.
//
// Camp / one-day-program youth are collected through published forms (waivers,
// sign-up sheets) — a population kept COMPLETELY SEPARATE from NLA's registered
// youth (youth_registrations). No cross-matching between the two systems.
//
// This turns a set of forms' responses into a demographic snapshot: unique
// youth reached (de-duped by name + birthday), boys / girls, and breakdowns by
// race, district, lunch, age, income. Used two ways:
//   • one form  -> the per-form summary at the bottom of a form's Responses tab
//   • many forms -> the aggregate at the bottom of the Forms & Waivers list

import { ageFromDob, isInputField, type FormFieldDef, type FormSettings, type ImpactFieldMap } from "./formKit";

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
const clean = (label: string) => norm(label.replace(/<[^>]*>/g, " ")); // strip any rich-text HTML

// Fields that describe someone OTHER than the youth — never map name/DOB/etc. here.
const AVOID = /(parent|guardian|emergency|mother|father|physician|doctor|contact)/;
// Fields that clearly describe the youth — preferred when several fields match.
const PREFER = /(child|youth|camper|student|participant|applicant|kid)/;

// Auto-detect which of a form's fields hold each demographic. Works because the
// camp/waiver forms are copied from the registration form, so the questions read
// the same. A form's manual override (settings.impactMap) always wins per-field.
export function detectImpactFields(fields: FormFieldDef[]): ImpactFieldMap {
  const inputs = (fields || []).filter((f) => isInputField(f.field_type));

  const pick = (opts: {
    type?: string;
    must?: (label: string) => boolean;
    avoid?: boolean; // penalize parent/guardian-style labels
  }): string | undefined => {
    const cands = inputs.filter(
      (f) => (opts.type ? f.field_type === opts.type : true) && (opts.must ? opts.must(clean(f.label)) : true),
    );
    if (!cands.length) return undefined;
    const score = (f: FormFieldDef) => {
      const l = clean(f.label);
      let s = 0;
      if (opts.avoid && AVOID.test(l)) s -= 10;
      if (PREFER.test(l)) s += 5;
      return s;
    };
    return [...cands].sort((a, b) => score(b) - score(a))[0].field_key;
  };

  const map: ImpactFieldMap = {};
  map.dob =
    pick({ type: "dob", avoid: true }) ||
    pick({ must: (l) => l.includes("birth") || l.includes("dob"), avoid: true });
  map.firstName = pick({ must: (l) => l.includes("first") && l.includes("name"), avoid: true });
  map.lastName = pick({ must: (l) => l.includes("last") && l.includes("name"), avoid: true });
  map.gender = pick({ must: (l) => l.includes("gender") || l.includes(" sex") || l === "sex" || l.includes("sex "), avoid: true });
  map.race = pick({ must: (l) => l.includes("race") || l.includes("ethnic"), avoid: true });
  map.district = pick({ must: (l) => l.includes("district"), avoid: true });
  map.lunch = pick({ must: (l) => l.includes("lunch"), avoid: false });
  map.income = pick({ must: (l) => l.includes("income"), avoid: false });
  return map;
}

// Merge auto-detected fields with a form's manual override (override wins, but
// only where it actually names a field — a blank override never erases a guess).
function effectiveMap(form: ImpactForm): ImpactFieldMap {
  const map = detectImpactFields(form.fields);
  const override = form.settings?.impactMap || {};
  (Object.keys(override) as (keyof ImpactFieldMap)[]).forEach((k) => {
    if (override[k]) map[k] = override[k];
  });
  return map;
}

const genderBucket = (g: string): "boy" | "girl" | null => {
  const s = norm(g);
  if (!s) return null;
  if (s.startsWith("f") || s.includes("girl") || s.includes("female")) return "girl";
  if (s.startsWith("m") || s.includes("boy") || s.includes("male")) return "boy";
  return null;
};

const tally = (vals: unknown[]) => {
  const m: Record<string, number> = {};
  vals.forEach((v) => {
    const s = (v == null ? "" : String(v)).trim();
    if (s) m[s] = (m[s] || 0) + 1;
  });
  return Object.entries(m).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
};

export type ImpactForm = {
  fields: FormFieldDef[];
  settings?: FormSettings | null;
  responses: { data: Record<string, unknown> }[];
};

export type SnapshotResult = {
  totalResponses: number;
  uniqueCount: number;
  boys: number;
  girls: number;
  noKey: number; // responses that lacked name+DOB and so couldn't be de-duplicated
  youthKeys: string[]; // `first|last|dob` for each de-duped youth (for cross-matching)
  gender: { name: string; count: number }[];
  ageData: { name: string; count: number }[];
  race: { name: string; count: number }[];
  district: { name: string; count: number }[];
  lunch: { name: string; count: number }[];
  income: { name: string; count: number }[];
};

type Rec = { district?: unknown; race?: unknown; gender?: unknown; lunch?: unknown; income?: unknown; dob?: string };

// Build a snapshot from one or many forms. Youth are de-duped by
// name + birthday ACROSS all forms passed in (a kid on two camp waivers counts
// once). Responses missing name/DOB each count as their own head.
export function computeImpactSnapshot(forms: ImpactForm[]): SnapshotResult {
  const byKey = new Map<string, Rec>();
  let noKey = 0;
  let totalResponses = 0;

  for (const form of forms) {
    const map = effectiveMap(form);
    const val = (data: Record<string, unknown>, k: keyof ImpactFieldMap) => (map[k] ? data?.[map[k] as string] : undefined);
    for (const r of form.responses || []) {
      totalResponses++;
      const data = r.data || {};
      const first = val(data, "firstName"), last = val(data, "lastName"), dobRaw = val(data, "dob");
      const rec: Rec = {
        district: val(data, "district"), race: val(data, "race"), gender: val(data, "gender"),
        lunch: val(data, "lunch"), income: val(data, "income"),
        dob: dobRaw ? String(dobRaw).slice(0, 10) : undefined,
      };
      if (first && last && dobRaw) {
        const key = `${norm(first)}|${norm(last)}|${String(dobRaw).slice(0, 10)}`;
        if (!byKey.has(key)) byKey.set(key, rec);
      } else {
        byKey.set(`__nokey_${noKey++}`, rec);
      }
    }
  }

  const unique = [...byKey.values()];
  const ages = unique.map((u) => ageFromDob(u.dob)).filter((a): a is number => a != null);
  const buckets: Record<string, number> = { "7-9": 0, "10-12": 0, "13-15": 0, "16-17": 0, "18-19": 0, "Other": 0 };
  ages.forEach((a) => {
    if (a >= 7 && a <= 9) buckets["7-9"]++; else if (a >= 10 && a <= 12) buckets["10-12"]++;
    else if (a >= 13 && a <= 15) buckets["13-15"]++; else if (a >= 16 && a <= 17) buckets["16-17"]++;
    else if (a >= 18 && a <= 19) buckets["18-19"]++; else buckets["Other"]++;
  });

  return {
    totalResponses,
    uniqueCount: unique.length,
    boys: unique.filter((u) => genderBucket(String(u.gender ?? "")) === "boy").length,
    girls: unique.filter((u) => genderBucket(String(u.gender ?? "")) === "girl").length,
    noKey,
    youthKeys: [...byKey.keys()].filter((k) => !k.startsWith("__nokey_")),
    gender: tally(unique.map((u) => u.gender)),
    ageData: Object.entries(buckets).filter(([, n]) => n > 0).map(([name, count]) => ({ name, count })),
    race: tally(unique.map((u) => u.race)),
    district: tally(unique.map((u) => u.district)),
    lunch: tally(unique.map((u) => u.lunch)),
    // Income sorts by bracket size (highest at top, "Less than $25,000" last),
    // not by count. "Greater than $80,001" -> 80001 ranks above every "Less than".
    income: tally(unique.map((u) => u.income)).sort((a, b) => {
      const dollars = (s: string) => { const d = s.replace(/[^0-9]/g, ""); return d ? parseInt(d, 10) : -1; };
      return dollars(b.name) - dollars(a.name);
    }),
  };
}
