This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Wall Goblin daily recap bot

`/api/wall-goblin` is a cron-safe route that posts one HHS Wall recap per Pacific recap date. The Vercel cron runs at `13:00 UTC`, which is 6am Pacific during October 2026 PDT and 5am Pacific on the Nov. 1, 2026 DST transition day, so the final Oct. 31 recap still lands before 6am Pacific. The route no-ops unless the Pacific post date is Oct. 2 through Nov. 1 for `WALL_GOBLIN_YEAR` (defaults to `2026`).

Required production env vars:

- `CRON_SECRET` — required for Vercel cron because Vercel sends it as the `Authorization: Bearer ...` header.
- `WALL_GOBLIN_USER_ID` — auth/profile UUID the service-role insert should use for the bot post. This must already exist in `profiles`; the route refuses to fake a human user.
- `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) and `NEXT_PUBLIC_SUPABASE_URL` — existing server Supabase config.

Optional env vars:

- `WALL_GOBLIN_SECRET` — accepted for manual preview/testing via bearer, `x-wall-goblin-secret`, or `?secret=...`; set it equal to `CRON_SECRET` if you want one shared secret.
- `ANTHROPIC_API_KEY` — enables AI-written recaps. Without it, the route uses a deterministic safe fallback.
- `WALL_GOBLIN_ANTHROPIC_MODEL` — overrides the default Anthropic model.
- `WALL_GOBLIN_YEAR` — defaults to `2026`.

Preview without inserting:

```bash
curl "https://YOUR_DOMAIN/api/wall-goblin?date=2026-10-02&dryRun=1&secret=YOUR_SECRET"
```

`date` is the Pacific post date; the recap covers the previous Pacific day. Duplicate prevention uses a visible `Goblin receipt: YYYY-MM-DD` marker in the post content and checks the previous day's beer before inserting.
