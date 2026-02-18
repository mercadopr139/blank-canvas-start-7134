

# Dark Theme for All Command Center Pages

## Overview
Apply the Command Center's black background and pillar-specific color theming across every admin page. Each page will inherit the accent color of its parent pillar so users can instantly associate which section they're in.

## Color Mapping

| Pillar | Accent Color | Used For |
|--------|-------------|----------|
| Operations | NLA Red (`#bf0f3e`) | Borders, icons, accent text, active states |
| Sales & Marketing | Green (`green-500`) | Borders, icons, accent text |
| Finance | Sky Blue (`sky-300`) | Borders, icons, accent text |

## Pages to Update

### 1. Pillar Landing Pages (3 files)
**AdminOperations.tsx** - Black background, red-accented cards with red borders, white text
**AdminSalesMarketing.tsx** - Black background, green-accented icon and "Coming Soon" text
**AdminFinance.tsx** - Black background, sky-blue-accented cards with sky-blue borders, white text

### 2. Operations Sub-Pages (2 files)
**AdminRegistrations.tsx** - Black background, red accent on header icon, white text on tables/cards
**AdminRegistrationAnalytics.tsx** - Black background, red accent on stat cards and chart containers, white text

### 3. Finance Sub-Pages (3 files)
**AdminInvoices.tsx** - Black background, sky-blue accent on header icon, white text on tables/cards/controls
**AdminServiceCalendar.tsx** - Black background, sky-blue accent on calendar elements, white text
**AdminClients.tsx** - Black background, sky-blue accent on header icon, white text on tables

### 4. Login Page (1 file)
**AdminLogin.tsx** - Black background to match the overall Command Center feel

## What Changes Per Page

Each page will receive the same pattern of changes:

- **Outer wrapper**: `bg-muted/30` becomes `bg-black text-white`
- **Header**: `bg-background border-b border-border` becomes `bg-black border-b border-white/10`
- **Header text**: `text-foreground` becomes `text-white`, `text-muted-foreground` becomes `text-white/50`
- **Back button and Log out button**: Ghost/outline styles updated with white text and black background hover states
- **Cards**: `bg-background` becomes `bg-white/5 border-white/10 text-white` (or pillar-colored borders on landing pages)
- **Tables**: Background becomes `bg-white/5`, header text `text-white/70`, row text `text-white`, borders `border-white/10`
- **Inputs/Selects**: Dark-styled with `bg-white/5 border-white/10 text-white`
- **Badges**: Adjusted for dark background contrast
- **Muted text**: `text-muted-foreground` becomes `text-white/50`
- **Accent links/text**: Uses the pillar color (red for Operations pages, sky-blue for Finance pages)
- **Pillar landing page cards**: Get `border-2` with the pillar accent color, matching the Dashboard card style

## Technical Details

- All changes are CSS class swaps only -- no logic or data changes
- 9 files total will be edited
- Modal dialogs (AlertDialog, Dialog, ClientFormDialog, ServiceEntryModal) will keep their default styling since they overlay the page and have their own contained styles
- Chart colors in AdminRegistrationAnalytics will be adjusted for visibility on dark backgrounds
