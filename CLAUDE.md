# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server on port 8080
npm run build      # Production build
npm run lint       # ESLint check
npm run test       # Run tests once
npm run test:watch # Run tests in watch mode
```

## What This App Is

A full operational platform for **No Limits Boxing Academy** — a non-profit boxing academy. It has a public-facing website and a comprehensive admin dashboard covering youth registrations, attendance, call-outs, transportation, meals, finance, CSBG grant management, and a CRM for supporters.

**Stack:** React 18 + TypeScript, Vite, Tailwind CSS, Shadcn/ui, React Router v6, TanStack React Query, Supabase (Postgres + Auth + Storage), Vercel hosting.

## Architecture

**No backend API layer.** The frontend calls Supabase directly via the JS client (`src/integrations/supabase/client.ts`). All business logic lives in React components or Supabase RPC functions.

**Auth flow:**
- Supabase email/password auth, session in localStorage
- `AuthContext` (`src/contexts/AuthContext.tsx`) wraps the entire app
- Admin access checked against the `user_roles` table
- Super-admin is hardcoded email match: `joshmercado@nolimitsboxingacademy.org`
- Fine-grained staff permissions via `staff_permissions` table, accessed through `useStaffPermissions()` hook

**Routing structure:**
- Public pages: `/`, `/register`, `/call-out`, `/check-in`, `/supporters`, etc.
- Admin protected by `ProtectedRoute` component
- Three admin sections each use a sidebar layout pattern:
  - `/admin/operations` → `AdminOperations.tsx` wraps child routes
  - `/admin/sales-marketing` → `AdminSalesMarketing.tsx` wraps child routes
  - `/admin/finance` → `AdminFinance.tsx` wraps child routes
- Transport module lives separately at `/transport` and `/transport/admin`

**Data pattern:** `useQuery` / `useMutation` from React Query for all async data. Forms use React Hook Form + Zod validation.

## Key Supabase Details

- Types are auto-generated at `src/integrations/supabase/types.ts` — use `Tables<'table_name'>` for row types
- RPC functions are used for secure kiosk searches (e.g. `search_kiosk_youth`, `search_lil_champs_youth`) — these use `SECURITY DEFINER` and are callable by `anon`
- Youth only appear in kiosk searches when `approved_for_attendance = true` on their `youth_registrations` row
- Migrations live in `supabase/migrations/` — always add new DB changes as a new migration file, never edit existing ones
- **Applying migrations:** the Supabase CLI is installed, authenticated, and linked to the **NLA Production** project (`rkdkmzjontaufbyjbcku`), and migration history is baselined/synced. Apply new migrations with **`npx supabase db push`** — no more manual paste into the SQL Editor. Show the migration for review before pushing to production.

## Brand & Styling

- NLA Red: `#bf0f3e` (used for primary buttons and accents)
- Dark theme throughout — `bg-black`, `bg-neutral-900`, `bg-neutral-800` are the standard backgrounds
- Shadcn components are in `src/components/ui/` — treat as read-only, don't modify them directly
- All custom admin components follow naming: `Admin[Feature].tsx` for pages, `[Feature]Modal.tsx` or `[Feature]Sheet.tsx` for overlays
