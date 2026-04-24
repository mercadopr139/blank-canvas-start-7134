# No Limits Boxing Academy — Operations Platform

Full operational platform for No Limits Boxing Academy (a non-profit boxing academy): a public-facing website plus a comprehensive admin dashboard covering youth registrations, attendance, call-outs, transportation, meals, finance, CSBG grant management, and a CRM for supporters.

## Stack

- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Routing:** React Router v6
- **Data:** TanStack React Query
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions)
- **Hosting:** Vercel

## Local development

Requires Node.js and npm.

```sh
npm install
npm run dev      # starts dev server on port 8080
```

Other commands:

```sh
npm run build       # production build
npm run lint        # ESLint check
npm run test        # run tests once
npm run test:watch  # run tests in watch mode
```

## Deployment

The live site is hosted on Vercel and redeploys automatically on push to `main`.

## Supabase

- Project: `rkdkmzjontaufbyjbcku`
- Migrations live in `supabase/migrations/` — always add DB changes as a new migration file, never edit existing ones
- Types are auto-generated at `src/integrations/supabase/types.ts`
- Edge functions live in `supabase/functions/`; deploy with:
  ```sh
  npx supabase functions deploy <function-name> --project-ref rkdkmzjontaufbyjbcku
  ```
