import { SITE_NAME, LEGAL_CONTACT_EMAIL, LEGAL_ENTITY, LEGAL_STATE } from "@/lib/config";

// DRAFT LEGAL TEMPLATE — not reviewed by an attorney. Have a licensed California attorney
// review this before relying on it in production, particularly the liability limitation,
// independent-contractor language, and dispute-resolution section. See NEXT_STEPS.md.
export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  const updated = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="container-page max-w-3xl py-14">
      <h1 className="font-display text-3xl font-semibold">Terms of Service</h1>
      <p className="mt-2 text-sm text-stone2">Last updated {updated}</p>

      <div className="mt-8 grid gap-8 text-sm leading-relaxed text-ink/90">
        <p>
          These Terms of Service ("Terms") govern your use of {SITE_NAME}, operated by {LEGAL_ENTITY} ("we,"
          "us," or "our"). By creating an account, browsing listings, or otherwise using the site, you agree to
          these Terms. If you don't agree, please don't use {SITE_NAME}.
        </p>

        <section>
          <h2 className="font-display text-xl font-semibold">What {SITE_NAME} is</h2>
          <p className="mt-3">
            {SITE_NAME} is a directory and advertising platform. It lets independent cuddle professionals create
            and pay for listings, and lets clients search for and contact cuddlers directly. We are not a
            cuddle therapy provider, we do not employ or supervise any cuddler listed on the site, and we are
            not a party to any appointment, agreement, or payment made between a client and a cuddler. All
            sessions are arranged and performed entirely between the client and the cuddler.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Non-sexual services only</h2>
          <p className="mt-3">
            {SITE_NAME} is strictly a platform for professional, non-sexual, platonic touch therapy (also
            known as cuddle therapy or comfort-touch services). Sessions are strictly non-sexual: no sexual
            contact, sexual conduct, sexual services, or nudity of any kind is permitted, requested, offered,
            or implied at any time, on or off the site. Any listing, message, review, or session that violates
            this policy will result in immediate, permanent removal from the platform, and we cooperate with
            law enforcement in cases involving solicitation or exploitation.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Eligibility</h2>
          <p className="mt-3">
            You must be at least 18 years old to use {SITE_NAME}. Most jurisdictions do not license or certify
            cuddle therapy or comfort-touch services, so no certification, permit, or registration is required
            to list here. If a cuddler holds one anyway, they're responsible for keeping it current on their
            own; we don't track or verify it.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Identity verification</h2>
          <p className="mt-3">
            Before a listing can go live, we require a cuddler to pass a government-issued photo ID and
            live-selfie check, reviewed automatically. This confirms the ID was checked and appears to match
            the selfie. It is not a guarantee of a cuddler's ongoing conduct, and clients should use their own
            judgment the same way they would with any independent contractor. Submitting a false, expired, or
            altered ID is grounds for immediate account termination.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Accounts</h2>
          <p className="mt-3">
            You're responsible for keeping your account password confidential and for all activity under your
            account. Listing information must be accurate: misrepresenting your identity, location, services,
            or credentials is a violation of these Terms.
          </p>
          <p className="mt-3">
            Photos on a listing must be real, current, professional photos of the cuddler or business being
            advertised, fully clothed and non-sexual in nature. AI-generated, stock, blurry, suggestive, or
            otherwise misleading, unprofessional, or inappropriate photos aren't allowed and may be removed at
            any time, even after being posted, at our discretion.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Subscriptions, payments, and refunds</h2>
          <p className="mt-3">
            Listings are billed on a recurring weekly or monthly basis (Monthly VIP included) through Stripe.
            Subscriptions renew automatically until canceled; you can cancel anytime from your dashboard, which
            stops future billing but does not refund the current billing period. Boost credits are purchased
            one-time, are non-refundable, have no cash value, and are forfeited if your account is closed or
            terminated. We may change prices going forward; changes won't apply to a period you've already paid
            for.
          </p>
          <p className="mt-3">
            As a general policy, payments are non-refundable. If you'd like to cancel and believe a refund is
            warranted, contact us directly at the email below. We review these requests case by case and may,
            at our discretion, issue a prorated refund.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Independent cuddlers, not employees</h2>
          <p className="mt-3">
            Cuddlers listed on {SITE_NAME} are independent business owners. Nothing about a listing creates an
            employment, agency, partnership, or joint-venture relationship between {SITE_NAME} and any
            cuddler. We do not set a cuddler's prices, schedule, or scope of services beyond what they
            choose to list, and we do not supervise how sessions are conducted.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Client responsibility</h2>
          <p className="mt-3">
            Clients choose, contact, and schedule directly with cuddlers at their own discretion. Any
            arrangement, payment, or dispute regarding a session is strictly between the client and the
            cuddler. {SITE_NAME} is not responsible for the quality, safety, legality, or outcome of any
            session booked through the site, or for anything a client does, says, or requests once they've
            contacted a cuddler through the site. We're simply an advertising platform that helps cuddlers
            promote their services and gives clients a way to find them; we don't participate in, oversee, or
            take responsibility for what happens after that initial contact is made.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Cuddler responsibility</h2>
          <p className="mt-3">
            {SITE_NAME} functions like a classified ads or online directory site: we give cuddlers a place to
            advertise and give clients a way to find and contact them, and that's where our involvement ends. We
            do not screen, background-check, or supervise clients, and we are not present for, or a party to,
            any session. As a cuddler, you agree that {SITE_NAME} is not responsible or liable for anything a
            client says, does, requests, or is alleged to have done, whether before, during, or after a session,
            including during the session itself. This applies whether or not the client contacted you through
            the site's messaging, "Send My Info," phone, text, or email, and whether or not you had reported
            similar behavior about that client before. See "Assumption of risk" and "Indemnification" below for
            how this applies more broadly.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Third-party links</h2>
          <p className="mt-3">
            A cuddler may add a link to their own personal or business website on their listing. We review
            each link before it's shown publicly, but that review only confirms the link appeared to lead
            somewhere reasonable at the time we checked it. It is not an endorsement, guarantee, or ongoing
            verification of that site, its content, its security, or anything offered through it, and a site's
            content or ownership can change at any time after our review. You follow any such link entirely at
            your own risk. {SITE_NAME} is not responsible for any loss, scam, malware, or other harm arising from
            a linked third-party site. We may reject, remove, or re-review any link at any time, for any reason,
            without notice.
          </p>
          <p className="mt-3">
            A cuddler may also link up to a few social media profiles (Instagram, TikTok, or X) on their
            listing. Unlike a personal website, these are not individually reviewed before they go live. The same
            disclaimer above applies equally to them.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Your safety</h2>
          <p className="mt-3 rounded-lg bg-red-50 p-3 font-medium text-red-800">
            If you are ever in a dangerous situation, or something illegal is happening or being threatened,
            call 911 or your local emergency services immediately. Don't wait to report it to us first.
          </p>
          <p className="mt-3">
            {SITE_NAME} does not take responsibility for any cuddler who practices illegally, misrepresents their
            certification, or offers anything beyond the services described on their listing. Once you're safe,
            you're welcome to report anything concerning through the "Report" option on a cuddler's listing or by
            contacting us directly, and we will report any illegal activity we become aware of to law enforcement.
          </p>
          <p className="mt-3">
            We screen cuddlers to the best of our ability through identity verification (see "Identity
            verification" above) and by acting on reports submitted to us, but this screening has real limits.
            Verification is a point-in-time check, not an ongoing background check or criminal history search,
            and it's entirely possible that someone has behaved badly with another client without that ever
            being reported to us or reflected anywhere on the site. A cuddler having no reports, or holding a
            "Verified" badge, is not a guarantee of their safety, character, or future conduct. Use your own
            judgment before and during any session, the same way you would with anyone you're meeting for the
            first time.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Assumption of risk</h2>
          <p className="mt-3">
            Arranging to meet someone in person, whether at your location, theirs, or elsewhere, carries
            inherent personal risk that {SITE_NAME} cannot eliminate or guarantee against. By using the site to
            find, contact, or arrange a session with a cuddler (or to find or accept a client, if you're a
            cuddler), you voluntarily assume all risks associated with that interaction, including risks to your
            physical safety, property, and finances. {SITE_NAME} is not responsible for the acts or omissions of
            any user, cuddler, or client, whether or not we were aware of prior complaints or reports about
            them.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Reviews, reports, and content rules</h2>
          <p className="mt-3">
            Reviews and reports must be truthful and based on a genuine experience. We may remove content, or
            suspend or terminate an account, for harassment, hate speech, discrimination, sexually explicit
            solicitation, illegal content, or anything that violates these Terms. If you believe a photo or other
            content posted on {SITE_NAME} infringes your copyright, contact us at the email below with a
            description of the work, its location on the site, and your contact information, and we'll
            investigate and remove infringing content where appropriate.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Cuddler safety and client reports</h2>
          <p className="mt-3 rounded-lg bg-red-50 p-3 font-medium text-red-800">
            If you ever fear for your safety or are in a dangerous situation with a client, call 911 or your local
            emergency services immediately. Don't wait to report it to us first.
          </p>
          <p className="mt-3">
            {SITE_NAME} lets a cuddler flag a client's phone number or email after a bad experience (a
            no-show, non-payment, scam, chargeback, aggressive or threatening behavior, or similar), so other
            cuddlers see a warning if that same contact reaches out to them. We do not verify these reports,
            investigate the underlying incident, or independently confirm their accuracy before they're shown to
            other cuddlers. We only collect and display what's submitted.
          </p>
          <p className="mt-3">
            {SITE_NAME} is not responsible for a client's actions, for the accuracy, completeness, or truthfulness
            of any report submitted by a cuddler, or for any decision another cuddler makes based on a
            report. Submitting a report you know to be false is a violation of these Terms and may result in
            account suspension or termination.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Prohibited use and law enforcement</h2>
          <p className="mt-3">
            {SITE_NAME} does not support or condone the use of the site to facilitate, advertise, or arrange any
            illegal activity, including anything prohibited under state or federal law. We cooperate with law
            enforcement and will comply with valid subpoenas, court orders, and other lawful requests for
            information, including account, listing, and verification records.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Strikes and account suspension</h2>
          <p className="mt-3">
            We use a three-strike policy for violations of these Terms. Each confirmed violation (including but
            not limited to a false or misleading listing, a substantiated report from a client, or a complaint
            referred by law enforcement) counts as one strike. After a third strike, we will investigate the
            account in full. If that investigation finds you have violated the law or these Terms, we will
            suspend or terminate the account. Suspensions and terminations under this policy are not eligible for
            a refund. We may also skip this process and suspend or terminate an account immediately for serious
            violations, such as illegal activity, fraudulent verification documents, or a threat to another
            person's safety.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Disclaimer of warranties</h2>
          <p className="mt-3">
            {SITE_NAME} is provided "as is" and "as available," without warranties of any kind, express or
            implied, including any warranty that the site will be uninterrupted, error-free, or secure, or that
            any cuddler's information is accurate or complete.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Limitation of liability</h2>
          <p className="mt-3">
            To the fullest extent permitted by law, {SITE_NAME} and its owners will not be liable for any
            indirect, incidental, special, or consequential damages, or for any damages arising from a session
            arranged through the site, including damages related to a cuddler's conduct, licensing status, or
            service quality. Our total liability for any claim relating to the site is limited to the amount you
            paid us, if any, in the 12 months before the claim arose.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Indemnification</h2>
          <p className="mt-3">
            You agree to defend, indemnify, and hold harmless {SITE_NAME}, {LEGAL_ENTITY}, and our owners,
            employees, and contractors from any claim, damage, loss, liability, or expense (including reasonable
            attorneys' fees) arising out of or related to: your use of the site; any session, meeting, or
            interaction you have with another user, whether arranged through the site or not; your violation of
            these Terms; or your violation of any law or the rights of a third party.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Termination</h2>
          <p className="mt-3">
            We may suspend or terminate any account, at any time, for violating these Terms (see "Strikes and
            account suspension" above), submitting fraudulent verification documents, or for any other reason at
            our discretion. You may close your account at any time by contacting us. See "Subscriptions,
            payments, and refunds" above for our refund policy.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Governing law</h2>
          <p className="mt-3">
            These Terms are governed by the laws of the State of {LEGAL_STATE}, without regard to conflict-of-law
            rules, and any dispute not otherwise resolved will be subject to the exclusive jurisdiction of the
            courts located in {LEGAL_STATE}.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Changes to these Terms</h2>
          <p className="mt-3">
            We may update these Terms from time to time. We'll update the date at the top of this page when we
            do; continuing to use {SITE_NAME} after a change means you accept the updated Terms.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Contact us</h2>
          <p className="mt-3">
            Questions about these Terms can be sent to{" "}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="font-medium text-spruce hover:underline">
              {LEGAL_CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
