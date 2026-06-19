# RenovationTwin Deployment Readiness

## Persistent Store

Local development defaults to the JSON file store at `.renovation-twin-store/project-store.json`.
For Vercel or any serverless deployment, use the Prisma-backed store so projects, share
tokens, screenshots, report exports, and events survive across requests.

Required production env:

```bash
DATABASE_URL="postgresql://..."
RENOVATION_TWIN_STORE_ADAPTER="prisma"
NEXT_PUBLIC_APP_URL="https://your-deployment.example"
```

Recommended setup before deploy:

```bash
pnpm db:generate
pnpm --filter @renovation-twin/db prisma db push
```

The Prisma adapter stores the complete `ProjectRecord` in `Project.stateJson` while also
mirroring key query fields such as title, status, share token, plan image URL, scale, and
event logs. This keeps the app deployable quickly while preserving the existing local JSON
fallback and shared product contracts.

## Remaining Production Notes

- Store captured screenshots as database JSON for the hackathon path; object storage is a
  later hardening step.
- Keep `RENOVATION_TWIN_STORE_ADAPTER="json-file"` only for local development or demos that
  do not need serverless persistence.
- Fireworks remains optional because deterministic variants are still the fallback.
