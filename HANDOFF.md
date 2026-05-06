*Complete context for a new Parma instance to continue from where we left off.*

---

## What It Is

A **private web app** for a friend group that does an October beer-a-day club. Every day in October (Oct 1–31), one beer is revealed. Members log in, rate it (1–5 stars), post text or photos to a wall, emoji-react to posts, and comment. A leaderboard tracks engagement scores and top-rated beers.

**Outside October:** Live countdown clock to Oct 1 + "Join the Society" CTA.
**During October:** Logged-in members auto-redirect from `/` to `/beers` (daily ritual page).
**Target launch:** October 2026. All 31 beers need to be loaded into the DB before then.

---

## URLs & Live Locations

| Asset | URL |
|---|---|
| **Live site** | `https://hallowedhopsociety.com` |
| **Also accessible at** | `https://www.hallowedhopsociety.com` |
| **Vercel project** | `hhs-app` — `hhs-app-zpphillips-stars-projects.vercel.app` |
| **GitHub repo** | `https://github.com/zpphillips-star/hhs-app` |
| **Supabase project** | `https://dnicdsjvqxthkktlcshe.supabase.co` |
| **Supabase dashboard** | `https://supabase.com/dashboard/project/dnicdsjvqxthkktlcshe` |

---

## File Locations (Local)

| | Path |
|---|---|
| **All source files** | `C:\Users\zaphilli\OneDrive\hhs-app\` |
| **Pages** | `C:\Users\zaphilli\OneDrive\hhs-app\app\` |
| **Components** | `C:\Users\zaphilli\OneDrive\hhs-app\components\` |
| **Lib** | `C:\Users\zaphilli\OneDrive\hhs-app\lib\` |
| **Public assets** | `C:\Users\zaphilli\OneDrive\hhs-app\public\` |
| **Env vars** | `C:\Users\zaphilli\OneDrive\hhs-app\.env.local` |

---

## GitHub Account Note ⚠️

Two GitHub accounts are on this machine:
- `zpphillips-star` → **HHS account** — use this for all pushes to `zpphillips-star/hhs-app`
- `zaphilli_microsoft` → Microsoft work account — may be set as `gh` CLI default

**Before any push to HHS**, verify you're on the right account:
```powershell
gh auth status
gh auth switch --user zpphillips-star  # if needed
```

---

## Credentials

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dnicdsjvqxthkktlcshe.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_fZs3CdtGLw3GJdlAxFtxFQ_z4VW2SDB` |
| `SUPABASE_SECRET_KEY` | *(see .env.local — not committed)* |

These live in `.env.local` (not in git) AND must be set in the Vercel dashboard.

---

## Tech Stack

### App (Next.js → Vercel)

| File/Folder | Role |
|---|---|
| `app/page.tsx` | Homepage — countdown clock (pre-Oct) or beer of day (Oct) |
| `app/beers/page.tsx` | Daily ritual — rate, post, react, comment, calendar (~49KB, largest file) |
| `app/wall/page.tsx` | Community feed — all posts across all days, paginated 15/page |
| `app/leaderboard/page.tsx` | Rankings — Top Beers tab (default) + Members tab |
| `app/auth/page.tsx` | Login / signup |
| `app/admin/page.tsx` | Admin — add/edit/delete beers (no auth gating — anyone can access) |
| `app/layout.tsx` | Root layout — loads Modern Antiqua font, sets page title |
| `app/globals.css` | CSS variables + global styles |
| `components/Nav.tsx` | Nav bar — logo, 3 nav links, sign in/out |
| `components/StarRating.tsx` | Star rating widget (1–5 stars, auto-saves on click) |
| `lib/supabase.ts` | Supabase client init |
| `lib/types.ts` | TypeScript types: Beer, Post, Rating, PostReaction, PostComment, Profile |

### Infrastructure

| Layer | Tech | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.4 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS | ^4 |
| Database / Auth / Storage | Supabase | ^2.103.3 |
| React | React | 19.2.4 |
| Hosting | Vercel | auto-deploy from GitHub main |

---

## Database Schema (Supabase)

### `beers`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `day_number` | int | 1–31, unique — maps to Oct calendar day |
| `name` | text | Beer name |
| `brewery` | text | Brewery name |
| `style` | text? | e.g. "IPA" |
| `abv` | float? | |
| `description` | text? | Tasting notes (shown in italic on /beers) |
| `image_url` | text? | Not used in UI yet |
| `created_at` | timestamp | |

