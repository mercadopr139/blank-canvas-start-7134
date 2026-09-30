// Run from the repo root:  node scripts/make-program-register.mjs
//
// Derive each partner program's public registration form from the NLA form
// (src/pages/Register.tsx): Hawk Squad and BAM.
//
// The NLA form is data-driven and already does everything these forms need
// done well -- address confirmation, phone and email validation, the asthma
// and allergy gates, the photo upload, the signature pads, the duplicate
// check. So each program's form is that file with its tables, its title, its
// insert payload and its NLA-only bits swapped, rather than a second form
// that will drift. Edit Register.tsx and re-run; never hand-edit the outputs.
import fs from "node:fs";

const PROGRAMS = {
  hawk: {
    out: "src/pages/HawkSquadRegister.tsx",
    component: "HawkSquadRegister",
    fields: "hawk_squad_form_fields",
    regs: "hawk_squad_registrations",
    sameYear: "hawk_squad_same_year_matches",
    prefix: "hawk-squad",
    name: "Hawk Squad",
    programLabel: "Hawk Squad",
    districtLabel: "Cape May Tech",
    dismissalKey: "hawk_dismissal",
    bg: "#0f4c2f",
    submittedTitle: "Welcome to HAWK SQUAD!",
    submittedLine: "See you Tuesdays &amp; Thursdays immediately afterschool!",
  },
  bam: {
    out: "src/pages/BamRegister.tsx",
    component: "BamRegister",
    fields: "bam_form_fields",
    regs: "bam_registrations",
    sameYear: "bam_same_year_matches",
    prefix: "bam",
    name: "BAM",
    programLabel: "BAM",
    districtLabel: "Cape May County Special Services",
    dismissalKey: null,
    bg: "#374151",
    submittedTitle: "Welcome to BAM!",
    submittedLine: "Keep up the great week &mdash; we&rsquo;ll see you Friday!",
  },
};

