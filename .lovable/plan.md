

## Sync "Add Supporter" Modal with "Edit Supporter Info"

Both forms write to the same supporters table, so they need identical field labels and dropdown options.

### Changes to `src/pages/admin/AdminSupportersDatabase.tsx`

1. **Update `SUPPORTER_STATUSES`** from `["Active", "Prospect", "Lapsed", "Past"]` to `["Donor", "Sponsor", "Meal Train", "Partner", "Advocate", "Volunteer", "Coach"]`

2. **Rename the "Status" label** to "Supporter ID" to match the Revenue page

3. **Update `PRIMARY_REVENUE_STREAMS`** -- remove "Mixed" so it matches Revenue page: `["Donation", "Sponsorship", "Fee for Service", "Re-Grant"]`

### Verify in `src/pages/admin/AdminRevenue.tsx`

4. Confirm the Revenue Stream field was removed from Edit Supporter Info (per earlier plan). If it's still there, remove it so the two forms stay consistent -- you previously asked for it to be removed.

5. Confirm `SUPPORTER_STATUSES` is `["Donor", "Sponsor", "Meal Train", "Partner", "Advocate", "Volunteer", "Coach"]` (per earlier edit).

### No database changes needed
Both forms write to the same `supporters` table columns (`status`, `primary_revenue_stream`, etc.) as plain text -- no enum constraints in the database. So updating the frontend dropdown options is all that's needed.

### Technical Details

- **File 1** (`AdminSupportersDatabase.tsx`):
  - Line 38: Change `SUPPORTER_STATUSES` constant
  - Line 37: Remove "Mixed" from `PRIMARY_REVENUE_STREAMS`
  - Line 753: Change label from "Status" to "Supporter ID"

- **File 2** (`AdminRevenue.tsx`):
  - Verify lines 53, 567-578, 580 reflect the earlier approved changes (Status options + label rename + Revenue Stream removal)

