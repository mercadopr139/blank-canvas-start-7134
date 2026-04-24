import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://rkdkmzjontaufbyjbcku.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OLD_SUPABASE_HOST = "qnjpurehimuqppyrfxui.supabase.co";

if (!SERVICE_ROLE_KEY) {
  console.error("Error: SUPABASE_SERVICE_ROLE_KEY not set");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: registrations, error: fetchError } = await supabase
  .from("youth_registrations")
  .select("id, child_first_name, child_last_name, child_headshot_url")
  .like("child_headshot_url", `%${OLD_SUPABASE_HOST}%`);

if (fetchError) {
  console.error("DB fetch failed:", fetchError.message);
  process.exit(1);
}

console.log(`Found ${registrations?.length ?? 0} registrations with old-host headshot URLs.`);

if (!registrations || registrations.length === 0) {
  process.exit(0);
}

const results = { migrated: 0, failed: 0, errors: [] };

for (const reg of registrations) {
  const label = `${reg.child_first_name} ${reg.child_last_name} (${reg.id})`;
  try {
    const res = await fetch(reg.child_headshot_url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      results.failed++;
      results.errors.push(`${label}: fetch failed (${res.status})`);
      continue;
    }

    const contentType = (res.headers.get("content-type") || "image/jpeg").toLowerCase();
    if (!contentType.startsWith("image/")) {
      results.failed++;
      results.errors.push(`${label}: not an image (${contentType})`);
      continue;
    }

    const imageData = await res.arrayBuffer();
    if (imageData.byteLength < 500) {
      results.failed++;
      results.errors.push(`${label}: file too small (${imageData.byteLength} bytes)`);
      continue;
    }

    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const fileName = `migrated_${reg.id}_${Date.now()}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("youth-photos")
      .upload(fileName, imageData, { contentType, upsert: false });

    if (uploadError) {
      results.failed++;
      results.errors.push(`${label}: upload failed — ${uploadError.message}`);
      continue;
    }

    const { error: updateError } = await supabase
      .from("youth_registrations")
      .update({ child_headshot_url: uploadData.path })
      .eq("id", reg.id);

    if (updateError) {
      results.failed++;
      results.errors.push(`${label}: db update failed — ${updateError.message}`);
      continue;
    }

    results.migrated++;
    if (results.migrated % 10 === 0) {
      console.log(`  …migrated ${results.migrated}/${registrations.length}`);
    }
  } catch (err) {
    results.failed++;
    results.errors.push(`${label}: ${String(err)}`);
  }
}

console.log(`\nDone. Migrated ${results.migrated}, failed ${results.failed}, total ${registrations.length}.`);
if (results.errors.length > 0) {
  console.log("\nErrors:");
  for (const e of results.errors) console.log("  " + e);
}
