

## What We're Doing

Removing the "Revenue Stream" dropdown from the **Edit Supporter Info** panel inside the Revenue modal. The main "Revenue Type" dropdown on the Revenue form stays exactly as-is.

## Will This Affect Other Tables?

**No.** Here's why:

- The "Revenue Stream" field in the supporter info section writes to the `supporters` table column called `primary_revenue_stream`. It's a profile-level label on the supporter -- it does NOT affect the revenue entry itself.
- The "Revenue Type" on the main form writes to the `revenue` table column `revenue_type`. This is what actually categorizes each transaction.
- Removing the dropdown from this modal simply means you won't accidentally overwrite the supporter's profile-level revenue stream while logging a transaction. You can still edit it from the Supporters Database page.
- No database changes needed.

## Changes

**File: `src/pages/admin/AdminRevenue.tsx`**

1. Remove the "Revenue Stream" `<Select>` block (lines 566-578) from the supporter details card.
2. Rearrange the remaining grid items (Category, Status, Relationship Owner) into a clean layout.
3. Remove the `PRIMARY_STREAMS` constant since it won't be used anywhere else in this file.
4. Exclude `primary_revenue_stream` from the supporter save/update logic so the existing value on the supporter record is preserved (not overwritten with blank).

