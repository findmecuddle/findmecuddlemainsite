# Find Me Cuddle — findmecuddle.com

A directory site where clients search nearby professional cuddlers by **zip code, city, or address** — no account needed. Cuddlers log in to run their ad (**Standard $30/mo** or **VIP $60/mo** subscription), edit it, and spend **boost credits** (~$1-2/day) to push it to the top of local search results. VIP adds 10 free boost credits a month, a second location, and up to 6 rotating photos.

This is a **v1 (MVP) build**, cloned and rebranded from a sister project ([Find Me Massage](https://findmemassage.com)) and trimmed down to the essentials. See "What's different from Find Me Massage" below for what was intentionally left out.

Built with Next.js 15, Drizzle ORM + SQLite, Clerk (cuddler auth), and Stripe (subscriptions + one-time boost credit packs).

**Important — this is a professional, strictly non-sexual platonic touch therapy platform**, not a companionship or dating service. The Terms of Service (`/terms`) spell this out explicitly, and the photo/content moderation tools (manual admin flagging, Stripe Identity verification, AI-photo/suggestive-content detection scaffolding) all exist to help enforce that. Read that section of `/terms` before launch and make sure your Stripe account application describes the business the same way — see the Stripe section below.

---

## 1. Run it locally (5 minutes)

```bash
npm install
cp .env.example .env        # then edit .env — see below
npm run db:push             # creates the SQLite database
npm run db:seed             # adds demo cuddlers (rename copy in scripts/seed.ts if it still reads "therapist" anywhere)
npm run dev                 # http://localhost:3000
```

## 2. Configure `.env`

| Variable | What it is |
|---|---|
| `NEXT_PUBLIC_SITE_NAME` | Set to **Find Me Cuddle**. It updates everywhere. |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally; `https://findmecuddle.com` in production. |
| `AUTH_SECRET` | Any long random string: `openssl rand -base64 32` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | A **separate Clerk application** from findmemassage — see §3. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | A **separate Stripe account** from findmemassage — see §4. |
| `STRIPE_PRICE_STANDARD` / `STRIPE_PRICE_VIP` | The two solo listing plans — $30/mo and $60/mo. |
| `STRIPE_PRICE_SMALL_AGENCY` / `STRIPE_PRICE_LARGE_AGENCY` | Optional multi-cuddler "agency" account plans (kept from the source app; pricing wasn't specified for v1, set your own before enabling). |
| `STRIPE_CREDIT_PACKS` | Format `priceId:credits,priceId:credits` — boost credits, price around $1-2/credit. |
| `S3_*` | Object storage for cuddler photos — see §5. |
| `S3_PRIVATE_BUCKET` | A **second, private** bucket for certification/ID verification photos — see §5. Never expose this bucket publicly. |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Transactional email (support form, newsletter). |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile captcha on public forms. |
| `NEXT_PUBLIC_LEGAL_EMAIL` / `NEXT_PUBLIC_SUPPORT_EMAIL` | Contact address shown on `/privacy`, `/terms`, `/faq`, and the support form. |

## 3. Set up Clerk

Create a **new** Clerk application (don't reuse findmemassage's — different user base). Copy the publishable/secret keys into `.env`. No special config needed beyond the defaults; `lib/auth.ts` resolves the logged-in cuddler from the Clerk session.

## 4. Set up Stripe (test mode first)

1. Create a **new Stripe account**, separate from findmemassage's. When you fill out the business description during account setup, describe this accurately as a **non-sexual wellness/comfort-touch service** — Stripe's restricted-business list names "sexually oriented massage parlors" and similar adjacent categories, so being explicit up front helps the application clear review cleanly.
2. Create a product **"Listing"** with two recurring monthly prices: **$30 Standard** and **$60 VIP**. Copy each `price_...` id into `STRIPE_PRICE_STANDARD` / `STRIPE_PRICE_VIP`.
3. (Optional, if you turn on Agency accounts) Create **Small Agency** / **Large Agency** recurring prices too.
4. Create a product **"Boost credits"** with one or more **one-time** prices (e.g. a 5-pack and a 12-pack), priced around $1-2/credit — each credit is one 24-hour boost. Put them in `.env` as `STRIPE_CREDIT_PACKS="price_xxx:5,price_yyy:12"`.
5. Enable the **Identity** product (Products → Identity) for the automated government-ID + live-selfie check.
6. Add a webhook endpoint for `https://findmecuddle.com/api/stripe/webhook` (or your local tunnel URL for testing) with the checkout/subscription/invoice events plus the three `identity.verification_session.*` events — see `.env.example` for the exact list.

## 5. Photo storage

Same pattern as findmemassage: one **public** S3-compatible bucket for ad photos, one **private** bucket for certification/ID verification documents. Use separate buckets from findmemassage's — `findmecuddle-photos` and `findmecuddle-verification` are the suggested names in `.env.example`. IONOS Object Storage, Cloudflare R2, or AWS S3 all work unmodified.

## 6. Admin dashboard

Create the first admin with:

```bash
npm run db:seed-admin
```

It prompts for a name, email, and password in the terminal. Add teammates later from `/admin/team` once logged in.

## 7. Deploy

Same options as findmemassage — see that project's README §7 for the full Railway/Render/IONOS-VPS walkthrough, it applies unchanged here (just point at this repo and this `.env` instead). Since `findmecuddle.com`'s domain is already owned per the setup conversation, you mainly need: a server (VPS or PaaS), the env vars above with **live** Stripe/Clerk keys, `npm run db:push` once to create the database, and DNS pointed at wherever you host it.

## 8. Attorney review (before real launch)

`/privacy` and `/terms` are draft legal templates, **not reviewed by an attorney** — see the comment at the top of each file. Have a licensed attorney review both before accepting real signups, especially the non-sexual-services clause, the independent-contractor language, and the liability limitation. This matters more here than for a typical directory site given the nature of the service.

---

## What's different from Find Me Massage (v1 scope decisions)

This was scaffolded from findmemassage's codebase and trimmed to a lean MVP per an explicit scope call. **Not included in this v1** (all still exist in the findmemassage codebase if you want to port any of them over later):

- Blog (`/blog`)
- SEO city landing pages (`/massage-therapists/[area]` equivalent) — the `TARGET_AREAS` config list and `nearbySearch.ts` helper are still here, just not wired to any page/sitemap entries
- VIP photoshoot request perk (was already disabled/commented-out in the source app too)
- Social media auto-digest email script (the admin "Ready to post" queue is still here; just the email digest cron isn't)
- Transparency/moderation-reports page (`/transparency`)

**Kept, and worth knowing about:**

- The "Agency" account type (multi-cuddler team listings, formerly "Spa" in the source app) is fully wired but has no pricing specified yet — set `STRIPE_PRICE_SMALL_AGENCY`/`STRIPE_PRICE_LARGE_AGENCY` before it's usable, or hide the option in `OnboardingForm.tsx` if you don't want to offer it yet.
- Automatic AI-photo detection (`lib/aiDetection.ts`, Sightengine) exists in the code but isn't called from any upload route — same as findmemassage, where it was intentionally turned off in favor of manual admin flagging. The manual Flag button and Flagged Photos admin queue are both live.
- The newsletter signup form + digest script are still here (small, self-contained, low-risk to keep).

## Copy pass

Every "massage"/"therapist" reference from the source app has been swapped for cuddle-therapy language (session types under "Services" are now things like "Big Spoon / Little Spoon," "Movie Cuddle Session," etc. — see `CUDDLE_TYPES` in `src/lib/config.ts`), and "license" language was changed to "certification" throughout, since cuddle therapy isn't state-licensed the way massage therapy is in most places — cuddlers can attest that no certification applies to them, same UI pattern as before. Give the site a full read-through before launch; an automated find-and-replace pass doesn't catch everything a human read would.