### `profiles` (linked to `auth.users`)
| Column | Notes |
|---|---|
| `id` | FK → auth.users |
| `username` | "Oath Name" — chosen at signup |
| `display_name` | Optional, nullable |

### `ratings`
Unique constraint: `(user_id, beer_id)` — upserted, not inserted.

### `posts`
Photo URL comes from Supabase Storage bucket: **`post-photos`** (must be public read).

### `post_reactions`
Enum: `cheers` 🍺 · `dead` 💀 · `fire` 🔥 · `trophy` 🏆 · `rough` 🤢

Toggle behavior: insert → if unique constraint violated (code `23505`) → delete (toggle off).

### `post_comments`
Comments on posts. Displayed in chronological order.

---

## How It Works (End-to-End)

### Pre-October
1. User visits `hallowedhopsociety.com`
2. Sees hero section (HHS manifesto + beer mug image) + live countdown clock to Oct 1
3. "I Want In" CTA → `/auth` to sign up

### During October (logged-in member)
1. User visits site → `supabase.auth.getUser()` detects session → `router.replace('/beers')`
2. `/beers` checks `today.getDate()` → fetches `beers` where `day_number = today`
3. If `PREVIEW_MODE = true` and no DB beer found → falls back to hardcoded Space Dust IPA (for testing)
4. Page renders: beer name, brewery card, tasting notes card, rating card (society avg + your stars)
5. User clicks a star → `ratings.upsert({ user_id, beer_id, stars }, { onConflict: 'user_id,beer_id' })`
6. User types a post → optionally attaches photo
7. Photo → uploads to Supabase Storage `post-photos` bucket → gets public URL
8. Post → `posts.insert({ user_id, beer_id, content, photo_url })`
9. Wall feed below shows today's posts with reactions + comments
10. October calendar at bottom shows all 31 days; past days clickable → modal with beer info + rating

---

## ⚠️ PREVIEW MODE

**Currently ON.** Must be turned off before October launch.

```typescript
// app/beers/page.tsx — line 205
const PREVIEW_MODE = true   // ← CHANGE TO false BEFORE OCTOBER
```

When `true`:
- `/beers` treats every day as if it's October (bypasses `today.getMonth() === 9` check)
- Falls back to hardcoded "Space Dust IPA" preview beer if no DB beer matches today's date
- All writes (ratings, posts, reactions) are **blocked** for the preview beer (`id === 'preview-space-dust'` guard)
- A gold "PREVIEW" badge shows next to the date

---

## Leaderboard Scoring

**Weighted score (Members tab):**

| Action | Base | Timeliness Bonus |
|---|---|---|
| Post to wall | 3 pts | +1 if posted on the same calendar day as that beer's `day_number` |
| Rate a beer | 2 pts | +1 if rated on the same day |
| Comment | 2 pts | +1 if same day |
| React | 1 pt | +1 if same day |

Members see just a number — no breakdown shown. Cards show: rank medal (🥇🥈🥉), display name, score, raw counts.

**Top Beers tab:** Ranked by average star rating descending. Ties broken by rating count.

---

## Design System

Everything is inline CSS using CSS variables. No separate design file — variables defined in `globals.css`.

```css
--bg: #191726          /* Deep navy background */
--bg-card: #201d30     /* Card surfaces */
--text: #d9d8d2        /* Off-white body text */
--text-muted: #7a7468  /* Secondary / labels */
--gold: #d97c2b        /* Primary accent — amber gold */
--gold-light: #e8953a  /* Hover gold */
--gold-dim: rgba(217,124,43,0.12)   /* Active state tint */
--border: rgba(217,124,43,0.18)     /* Subtle gold borders */
```

**Fonts (Google Fonts):**
- `Modern Antiqua` — ALL headings, labels, nav, buttons, UI copy
- `Crimson Text` — auth page inputs only

**Tone:** Dark, dramatic, gothic secret-society. Navy + amber. Uppercase letter-spaced labels. Feels like a grimoire, not a startup.

---

## Auth Flow

Open signup (no invite-only gating). Anyone with the URL can create an account.

