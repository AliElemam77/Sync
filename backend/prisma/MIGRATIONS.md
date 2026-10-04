# Database migrations

Schema changes are applied with **Prisma Migrate**. Every change is a folder in `prisma/migrations/`,
committed to git, and applied in order by `npm run prisma:deploy` (`prisma migrate deploy`).

- `0_init` is the baseline: the whole schema as it existed before migrations were tracked
  (earlier tables were created with `db push`, so the old migration history was incomplete).
- Later folders change the schema step by step and may include one-off data updates.

## Existing database (one time only)

The tables already exist, so the baseline must be marked as applied instead of executed.
Take a backup first, then from `backend/`:

```bash
# 1) Read-only check: prints nothing when the database matches the baseline
git show bff0ffd:backend/prisma/schema.prisma > baseline.prisma
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel baseline.prisma --script

# 2) Record the baseline as applied (does not modify any table)
npx prisma migrate resolve --applied 0_init

# 3) Apply everything after the baseline
npm run prisma:deploy

# 4) Regenerate the client (on Windows, stop the running backend first)
npx prisma generate
```

If step 1 prints SQL, the database differs from the baseline: stop and review before continuing.

## New database

```bash
npm run prisma:deploy
npm run prisma:seed
```

## Changing the schema

Edit `schema.prisma`, then create a migration against a local or development database
(never production):

```bash
npx prisma migrate dev --name short_description
```

Deploy code and migration together: the code expects the columns the migration creates.
