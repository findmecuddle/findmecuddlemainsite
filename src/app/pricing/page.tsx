import Link from "next/link";
import { MapPin, Handshake, ShieldCheck, DollarSign, Zap, Calendar, MessageCircle, Megaphone, Rocket, Wrench, Scale, BellOff } from "lucide-react";
import { SITE_NAME, PLANS } from "@/lib/config";
import { currentCuddler } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Advertise Your Cuddle Practice",
  description: "List your independent cuddle therapy practice on Find Me Cuddle. Standard or VIP plans, no commission on bookings.",
};

const WHY_ADVERTISE = [
  { icon: MapPin, title: "Local Search Visibility", body: "Clients searching your area by zip code, city, or address find your ad directly." },
  { icon: Handshake, title: "No Middleman", body: "Clients contact you directly by call, text, or email. No commission on your bookings." },
  { icon: ShieldCheck, title: "Verified Trust Badge", body: "Every listing is reviewed and license-verified, so clients know you're the real deal." },
  { icon: DollarSign, title: "Affordable Flat Rate", body: "One simple listing price, no per-booking fees or hidden charges." },
  { icon: Zap, title: "Boosts And VIP Perks", body: "Push your ad to the top of local search whenever you want extra visibility." },
  { icon: Calendar, title: "Flexible Plans", body: "Run your ad weekly or monthly, and cancel anytime." },
  { icon: MessageCircle, title: "Real, Responsive Support", body: "We answer customer service messages as fast as we can. A real person, not a bot." },
  { icon: Megaphone, title: "We Promote You", body: "We repost your listing on our socials, and we invest in paid marketing, not just free posts." },
  { icon: Rocket, title: "Growing The Community", body: "We're focused on growing this community as big as possible, more clients, more visibility for you." },
  { icon: Wrench, title: "Always Improving", body: "We're constantly developing and adding new tools and features to the platform as time goes on." },
  { icon: Scale, title: "Fair Moderation", body: "We only ban cuddlers who break our rules or the law. We don't ban for no reason." },
  {
    icon: BellOff,
    title: "Off-Hours Gatekeeping",
    body: "Clients can only call or text during the hours you set. Outside them, they're routed to email instead, so you're not disturbed. On by default, and you can turn it off anytime from your dashboard.",
  },
];

/** Pulls the real live price for each plan straight from Stripe, so this page can never drift out
 *  of sync with what people actually get charged at checkout. Falls back to null per-plan (hiding
 *  the price/per-day line for just that card) if a price ID is unset or Stripe is unreachable,
 *  rather than failing the whole page. */
async function fetchPlanPrices(): Promise<Record<string, { amount: number; perDay: number } | null>> {
  const results: Record<string, { amount: number; perDay: number } | null> = {};
  await Promise.all(
    PLANS.map(async ({ key, priceId }) => {
      const id = priceId();
      if (!id) {
        results[key] = null;
        return;
      }
      try {
        const price = await stripe().prices.retrieve(id);
        if (price.unit_amount == null) {
          results[key] = null;
          return;
        }
        const amount = price.unit_amount / 100;
        results[key] = { amount, perDay: amount / 30 }; // every plan bills monthly, ~30-day cycle
      } catch {
        results[key] = null;
      }
    })
  );
  return results;
}

export default async function PricingPage() {
  const me = await currentCuddler();
  const cta = me ? "/dashboard" : "/signup";
  const prices = await fetchPlanPrices();

  const plans = [
    { key: "standard", name: "Standard Listing", blurb: "The core plan: a full profile, unlimited messages, and up to 3 photos." },
    {
      key: "vip",
      name: "VIP Listing",
      blurb: "Everything in Standard, plus 10 free boost credits every month, a second location, and up to 6 photos that rotate on your ad.",
      featured: true,
    },
  ];

  return (
    <div className="container-page py-14">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Advertise on {SITE_NAME}</h1>
        <p className="mt-3 text-stone2">
          One listing, found by clients searching your area. Pick how long it runs. Cancel anytime.
        </p>
      </div>

      <div className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Why You Should Advertise With Us</h2>
        <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {WHY_ADVERTISE.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-spruce-tint">
                  <Icon className="h-5 w-5 text-spruce" strokeWidth={1.75} />
                </span>
                <h3 className="font-display text-base font-semibold">{title}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-stone2">{body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {plans.map((p) => (
          <div key={p.key} className={`card flex flex-col p-6 ${p.featured ? "border-spruce" : ""}`}>
            {p.featured && (
              <span className="mb-3 w-fit rounded-full bg-spruce-tint px-2.5 py-0.5 text-[11px] font-medium text-spruce">
                Best Value
              </span>
            )}
            <h2 className="font-display text-xl font-semibold">{p.name}</h2>
            {prices[p.key] && (
              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="font-display text-2xl font-semibold text-ink">
                  ${prices[p.key]!.amount.toFixed(0)}
                </span>
                <span className="text-sm text-stone2">/ month</span>
                <span className="text-xs text-stone2">
                  (${prices[p.key]!.perDay.toFixed(2)}/day)
                </span>
              </p>
            )}
            <p className="mt-2 flex-1 text-sm leading-relaxed text-stone2">{p.blurb}</p>
            <Link href={cta} className={`${p.featured ? "btn-primary" : "btn-ghost"} mt-5 w-full`}>
              {me ? "Choose In Dashboard" : "Get Started"}
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-12 card p-6">
        <h2 className="font-display text-xl font-semibold">Boosts</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone2">
          The only extra charge on top of your listing plan. A boost puts your ad in the Featured
          section on the homepage and moves you up in local search for a full day, roughly $1-2 per
          day depending on the credit pack you buy. VIP members get 10 boost credits free every
          month; anyone can buy more from their dashboard.
        </p>
      </div>
    </div>
  );
}
