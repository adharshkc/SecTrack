# SecTrack.io — Cybersecurity Learning Tracker

A production-ready, single-user, serverless Next.js (App Router + strict TypeScript) web application for planning, studying, and tracking your cybersecurity journey across **daily**, **weekly**, and **monthly** horizons using the [itshahirx Cybersecurity Mastery Roadmap](https://www.itshahirx.com/roadmap) (5 Phases, 12 Sections, 36 Primary Topics, 160 Trackable Subtopics, and 200+ curated resources).

---

## 1. Architecture Summary

- **Frontend**: Next.js App Router, React 19, TypeScript (`strict: true`), Tailwind CSS, accessible shadcn/ui-style primitives, Lucide icons, and Recharts visualizations.
- **Backend**: Serverless Next.js Route Handlers (`src/app/api/**`) — zero dedicated Node/Express servers, background workers, or external paid APIs.
- **Persistence**:
  - **Primary Serverless Store (Vercel + Firebase)**: Firebase Cloud Firestore via `firebase-admin/firestore` (`src/lib/storage/firestore-repo.ts`) storing user-scoped collections under `users/{userId}/{topics,studySessions,completionEvents,goals,reflections,settings}`. Firebase is used for storage only.
  - **Local / Self-Hosted SQL Fallback**: Drizzle ORM + PostgreSQL (`src/lib/storage/postgres-repo.ts`) automatically selected when `DATABASE_URL` is configured and Firebase Admin credentials are omitted.
- **Authentication & Application Security**:
  - **Password Login (only auth method)**: Server-only `APP_PASSWORD_HASH` (`crypto.scrypt` KDF, `N=16384, r=8, p=1, keylen=64` with `crypto.timingSafeEqual`) + `APP_SESSION_SECRET`. Plain SHA-256 hashes are rejected by default. No Firebase Authentication is used.
  - **Session & Request Hardening**: `HttpOnly`, `SameSite=Lax`, `Secure` (in production) HMAC-signed session cookies backed by revocable server session records, constant-time `X-CSRF-Token` + `Origin`/`Host` verification on all state-changing requests, and shared DB-backed IP login rate limiting (five attempts per 15 minutes).

---

## 2. Firebase Firestore Storage Setup (optional)

1. Open the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. **Enable Firestore**:
   - Navigate to **Build → Firestore Database → Create database** (Production mode).
   - Deploy security rules and composite indexes using the Firebase CLI:
     ```bash
     firebase deploy --only firestore:rules,firestore:indexes
     ```
3. **Generate Service Account Credentials** *(Server-Only)*:
   - Go to **Project Settings → Service accounts → Generate new private key**.
   - Copy `project_id`, `client_email`, and `private_key` into `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` (never commit the JSON file).

---

## 3. Environment Configuration

Copy `.env.example` to `.env.local` for local development:

```bash
cp .env.example .env.local
```

- **Never** prefix `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, `APP_PASSWORD_HASH`, or `APP_SESSION_SECRET` with `NEXT_PUBLIC_`.
- To generate `APP_PASSWORD_HASH` for password login:
  1. Sign into the app locally and use **Settings → Security Diagnostics & scrypt Hash Generator**, or
  2. Run:
     ```bash
     node -e 'const c=require("crypto");const s=c.randomBytes(16);c.scrypt("YOUR_STRONG_PASSWORD",s,64,{N:16384,r:8,p:1},(e,k)=>console.log(`scrypt\\$16384\\$8\\$1\\$${s.toString("hex")}\\$${k.toString("hex")}`))'
     ```
- **Important:** escape every `$` in `APP_PASSWORD_HASH` as `\$` in `.env` files (the command above already does this). Next.js treats an unescaped `$` as a variable reference and silently corrupts the hash, so every login fails.
- Generate `APP_SESSION_SECRET` with:
  ```bash
  openssl rand -hex 32
  ```

---

## 4. Local Development & Testing

```bash
# Install dependencies
npm install

# Run unit & security test suite (Vitest)
npx vitest run

# Run Next.js typegen & strict TypeScript checks
npx next typegen
npm exec tsc -- --noEmit

# Start local development server
npm run dev

# Build for production
npm run build
```

---

## 5. Deploying to Vercel

1. Push the repository to GitHub/GitLab/Bitbucket (confirm `.env` and `.env.local` are ignored via `.gitignore`).
2. Import the repository in the [Vercel Dashboard](https://vercel.com/new) (Framework Preset: **Next.js**).
3. Under **Project Settings → Environment Variables**, configure:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
   - `APP_PASSWORD_HASH` and `APP_SESSION_SECRET` for password login.
   - Your chosen storage credentials: `DATABASE_URL` for PostgreSQL, or Firebase Admin credentials for Firestore.
4. Click **Deploy**. On first sign-in, the canonical 5-phase cybersecurity roadmap (`src/data/cybersecurity-roadmap.json`) is automatically and idempotently seeded into Firestore.

### Troubleshooting

- **`Firebase Admin SDK credentials are not configured`**: This is only needed when using Firestore storage. Ensure `FIREBASE_PRIVATE_KEY` preserves `\n` newline escapes or wrap the multi-line key in quotes in `.env.local`.
- **Firestore `FAILED_PRECONDITION: The query requires an index`**: Run `firebase deploy --only firestore:indexes` so composite indexes in `firestore.indexes.json` finish building.
- **403 `Invalid or missing CSRF token`**: Ensure cookies are enabled in your browser and you are accessing the app over the same hostname configured in your browser bar.
