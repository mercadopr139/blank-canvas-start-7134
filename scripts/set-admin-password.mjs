/**
 * One-time script to set the admin password directly via Supabase Admin API.
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<your-key> node scripts/set-admin-password.mjs <newpassword>
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://rkdkmzjontaufbyjbcku.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPAPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const USER_ID = "d0366abb-c391-4369-9be0-c8ad56c1ec45"; // joshmercado@nolimitsboxingacademy.org

const newPassword = process.argv[2];

if (!newPassword) {
  console.error("Usage: SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/set-admin-password.mjs <newpassword>");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error("Error: SUPABASE_SERVICE_ROLE_KEY environment variable is not set.");
  process.exit(1);
}
if (newPassword.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await supabase.auth.admin.updateUserById(USER_ID, { password: newPassword });

if (error) {
  console.error("Failed:", error.message);
  process.exit(1);
}

console.log(`✅ Password updated for ${data.user.email}`);
console.log("You can now log in at https://www.nolimitsboxingacademy.org/admin/login");
