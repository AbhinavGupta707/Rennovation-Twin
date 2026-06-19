# RenovationTwin Deployment Readiness

## Persistent Store

Local development defaults to the JSON file store at `.renovation-twin-store/project-store.json`.
For Vercel or any serverless deployment, use the Prisma-backed store so projects, share
tokens, screenshots, report exports, and events survive across requests.

Required production env:

```bash
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
RENOVATION_TWIN_STORE_ADAPTER="prisma"
NEXT_PUBLIC_APP_URL="https://your-deployment.example"
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
```

Recommended setup before deploy:

```bash
pnpm db:generate
pnpm db:validate
pnpm supabase:db:push
```

The Prisma adapter stores the complete `ProjectRecord` in `Project.stateJson` while also
mirroring key query fields such as title, status, share token, plan image URL, scale, and
event logs. This keeps the app deployable quickly while preserving the existing local JSON
fallback and shared product contracts.

Use `/api/health/persistence` after deploy to prove the active store can read from the
configured adapter. With `RENOVATION_TWIN_STORE_ADAPTER="prisma"`, a `200` response means
the app has reached Supabase/Postgres; a `503` response means the database URL, pooler,
schema, or Prisma client needs attention.

## Supabase Hosted Setup

1. Create a hosted Supabase project.
2. In Supabase, create a dedicated database role for Prisma instead of using the default
   superuser for the deployed web app. Use
   `docs/supabase-prisma-role.sql` as the SQL Editor template and replace the password.
3. Copy the Supavisor transaction pooler URI for the deployed app `DATABASE_URL`.
   This is the serverless-safe connection string, usually on port `6543`.
4. Copy the Supavisor session pooler or direct database URI for `DIRECT_URL`.
   This is for Prisma CLI/schema operations, usually on port `5432`.
5. Link the local folder:

```bash
supabase login
supabase link --project-ref <project-ref>
```

6. Push the committed SQL migration:

```bash
pnpm supabase:db:push
pnpm db:generate
```

7. Set the Vercel env vars listed above, plus optional `FIREWORKS_API_KEY`,
   `NOVUS_API_KEY`, and `NOVUS_APP_ID`.
8. Deploy, then smoke test:

```bash
curl https://<deployment>/api/health/persistence
```

If the app only uses Prisma and not Supabase's public Data API, turn off the Data API in
Supabase API Settings. If you leave it enabled, keep RenovationTwin data behind the
server-side Prisma role and do not query these tables directly from the browser.

## Remaining Production Notes

- Store captured screenshots as database JSON for the hackathon path; object storage is a
  later hardening step.
- Keep `RENOVATION_TWIN_STORE_ADAPTER="json-file"` only for local development or demos that
  do not need serverless persistence.
- Fireworks remains optional because deterministic variants are still the fallback.
