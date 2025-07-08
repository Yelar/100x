# NeonDB Postgres Setup Guide

This project now uses **PostgreSQL on NeonDB** (instead of MongoDB Atlas) via Prisma ORM.

## 1. Create & Configure a Neon Project

1. Sign-up / login at <https://neon.tech>.
2. Click **New Project** → choose a project name & region.
3. Once provisioned, open the **Connection Details** panel and copy the **`postgres`** connection string. It looks like:
   ```
   postgres://<user>:<password>@<hostname>/<database>?sslmode=require
   ```
4. (Optional) Create additional branches or roles if you need multiple environments.

## 2. Add the connection string to the project

Create (or update) an **`.env.local`** file in the repo root:

```bash
# Neon Postgres
DATABASE_URL="postgres://<user>:<password>@<hostname>/<database>?sslmode=require"
```

> Do **NOT** commit this file – it contains credentials.

For production (e.g. Vercel) add the same `DATABASE_URL` variable in the dashboard → **Project Settings → Environment Variables**.

## 3. Install & Generate Prisma Client

Dependencies are already listed in `package.json` (`prisma` & `@prisma/client`). Run:

```bash
pnpm install           # or npm / yarn
npx prisma generate    # generates the typed client
```

## 4. Run the initial migration

Prisma schema lives in `prisma/schema.prisma`.
To create the tables on Neon:

```bash
npx prisma migrate dev --name init
```

If you are on CI / production use:

```bash
npx prisma migrate deploy
```

## 5. Verify everything works

```bash
npm run dev            # start Next.js locally
```

- Sign-in with Google → a **`User`** row should appear in Neon.
- Open the email chat → `ChatUsage` rows should increment.
- Add yourself to the waitlist → a **`Waitlist`** row should appear.

## 6. Removing MongoDB

Once the application works end-to-end you can safely:

1. Delete the `src/lib/mongodb.ts` file and the `models/` directory.
2. Remove the **MONGODB_URI** variable from your environment.
3. Delete the MongoDB Atlas cluster (optional).

---

Happy hacking! 🚀 