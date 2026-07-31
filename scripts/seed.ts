import "dotenv/config"; // tsx doesn't auto-load .env the way `next dev`/`next build` do.
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { cuddlers } from "../src/lib/schema";

type DemoCuddler = {
  name: string; slug: string; email: string; headline: string; bio: string; services: string;
  rate30?: number; rate60?: number; rate90?: number; rate120Plus?: number;
  city: string; state: string; zip: string; lat: number; lng: number;
  city2?: string; state2?: string; zip2?: string; lat2?: number; lng2?: number;
  phone: string; mobile: boolean; boostedMinutesAgo?: number;
  plan?: "standard" | "vip";
  subStatus?: "active" | "canceled";
  published?: boolean;
  verificationStatus?: "none" | "pending" | "approved" | "rejected";
  verificationNote?: string;
  socialMediaOptIn?: boolean;
};

const demo: DemoCuddler[] = [
  // --- Original LA cluster (search 90064 or "Los Angeles, CA") ---
  {
    name: "Jordan Reyes", slug: "jordan-reyes", email: "jordan@example.com",
    headline: "Certified cuddle therapist — 5 years experience",
    bio: "I work with clients looking for platonic comfort touch, whether that's after a hard week, coping with grief, or just wanting genuine human connection. Sessions are tailored to your comfort level and boundaries.",
    services: "Big Spoon / Little Spoon, Hand Holding & Conversation, Movie Cuddle Session", rate60: 65, rate90: 90,
    city: "Los Angeles", state: "CA", zip: "90064", lat: 34.0368, lng: -118.426,
    phone: "(555) 201-8834", mobile: true, boostedMinutesAgo: 5,
  },
  {
    name: "Maya Chen", slug: "maya-chen", email: "maya@example.com",
    headline: "Gentle, restorative cuddle sessions in a calm private space",
    bio: "Warm, low-pressure comfort-touch sessions focused on relaxation and connection. My space is quiet, cozy, and designed to help you fully unwind.",
    services: "Face-To-Face Embrace, Breathwork & Cuddling, Nap Session", rate60: 60, rate90: 85,
    city: "Santa Monica", state: "CA", zip: "90401", lat: 34.0141, lng: -118.495,
    phone: "(555) 774-2291", mobile: false,
  },
  {
    name: "Andre Whitfield", slug: "andre-whitfield", email: "andre@example.com",
    headline: "Mobile cuddle sessions — I come to you",
    bio: "Fully mobile practice covering the west side. Comfortable, judgment-free sessions wherever you're most at ease.",
    services: "Big Spoon / Little Spoon, Mobile Cuddle Session", rate60: 70,
    city: "Culver City", state: "CA", zip: "90230", lat: 33.995, lng: -118.396,
    phone: "(555) 318-4470", mobile: true,
  },

  // --- New Austin, TX cluster — covers every visible state + gating scenario ---
  {
    // Boosted most recently -> should sort #1 in Austin search results, gold "Featured" badge.
    name: "Priya Anand", slug: "priya-anand", email: "priya@example.com",
    headline: "Comfort & grief support cuddling", bio: "Compassionate sessions for anyone processing loss, stress, or just needing to feel less alone.",
    services: "Comfort & Grief Support, Hand Holding & Conversation", rate60: 65, rate90: 90,
    city: "Austin", state: "TX", zip: "78701", lat: 30.2711, lng: -97.7437,
    phone: "(555) 400-1001", mobile: false, boostedMinutesAgo: 5,
  },
  {
    // Boosted earlier than Priya -> sorts #2 (older boost, still above VIP/plain). VIP + second
    // location -> exercises the VIP carousel and second-location display.
    name: "Marcus Webb", slug: "marcus-webb", email: "marcus@example.com",
    headline: "Platonic snuggling — two locations", bio: "Serving both Round Rock and Cedar Park.",
    services: "Platonic Snuggling, Movie Cuddle Session", rate60: 70, rate90: 100,
    city: "Round Rock", state: "TX", zip: "78664", lat: 30.5083, lng: -97.6789,
    city2: "Cedar Park", state2: "TX", zip2: "78613", lat2: 30.5052, lng2: -97.8203,
    phone: "(555) 400-1002", mobile: false, boostedMinutesAgo: 120,
    plan: "vip",
  },
  {
    // VIP, not boosted -> sorts above plain listings by the VIP tier, ranked by distance within it.
    name: "Elena Ford", slug: "elena-ford", email: "elena@example.com",
    headline: "Head scratches & quiet conversation", bio: "Gentle, restorative comfort touch, no agenda, just presence.",
    services: "Head Scratches / Head In Lap, Hand Holding & Conversation", rate60: 65,
    city: "Cedar Park", state: "TX", zip: "78613", lat: 30.5052, lng: -97.8203,
    phone: "(555) 400-1003", mobile: false, plan: "vip", socialMediaOptIn: true,
  },
  {
    // Plain standard, not boosted, not VIP -> bottom tier, sorted by distance.
    name: "Sam Delgado", slug: "sam-delgado", email: "sam@example.com",
    headline: "Back rubs & breathwork", bio: "Slow, grounding sessions in downtown Austin.",
    services: "Back Rubs (Non-Massage), Breathwork & Cuddling", rate60: 60,
    city: "Austin", state: "TX", zip: "78701", lat: 30.2711, lng: -97.7437,
    phone: "(555) 400-1004", mobile: false,
  },
  {
    // ~30 miles from downtown Austin — outside the default 25mi radius, useful for testing that
    // "widen the radius" actually surfaces someone.
    name: "Nora Kim", slug: "nora-kim", email: "nora@example.com",
    headline: "Nap sessions & quiet company", bio: "Specialized in low-key, restful sessions for anyone touch-starved or overwhelmed.",
    services: "Nap Session, Face-To-Face Embrace", rate60: 65,
    city: "San Marcos", state: "TX", zip: "78666", lat: 29.8833, lng: -97.9414,
    phone: "(555) 400-1005", mobile: false,
  },

  // --- Deliberately hidden from search — each proves one gating rule works. ---
  {
    // Submitted certification + ID, awaiting admin review — should NOT appear in search.
    name: "Owen Vance", slug: "owen-vance", email: "owen@example.com",
    headline: "Group cuddle sessions", bio: "Awaiting verification approval.",
    services: "Group Cuddle", rate60: 70,
    city: "Austin", state: "TX", zip: "78701", lat: 30.2711, lng: -97.7437,
    phone: "(555) 400-1006", mobile: false, verificationStatus: "pending",
  },
  {
    // Never submitted verification — should NOT appear in search.
    name: "Lena Cho", slug: "lena-cho", email: "lena@example.com",
    headline: "Office-friendly comfort breaks", bio: "Hasn't submitted identity verification yet.",
    services: "Hand Holding & Conversation", rate30: 35,
    city: "Austin", state: "TX", zip: "78701", lat: 30.2711, lng: -97.7437,
    phone: "(555) 400-1007", mobile: false, verificationStatus: "none",
  },
  {
    // Verification rejected — should NOT appear in search; dashboard would show the note.
    name: "Derek Holt", slug: "derek-holt", email: "derek@example.com",
    headline: "Big spoon / little spoon sessions", bio: "Verification was rejected — needs to resubmit.",
    services: "Big Spoon / Little Spoon", rate60: 65,
    city: "Austin", state: "TX", zip: "78701", lat: 30.2711, lng: -97.7437,
    phone: "(555) 400-1008", mobile: false,
    verificationStatus: "rejected", verificationNote: "ID photo was too blurry to read — please retake.",
  },
  {
    // Verified and published, but subscription canceled — should NOT appear in search.
    name: "Grace Palmer", slug: "grace-palmer", email: "grace@example.com",
    headline: "Comfort & grief support", bio: "Subscription lapsed.",
    services: "Comfort & Grief Support", rate60: 65,
    city: "Austin", state: "TX", zip: "78701", lat: 30.2711, lng: -97.7437,
    phone: "(555) 400-1009", mobile: false, subStatus: "canceled",
  },
  {
    // Verified, active subscription, but hasn't hit "Publish my ad" — should NOT appear in search.
    name: "Ivan Petrov", slug: "ivan-petrov", email: "ivan@example.com",
    headline: "Draft listing", bio: "Hasn't published yet.",
    services: "Platonic Snuggling", rate60: 65,
    city: "Austin", state: "TX", zip: "78701", lat: 30.2711, lng: -97.7437,
    phone: "(555) 400-1010", mobile: false, published: false,
  },
];

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);
  for (const d of demo) {
    const verificationStatus = d.verificationStatus ?? "approved";
    await db
      .insert(cuddlers)
      .values({
        email: d.email, passwordHash, name: d.name, slug: d.slug,
        headline: d.headline, bio: d.bio, services: d.services,
        rate30: d.rate30 ?? null, rate60: d.rate60 ?? null, rate90: d.rate90 ?? null, rate120Plus: d.rate120Plus ?? null,
        phone: d.phone, mobile: d.mobile,
        city: d.city, state: d.state, zip: d.zip, lat: d.lat, lng: d.lng,
        city2: d.city2 ?? null, state2: d.state2 ?? null, zip2: d.zip2 ?? null,
        lat2: d.lat2 ?? null, lng2: d.lng2 ?? null,
        credits: 3,
        boostedAt: d.boostedMinutesAgo != null ? new Date(Date.now() - d.boostedMinutesAgo * 60_000) : null,
        subStatus: d.subStatus ?? "active",
        activeUntil: new Date(Date.now() + 30 * 24 * 3600_000),
        published: d.published ?? true,
        plan: d.plan ?? "standard",
        verificationStatus,
        verificationNote: d.verificationNote ?? null,
        verificationSubmittedAt: verificationStatus !== "none" ? new Date() : null,
        verifiedAt: verificationStatus === "approved" ? new Date() : null,
        socialMediaOptIn: d.socialMediaOptIn ?? false,
      })
      .onConflictDoNothing();
  }
  console.log(`Seeded ${demo.length} demo cuddlers (all logins use password: password123)`);
  console.log(`Try searching "78701" or "Austin, TX" — 5 should appear (2 boosted, 1 VIP, 2 plain),`);
  console.log(`5 should stay hidden (pending/none/rejected/canceled/unpublished — that's expected).`);
}

main();