1. `/auth` → "Join the Society" tab
2. Enter **Oath Name** (username), email, password
3. Supabase sends confirmation email
4. Confirm email → sign in with `signInWithPassword`
5. Session stored in browser, all pages listen via `supabase.auth.onAuthStateChange`
6. Sign out → `supabase.auth.signOut()` → redirect to `/`

Username stored via: `supabase.auth.signUp({ options: { data: { username } } })`

---

## How to Load the October 2026 Beers

The admin page is the only way. No batch import exists yet.

1. Go to `https://hallowedhopsociety.com/admin`
2. For each of the 31 days:
   - Enter Day Number (1–31), Beer Name, Brewery, Style, ABV, Description
   - Click "Save Day X"
3. Counter shows "X/31 entered" as you go
4. Each save is an upsert — you can re-edit any day anytime
5. Beers go live automatically when their `day_number` matches `today.getDate()` in October

---

## How to Deploy Changes

**Code changes (website):**
1. Edit files in `C:\Users\zaphilli\OneDrive\hhs-app\`
2. `git add . && git commit -m "message"`
3. `git push` (must be on `zpphillips-star` account)
4. Vercel auto-deploys in ~30 seconds — live at `hallowedhopsociety.com`

**To run locally:**
```powershell
cd "C:\Users\zaphilli\OneDrive\hhs-app"
npm run dev
# → http://localhost:3000
```

---

## Changelog

| Date | Change |
|---|---|
| Apr 19–20 | Wall posts not showing — root cause: INNER JOIN on profiles. Fixed with LEFT JOIN. (Unpushed) |
| Apr 19–20 | Post insert silently failing — no error handling. Fixed with console.error + alert. (Unpushed) |
| Apr 19–20 | Leaderboard tab order — Top Beers moved to first/default tab. (Unpushed) |
| Apr 19–20 | Timeliness bonus (+1 pt for same-day actions) added to leaderboard scoring |
| Apr 19–20 | Weighted scoring implemented (post=3, rate=2, comment=2, react=1 pts) |
| Apr 19 | Society rating stacked above user rating on /beers |
| Apr 19 | Preview mode added — Space Dust IPA mockup for testing outside October |
| Apr 18–19 | Daily ritual page built (/beers) — rating, wall, reactions, comments, photos, calendar, modal |
| Apr 17–18 | Beer calendar built — responsive grid (desktop) + list (mobile) |
| Apr 17 | Rankings tab renamed from "Members" in nav |
| Apr 17 | Full HHS app built — auth, beer list, leaderboard, admin, ratings |
| Apr 16 | Initial Next.js scaffold, branding applied (navy/gold, Modern Antiqua) |

---

## Known / Pending Items

| Item | Status | Notes |
|---|---|---|
| **2 unpushed commits** | 🔴 Blocking | Run `git push` — fixes wall posts + post errors + tab order |
| **Turn off PREVIEW_MODE** | 🔴 Before Oct | `app/beers/page.tsx` line 205 → `false` |
| **Load 31 beers** | 🔴 Before Oct | Use `/admin` before October 1, 2026 |
| **Supabase Storage bucket** | ⚠️ Verify | `post-photos` bucket must exist + have public read access for photo uploads |
| **Profile auto-creation trigger** | ⚠️ Verify | Supabase trigger `ON INSERT auth.users → INSERT profiles` — verify it exists or users post as "Member" |
| **Admin auth gating** | ⚠️ Nice to have | `/admin` is open to anyone with the URL — add email check if desired |
| **No custom domain email** | ℹ️ Info | Auth confirmation emails come from Supabase defaults |

---

## Public Assets (in `/public`)

| File | Used For |
|---|---|
| `mughhs.webp` | Homepage hero — beer mug image (right column) |
| `hhs_no_circles_300dpi.webp` | Auth page logo (centered above login form) |
| `hhs-nav-icon.webp` | Nav bar logo (44×26px) |
| `HHS-Full-1.webp` | Full HHS logo (available, not in active use) |
| `hhs-logo-8.25-1.png` | Alt logo asset (available, not in active use) |

---

## #HHS Channel Rule

This channel (`#hhs`) is **Hallowed Hop Society only**. All HHS questions, code changes, and GitHub pushes live in this channel. No Microsoft work here.

---
*Generated: 2026-05-05 — full source read of all files + Vercel alias check*