const build = (p) => {
  const src = "src/pages/Register.tsx";
  let s = fs.readFileSync(src, "utf8").replace(/\r\n/g, "\n");

  const must = (a, b, label) => {
    if (!s.includes(a)) { console.error(`MISS ${label} (${p.name})`); process.exit(1); }
    s = s.replace(a, b);
  };
  const mustAll = (a, b, label) => {
    if (!s.includes(a)) { console.error(`MISS ${label} (${p.name})`); process.exit(1); }
    s = s.split(a).join(b);
  };

  // ── Tables ──
  mustAll('.from("registration_form_fields")', `.from("${p.fields}" as never)`, "fields table");
  mustAll('supabase.from("youth_registrations")', `supabase.from("${p.regs}" as never)`, "registrations table");
  must('queryKey: ["registration-form-fields"]', `queryKey: ["${p.prefix}-form-fields"]`, "query key");

  // ── Component name ──
  must("const Register = () => {", `const ${p.component} = () => {`, "component name");
  must("export default Register;", `export default ${p.component};`, "export");

  // ── No summer-break banner on this form ──
  must('import SummerBreakBanner from "@/components/sections/SummerBreakBanner";\n', "", "banner import");
  must("      <SummerBreakBanner compact />\n", "", "banner use");

  // ── The waivers come only from the program's table; no NLA fallback. Each
  //    carries whether it is required, and its help text, so an optional
  //    waiver can say so. ──
  must('import { DEFAULT_WAIVERS } from "@/components/registration/waiverTexts";\n', "", "default waivers import");
  must(
    '  const waivers = dbWaivers.length > 0\n    ? dbWaivers.map((f) => ({ field_key: f.field_key, title: f.label, body: f.default_value || "" }))\n    : DEFAULT_WAIVERS;',
    '  const waivers = dbWaivers.map((f) => ({\n    field_key: f.field_key,\n    title: f.label,\n    body: f.default_value || "",\n    required: !!f.required,\n    help: f.help_text || "",\n  }));',
    "waivers derive"
  );

  // ── Storage paths carry the program's prefix so the files are distinguishable. ──
  must("const fileName = `${prefix}_${Date.now()}", `const fileName = \`${p.prefix}/\${prefix}_\${Date.now()}`, "signature path");
  must("const fileName = `headshot_${Date.now()}", `const fileName = \`${p.prefix}/headshot_\${Date.now()}`, "headshot path");

  // ── The duplicate check goes through a narrow RPC: anon cannot read the table. ──
  must(
    `      const { data, error } = await supabase\n        .from("youth_registrations")\n        .select("id, child_first_name, child_last_name, child_date_of_birth, parent_email, parent_phone, program_year")\n        .eq("program_year", currentPY)\n        .ilike("child_last_name", childLast);`,
    `      const { data, error } = await (supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(\n        "${p.sameYear}",\n        { _last_name: childLast, _program_year: currentPY }\n      );`,
    "duplicate check via rpc"
  );
  must(
    "      const rows = (data as unknown as Array<{\n        child_first_name: string | null; child_last_name: string | null; child_date_of_birth: string | null;\n        parent_email: string | null; parent_phone: string | null; program_year: string | null;\n      }>) || [];",
    "      const rows = (data as unknown as Array<{\n        child_first_name: string | null; child_last_name: string | null; child_date_of_birth: string | null;\n        parent_email: string | null; parent_phone: string | null;\n      }>) || [];",
    "duplicate rows type"
  );
  must("      if (error) throw error;\n\n      const rows =", "      if (error) throw error as Error;\n\n      const rows =", "duplicate error type");

  // ── Optional waivers: skip one that is untouched; a touched one must be complete. ──
  must(
    "    for (const w of waivers) {\n      if (!waiverAcks[w.field_key]) return `Please check the box to acknowledge the waiver: ${w.title}`;",
    "    for (const w of waivers) {\n      const touched = !!waiverAcks[w.field_key] || !!waiverSigs[w.field_key];\n      // An optional waiver: leave it entirely alone and it is simply not\n      // signed. Start it and it has to be finished.\n      if (!w.required && !touched) continue;\n      if (!waiverAcks[w.field_key]) return `Please check the box to acknowledge the waiver: ${w.title}`;",
    "optional waiver validation"
  );

  // ── Signed waivers only go into waivers_data. ──
  must(
    "      const waiverEntries = await Promise.all(waivers.map(async (w) => {",
    "      const signedWaivers = waivers.filter((w) => w.required || !!waiverSigs[w.field_key]);\n      const waiverEntries = await Promise.all(signedWaivers.map(async (w) => {",
    "signed waivers only"
  );

  // ── The insert payload: the program's columns, none of NLA's household maths. ──
  const payloadStart = s.indexOf("      // Build core fields payload.");
  const payloadEnd = s.indexOf("      // Collect custom fields (non-core)");
  if (payloadStart < 0 || payloadEnd < 0 || payloadEnd < payloadStart) { console.error("MISS payload span"); process.exit(1); }
  s = s.slice(0, payloadStart) + s.slice(payloadEnd);

  const insertStart = s.indexOf(`      const { error } = await (supabase.from("${p.regs}" as never) as any).insert({`);
  const insertEnd = s.indexOf("      if (error) throw error;\n      setIsSubmitted(true);");
  if (insertStart < 0 || insertEnd < 0 || insertEnd < insertStart) { console.error("MISS insert span"); process.exit(1); }
  const dismissal = p.dismissalKey
    ? `        // The optional dismissal waiver: signed or not is what the attendance\n        // board reads to decide whether "Dismissed" is even offered.\n        dismissal_waiver_signed_at: waiversData["${p.dismissalKey}"] ? new Date().toISOString() : null,\n`
    : `        // No dismissal choice in this program: the school moves the students.\n        dismissal_waiver_signed_at: null,\n`;
  const insert =
`      const { error } = await (supabase.from("${p.regs}" as never) as any).insert({
        submission_date: new Date().toISOString().split("T")[0],
        // Same program-year rules as NLA: rolls over 1 August by itself.
        program_year: getProgramYearForRegistration(),
        child_first_name: (formValues["child_first_name"] || "").trim(),
        child_last_name: (formValues["child_last_name"] || "").trim(),
        child_sex: formValues["child_sex"] || null,
        child_date_of_birth: formValues["child_date_of_birth"] || null,
        child_race_ethnicity: formValues["child_race_ethnicity"] || null,
        grade_level: formValues["grade_level"] || null,
        cte_program: formValues["cte_program"] || null,
        child_primary_address: (formValues["child_primary_address"] || "").trim() || null,
        // A picked address arrives with its pin; a typed one is geocoded later.
        latitude: addressPin?.lat ?? null,
        longitude: addressPin?.lng ?? null,
        geocoded_at: addressPin ? new Date().toISOString() : null,
        parent_first_name: (formValues["parent_first_name"] || "").trim(),
        parent_last_name: (formValues["parent_last_name"] || "").trim(),
        parent_phone: toE164(formValues["parent_phone"] || "") || (formValues["parent_phone"] || "").trim(),
        parent_email: (formValues["parent_email"] || "").trim(),
        free_or_reduced_lunch: formValues["free_or_reduced_lunch"] || null,
        has_allergies: formValues["has_allergies"] === "Yes" ? true : formValues["has_allergies"] === "No" ? false : null,
        // The list only when they answered Yes -- the field is hidden otherwise.
        allergies: formValues["has_allergies"] === "Yes" ? ((formValues["allergies"] || "").trim() || null) : null,
        has_asthma: formValues["has_asthma"] === "Yes" ? true : formValues["has_asthma"] === "No" ? false : null,
        // Inhaler details only when they answered Yes -- the field is hidden otherwise.
        asthma_inhaler_info: formValues["has_asthma"] === "Yes" ? ((formValues["asthma_inhaler_info"] || "").trim() || null) : null,
        important_child_notes: (formValues["important_child_notes"] || "").trim() || null,
        waivers_data: waiversData,
${dismissal}        child_headshot_url: headshotUrl,
        final_signature_name: (formValues["final_signature_name"] || "").trim(),
        custom_fields_data: Object.keys(customData).length > 0 ? customData : null,
      });

`;
  s = s.slice(0, insertStart) + insert + s.slice(insertEnd);

  // ── Words ──
  must('toast({ title: "Registration Submitted!", description: "Thank you for registering with NLA Youth Boxing." });',
       `toast({ title: "Registration Submitted!", description: "Thank you for registering for ${p.name}." });`, "toast");
  must("                {shortProgramYear(getProgramYearForRegistration())} Registration\n",
       `                {shortProgramYear(getProgramYearForRegistration())} ${p.name} Registration\n`, "title");
  must('<p className="text-muted-foreground text-sm">Must complete before participation at No Limits Academy.</p>',
       `<p className="text-muted-foreground text-sm">Must complete before participation in ${p.name} at No Limits Academy.</p>`, "subtitle");

  // ── The notification email: same function, labelled so it reads as this program. ──
  must('            child_boxing_program: formValues["child_boxing_program"],\n            child_school_district: formValues["child_school_district"],',
       `            child_boxing_program: "${p.programLabel}",\n            child_school_district: "${p.districtLabel}",`, "notification labels");

  // ── Each waiver shows its help line; an optional one shows no asterisks. ──
  must(
    "                  <div key={w.field_key} data-field-key={w.field_key} className=\"border-t pt-6\">\n                    <WaiverSection",
    "                  <div key={w.field_key} data-field-key={w.field_key} className=\"border-t pt-6\">\n                    {w.help && (\n                      <p className=\"text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3\">{w.help}</p>\n                    )}\n                    <WaiverSection",
    "waiver help line"
  );
  must(
    "                    <WaiverSection\n                      title={w.title}",
    "                    <WaiverSection\n                      required={w.required}\n                      title={w.title}",
    "waiver required prop"
  );

  // ── The submitted screen: a welcome, not NLA's practice hours. ──
  const doneStart = s.indexOf('              <div className="space-y-2">\n                <h1 className="text-3xl font-bold text-foreground">Registration Submitted</h1>');
  const doneEnd = s.indexOf('              <div className="pt-4">\n                <Button onClick={() => navigate("/")}');
  if (doneStart < 0 || doneEnd < 0 || doneEnd < doneStart) { console.error("MISS submitted screen span"); process.exit(1); }
  s = s.slice(0, doneStart) +
`              <div className="space-y-3">
                <h1 className="text-3xl font-bold text-foreground">${p.submittedTitle}</h1>
                <p className="text-xl text-foreground">${p.submittedLine}</p>
                <p className="text-base text-muted-foreground pt-2">
                  If you have any questions, please email{" "}
                  <a href="mailto:chrissycasiello@nolimitsboxingacademy.org" className="font-medium text-foreground underline">chrissycasiello@nolimitsboxingacademy.org</a>.
                </p>
              </div>
` + s.slice(doneEnd);

  // ── The program's colour behind the form (both the form and the submitted screen). ──
  mustAll('<div className="min-h-screen flex flex-col bg-background">',
          `<div className="min-h-screen flex flex-col bg-[${p.bg}]">`, "background");

  // ── Header comment ──
  s = s.replace(/^/, `// ${p.name} registration -- the public form at /${p.prefix}/register.
//
// GENERATED from the NLA form (Register.tsx) by scripts/make-program-register.mjs
// rather than written twice: the NLA form already does the things a good form
// does -- address confirmed as it is typed, phones and emails validated, the
// asthma and allergy gates, the photo upload, the signature pads, the
// same-year duplicate check -- and a second copy would drift. What differs is
// the tables it reads and writes, the title, the insert payload, the colour
// and the waivers.
//
// If the NLA form gains something this program should have too, edit
// Register.tsx and re-run the script; do not hand-edit this file.
`);

  fs.writeFileSync(p.out, s);
  console.log(`wrote ${p.out} (${s.split("\n").length} lines)`);
};

for (const p of Object.values(PROGRAMS)) build(p);
