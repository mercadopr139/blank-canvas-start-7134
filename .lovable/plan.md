

# Plan: Replace Monday.com Registration Form with Internal Form

## Current Assessment

**Understanding Your Request**
Yes, I understand perfectly. You currently have two registration flows:
1. **External**: Monday.com form embedded on your public website (wkf.ms/45C6tce) that collects data into Monday.com
2. **Internal**: Your own `/register` form built in this codebase that saves data directly to your database

You want to **replace the Monday.com link** with a link to your own internal `/register` form.

**Are You Ready?**

**✅ YES - Your system is production-ready**

Evidence:
- **22 active form fields** configured in `registration_form_fields` table
- **398 approved youth registrations** already in the system
- **Photo upload feature** working with real-time sync
- **Attendance kiosk integration** already using the internal registration data
- **Form builder UI** at `/admin/form-builder` for easy field management
- **All 6 required waivers** with signature capture fully implemented
- **Validation system** with phone (E.164), email, address (OpenStreetMap)
- **Admin approval workflow** already operational

## Implementation Plan

### What Needs to Change

**Frontend Updates:**
1. Update `ProgramsSection.tsx` - Replace Monday.com link in SIGN-UP buttons
2. Update `ChatWidget.tsx` - Replace registration form link
3. Update memory references to reflect the new flow

**Links to Update:**
- Junior Boxing signup button (line 117)
- Senior Boxing signup button (line 169)  
- Chat widget registration link (line 49)

All currently point to: `https://wkf.ms/45C6tce`
Will change to: Internal route `/register`

### Migration Considerations

**Data Continuity:**
- Your existing 398 youth records remain intact
- Admin team continues using the Registrations page (`/admin/operations/registrations`)
- Monday.com import tools remain available for any legacy data
- Photo sync from Monday.com boards still accessible if needed

**No Database Changes Required:**
- Registration schema is already complete
- All RLS policies are production-ready
- Storage buckets properly configured
- Triggers and functions operational

### Testing Checklist Before Going Live

**Recommended Validation Steps:**
1. Submit a test registration through `/register` on preview
2. Verify it appears in Admin Registrations with "REVIEW" badge
3. Approve the test registration
4. Check photo upload works from kiosk
5. Verify attendance check-in with new registration
6. Test form builder to ensure field changes reflect on live form

### Post-Migration Benefits

**What You Gain:**
- **Real-time data**: No Monday.com sync delays
- **Full control**: Customize fields instantly via Form Builder
- **Better UX**: Mobile-optimized with camera capture
- **Cost savings**: One less external service dependency
- **Data ownership**: Everything in your own database

**What You Keep:**
- All existing registrations
- Monday.com import capability (for legacy or batch imports)
- Photo sync tools (if needed for existing Monday.com data)

### Rollback Strategy

If you need to revert:
- Simply change the links back to Monday.com URL
- No data loss since both systems remain operational
- Forms can coexist during transition period

## Recommended Approach

**Soft Launch Option:**
Add BOTH links temporarily:
- Primary button: "Register Online" → `/register`
- Secondary link: "Legacy Form" → Monday.com

This allows:
- Testing with real users before full cutover
- Gradual migration without breaking existing workflows
- Comparison of data quality between systems

**Full Cutover Option:**
Replace all Monday.com links immediately with `/register`

## Technical Details

**Files to Edit:**
```
src/components/sections/ProgramsSection.tsx (lines 117, 169)
src/components/contact/ChatWidget.tsx (line 49-50)
```

**Change Pattern:**
```tsx
// FROM:
<a href="https://wkf.ms/45C6tce" target="_blank" rel="noopener noreferrer">
  SIGN-UP
</a>

// TO:
<Link to="/register">
  SIGN-UP
</Link>
```

No backend, database, or configuration changes required.

