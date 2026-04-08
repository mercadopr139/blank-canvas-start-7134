
# NLA Transportation Admin Panel

## Route Structure
- `/transport/admin` — Login page (email/password, allowlist-gated)
- `/transport/admin/dashboard` — Protected dashboard with sidebar nav
  - `/transport/admin/drivers` — Driver management (CRUD)
  - `/transport/admin/youth` — Youth profile management (CRUD with photo upload)
  - `/transport/admin/live-runs` — Real-time run monitoring
  - `/transport/admin/reports` — Daily/weekly reports + CSV export

## Authentication
- Reuse existing `AuthContext` and admin role check
- Only users with `admin` role can access (same as Command Center)
- Clean login page with NLA branding at `/transport/admin`

## Database Changes
- Enable realtime on `runs` and `transport_attendance` tables for live monitoring
- No new tables needed — all 6 transport tables already exist

## UI Architecture
- `TransportAdminLayout` — wrapper with sidebar (desktop) / bottom nav (mobile)
- Sidebar links: Drivers, Youth, Live Runs, Reports
- NLA brand: dark navy background, red accents, white text
- Mobile-first card layouts, desktop table views

## Components to Build
1. **TransportAdminLogin** — email/password login
2. **TransportAdminLayout** — sidebar + outlet
3. **TransportDrivers** — table + add/edit dialog
4. **TransportYouth** — card grid + add/edit dialog with photo upload
5. **TransportLiveRuns** — realtime run cards with attendance status
6. **TransportReports** — date pickers, summary tables, CSV export

## Implementation Order
1. Auth + Layout + Route wiring
2. Drivers CRUD
3. Youth Profiles CRUD
4. Live Runs view
5. Reports view
