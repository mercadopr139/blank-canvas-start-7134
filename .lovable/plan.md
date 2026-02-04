

## Add Two New Impact Stat Cards

### Overview
Add two new stat cards to the Impact page's stats section to highlight the boxing program participation and meal service.

### New Stats to Add

**Stat 1: Boxing Participation**
- Headline: "95%"
- Subtext: "Youth Participate in Non-Contact Boxing"
- Supporting line: "Safety-focused training and development"

**Stat 2: Meals Served**
- Headline: "Meals Served"
- Subtext: "Five Nights a Week"
- Supporting line: "September through June"

### Technical Implementation

**File to modify:** `src/pages/ImpactStory.tsx`

1. **Import additional icons** from lucide-react:
   - `Dumbbell` (or similar) for the boxing stat
   - `Utensils` for the meals stat

2. **Add new entries to the `stats` array:**
```tsx
const stats = [
  // ... existing 3 stats ...
  {
    icon: Dumbbell,
    value: "95%",
    label: "Youth Participate in Non-Contact Boxing",
    description: "Safety-focused training and development"
  },
  {
    icon: Utensils,
    value: "Meals Served",
    label: "Five Nights a Week",
    description: "September through June"
  }
];
```

3. **Update grid layout** to accommodate 5 cards:
   - Change from `md:grid-cols-3` to a responsive layout that works for 5 items
   - Options:
     - Row 1: 3 cards, Row 2: 2 cards centered
     - Use `md:grid-cols-5` with smaller cards
   - Recommended: Keep 3-column grid but let the 4th and 5th cards naturally wrap to a second row, centered

4. **Adjust grid centering** for the second row:
   - Add flexbox wrapper or use CSS to center the bottom row of 2 cards
   - Alternative: Use `justify-items-center` with specific column spans

### Visual Consistency
- Same `Card` and `CardContent` components
- Same padding (`p-8`), text alignment (`text-center`)
- Same typography hierarchy:
  - Value: `text-4xl md:text-5xl font-black`
  - Label: `text-lg font-bold`
  - Description: `text-sm text-muted-foreground`
- Same icon sizing: `h-10 w-10`
- Same border styling: `border-2 border-foreground/10 hover:border-foreground/20`

### Layout Approach
To keep the bottom 2 cards visually centered under the top 3, I'll render the stats in two groups:
- First row: 3 cards in a 3-column grid
- Second row: 2 cards centered using flexbox

This ensures a balanced, professional appearance.

