# Prisma migrations — kaise kaam karta hai

**Status:** baseline set up (2026-11-16). Local DB par 13 tables, data intact.

## Ek nazar me

| Cheez | Kahan |
|---|---|
| Schema | `backend/prisma/schema.prisma` (source of truth) |
| Migrations | `backend/prisma/migrations/` (**git me commit hoti hai**) |
| Baseline | `20261116120000_baseline/` — poora 13-table schema ek file me |
| Config | `backend/prisma.config.ts` (Prisma 7 me `DATABASE_URL` yahan se aata hai) |
| Applied records | DB ki `_prisma_migrations` table |

## Roz ka kaam (local dev)

Schema change karne ke baad **yahi ek command**:

```bash
cd backend
npx prisma migrate dev --name add_something
```

Ye teen kaam karta hai:
1. `prisma/migrations/<timestamp>_add_something/migration.sql` banata hai
2. Local DB par apply karta hai
3. Prisma client regenerate karta hai

> ⚠️ `prisma db push` **mat** use karo ab. Wo migration history ko bypass karta hai
> aur Supabase/production par data risk paida karta hai. Sirf migration use karo.

## Supabase (production) par push

**Pehli baar** (jab Supabase project bana lo):

```bash
cd backend
DATABASE_URL="postgresql://...@...supabase.com:5432/postgres?sslmode=require" \
  npx prisma migrate deploy
```

`migrate deploy` **sirf pending migrations** apply karta hai — koi data drop nahi,
koi prompt nahi. Yehi production ka safe command hai.

**Har baad ki baar** (jab naya migration banao):

```bash
# 1. local par banao + test karo
npx prisma migrate dev --name describe_change

# 2. commit karo
git add prisma/migrations && git commit -m "db: describe_change"

# 3. deploy karo
DATABASE_URL="<supabase>" npx prisma migrate deploy
```

## Kya NAHI karna

| ❌ Galti | Kyun kharab |
|---|---|
| `prisma db push` production par | Migration history bypass, schema drift, data loss risk |
| `prisma migrate reset` local ke alawa | **Poora DB wipe** — data gaya |
| Migration file manually edit karna | Checksum fail hoga, `migrate deploy` refuse karega |
| `migrations/` ko gitignore karna | Production par migration history hi nahi rahegi |

## Agar kuch galat ho jaye

### Local data ka backup
```bash
docker exec ff-postgres sh -c 'pg_dump -U postgres -d freefire_tournament > /tmp/b.sql'
docker cp ff-postgres:/tmp/b.sql .tmp/dbbackup/manual-$(date +%Y%m%d).sql
```

### Migration failed (local)
```bash
npx prisma migrate resolve --rolled-back <migration_name>
# phir migration.sql fix karo aur dobara chalao
```

### "Database schema is up to date" par data missing
```bash
npx prisma migrate status     # kya pending hai
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

## Baseline kaise bana tha (history)

Local DB pehle se `db push` se bani thi, migrations folder nahi tha. Safe tareeka:

```bash
# 1. schema se SQL generate (DB touch nahi hua)
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script \
  > prisma/migrations/20261116120000_baseline/migration.sql

# 2. local DB par "already applied" mark karo (data bilkul nahi chhua)
npx prisma migrate resolve --applied 20261116120000_baseline

# 3. verify
npx prisma migrate status   # → "Database schema is up to date!"
```

Isse purana data safe raha aur future me clean migrations mil gayi.
