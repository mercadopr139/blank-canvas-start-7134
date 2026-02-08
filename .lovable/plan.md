
# Plan: Link "Gym Buddies" in Programs Page to the Dedicated Gym Buddies Page

## Summary
The "More Programs at NLA" section on the Programs page currently shows "Gym Buddies" as a clickable item that opens a modal with content. You want to remove this modal content and instead have the "Gym Buddies" link navigate directly to the dedicated `/gym-buddies` page (the same page accessible from the homepage navigation).

## Changes Required

### 1. Update `ProgramsExtrasSection.tsx`

**What we'll do:**
- Remove "Gym Buddies" from the `items` array (since it no longer needs modal content)
- Change the "Gym Buddies" list item from a button that opens a modal to a link that navigates to `/gym-buddies`

**Technical approach:**
- Keep the bullet list format consistent with other items
- Use React Router's `Link` component to navigate to `/gym-buddies`
- The link will have the same styling as other items (underlined, clickable text)

### 2. Cleanup Gym Buddies Image Imports

**What we'll do:**
- Remove all the Gym Buddies image imports from `ProgramsExtrasSection.tsx` since they're no longer needed in this component
- Remove the `gymBuddiesImages` array from this component

This cleanup will reduce the component's bundle size since all those images are already imported in the dedicated `/gym-buddies` page.

---

## Before & After

**Before (clicking "Gym Buddies" in More Programs):**
- Opens a modal with description and photo gallery

**After (clicking "Gym Buddies" in More Programs):**
- Navigates directly to `/gym-buddies` page (same as the homepage Gym Buddies link)

---

## Technical Details

### File: `src/components/sections/ProgramsExtrasSection.tsx`

1. Add `Link` import from `react-router-dom`
2. Remove all Gym Buddies image imports (lines 24-59)
3. Remove the `gymBuddiesImages` array (lines 86-123)
4. Remove the "gym-buddies" object from the `items` array (lines 190-199)
5. Add a separate "Gym Buddies" entry in the list that uses a `Link` instead of a button:

```tsx
{/* Gym Buddies - links to dedicated page */}
<li className="flex items-start gap-3">
  <span className="mt-2.5 h-2 w-2 rounded-full bg-foreground flex-shrink-0" />
  <Link
    to="/gym-buddies"
    className="text-left text-lg font-medium text-foreground underline underline-offset-4 hover:text-foreground/80 transition-colors"
  >
    Gym Buddies
  </Link>
</li>
```

The list will maintain alphabetical order:
1. Dental Dental's Smile Lab Program
2. Excursions
3. **Gym Buddies** → (Link to /gym-buddies)
4. NJ4S Lil' Champs Program
5. Real Talk Sessions
6. Spiritual Development
7. The Launch Pad

