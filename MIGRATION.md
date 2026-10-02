# Migrating NishmatMenashe Library to Supabase (remove Python + MongoDB)

This replaces the entire FastAPI + MongoDB backend with Supabase.
After the migration: **no backend server to host, no MongoDB to manage** —
the Expo frontend talks directly to Supabase (Postgres + Auth + RLS).

---

## Step 1 — Create a Supabase project

1. Go to https://supabase.com → **New project** (free tier is fine)
2. Note down your **Project URL** and **anon public key**:
   `Project Settings → API`

## Step 2 — Create the database

1. Open `supabase/schema.sql` from this zip
2. In Supabase: **SQL Editor → New query → paste → Run**
3. This creates all tables, indexes, search + analytics functions,
   Row Level Security policies, auto-count triggers, and your seed data
   (8 categories, 5 books, 12 chapters, 17 verses)

## Step 3 — Enable Google login

Supabase Dashboard → **Authentication → Providers → Google → Enable**:

1. Create Google OAuth credentials at
   https://console.cloud.google.com/apis/credentials (OAuth client ID, Web type)
2. Add to **Authorized redirect URIs** in Google Console:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
3. Paste your Google **Client ID** and **Client Secret** into the Supabase
   Google provider settings and save.

> The old Emergent OAuth (`auth.emergentagent.com`) is no longer used —
> everything goes through Supabase Auth now.
> The admin email (`tzurielsingson@gmail.com`) is auto-promoted to the
> `admin` role by the signup trigger in the schema.

## Step 4 — Update the frontend

```bash
cd frontend

# 1. New dependencies (replaces the need for a backend)
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage

# 2. Update .env — remove the old backend URL, add:
#    EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
#    EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# 3. Copy the new files from this zip:
#    src/lib/supabase.ts          (new)
#    src/api/client.ts            (replaces old client)
#    src/contexts/AuthContext.tsx (replaces old auth)
```

All screens (`search.tsx`, `bookmarks.tsx`, `chapter/[id].tsx`,
`book/[id].tsx`, `(tabs)/index.tsx`, everything in `app/admin/`) work
**unchanged** — the new `client.ts` routes their `apiClient.get('/api/...')`
calls to Supabase behind the scenes.

## Step 5 — Delete the old backend

```bash
rm -rf backend
```

You can also delete `backend_test.py`, `test_reports/`, and the
`EXPO_PUBLIC_BACKEND_URL` env var. (Keep them in git history if you want
a rollback path.)

## Step 6 — Run

```bash
npx expo start
# press 'w' for web, or scan the QR with Expo Go
```

Sign in with Google → you should land in the Library with the seeded
categories. Sign in with the admin email to see the Admin dashboard.

---

## What maps to what

| Old (FastAPI + MongoDB)            | New (Supabase)                              |
|------------------------------------|---------------------------------------------|
| `POST /api/auth/session`           | `supabase.auth.signInWithOAuth` + auto profile trigger |
| `GET /api/auth/me`                 | `supabase.auth.getSession` / `onAuthStateChange` |
| MongoDB collections                | Postgres tables (`categories`, `books`, `chapters`, `verses`, `bookmarks`, `profiles`) |
| `get_current_user` / `require_admin` | RLS policies + `is_admin()` function        |
| `GET /api/search` (Mongo $text)    | `search_verses()` RPC (Postgres FTS + Hebrew `ilike`) |
| `GET /api/admin/analytics`         | `admin_analytics()` RPC                     |
| Manual count recompute in Python   | DB triggers (`sync_book_count`, `sync_chapter_count`) |
| Cascade deletes in Python          | FK `on delete cascade`                      |
| Session collection + TTL index     | Supabase Auth (auto refresh, built-in)      |

## Notes

- **Security**: RLS enforces that bookmarks are private per user and only
  admins can modify library content — the old backend's guards, now in the DB.
- **Search**: English uses full-text search; Hebrew uses substring matching.
  For better Hebrew search later, consider the `pg_trgm` extension.
- **Existing data**: if your MongoDB has real content beyond the seed data,
  export it to JSON and `insert` it into the matching tables — column names
  are identical to the old document fields.
