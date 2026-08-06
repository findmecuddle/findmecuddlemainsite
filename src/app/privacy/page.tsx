import { SITE_NAME, LEGAL_CONTACT_EMAIL, LEGAL_ENTITY, LEGAL_STATE } from "@/lib/config";

// DRAFT LEGAL TEMPLATE — not reviewed by an attorney. Have a licensed California attorney
// review this before relying on it in production, especially given government ID/license
// documents are collected for cuddler verification. See NEXT_STEPS.md.
export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  const updated = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="container-page max-w-3xl py-14">
      <h1 className="font-display text-3xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-stone2">Last updated {updated}</p>

      <div className="mt-8 grid gap-8 text-sm leading-relaxed text-ink/90">
        <p>
          {LEGAL_ENTITY} ("{SITE_NAME}," "we," "us," or "our") operates a directory that helps clients find
          independent cuddle professionals and lets cuddlers list and manage their own advertisements. This
          policy explains what personal information we collect, how we use it, and the choices you have. It
          applies to everyone who uses {SITE_NAME}: clients browsing listings and cuddlers who create them.
        </p>

        <section>
          <h2 className="font-display text-xl font-semibold">Information we collect</h2>
          <p className="mt-3">
            <strong>Account and listing information.</strong> When a cuddler creates an account, we collect
            their name, email, password (stored as a one-way hash, never in plain text), phone number, business
            location(s), service descriptions, rates, hours, and any photos they upload for their ad.
          </p>
          <p className="mt-3">
            <strong>Identity verification documents.</strong> Before a cuddler's listing can go live, we
            require a photo of any cuddle therapy certification they hold (or an attestation that they don't
            hold one) and a government-issued photo ID. These are the most sensitive documents we handle, and
            they're treated differently from ad photos: they're stored in a separate, private location that is
            never publicly accessible, and only accessible to a small number of authorized administrators
            reviewing the submission. We use these documents solely to confirm a cuddler's identity and
            certification before allowing their listing to appear publicly, and they are never shown to clients
            or displayed anywhere on the site.
          </p>
          <p className="mt-3">
            <strong>Reviews and reports.</strong> Clients can leave a review or submit a report about a listing
            without creating an account. We collect the name and (optional) email they provide, the content of
            the review or report, and any evidence photos submitted with a report.
          </p>
          <p className="mt-3">
            <strong>Inquiry messages ("Send My Info").</strong> A client can leave their name, phone and/or
            email, and optional appointment details (requested date/time or "whenever you're open," how
            long, and whether they'd rather meet at their place or the cuddler's) for a cuddler without
            creating an account. This is emailed directly to the cuddler and stored so it also appears in
            that cuddler's own dashboard. It is never shown publicly and is only visible to the cuddler the
            client contacted.
          </p>
          <p className="mt-3">
            <strong>Customer reports (flagged contacts).</strong> A cuddler can report a client's phone number
            or email, for example after a no-show, scam attempt, or harassment. We store only the contact
            value and an internal note visible solely to the cuddler who submitted it; we never collect or
            store the client's name as part of a report. If that same phone number or email later contacts a
            different cuddler through the site, it is shown to that cuddler as a yellow or red warning
            indicator (based on how many times it's been reported), never with the reporting cuddler's
            identity, their note, or any other detail attached, and never shown publicly.
          </p>
          <p className="mt-3">
            <strong>Payment information.</strong> Subscription and boost-credit payments are processed by
            Stripe, Inc. We do not receive or store full payment card numbers, since Stripe handles that directly and
            provides us only with limited transaction information (such as subscription status and payment
            history) needed to run the service.
          </p>
          <p className="mt-3">
            <strong>Marketing email consent.</strong> At signup, a cuddler can optionally check a box to
            receive occasional promotional emails from us. This is off by default and separate from the required
            account emails (like password resets) we send regardless of this choice. We record the date consent
            was given so we can show it was a real opt-in, not a default.
          </p>
          <p className="mt-3">
            <strong>Automatically collected information.</strong> Like most websites, our servers log standard
            technical information (IP address, browser type, pages visited, timestamps) for security and
            troubleshooting. We use a session cookie to keep cuddlers and administrators logged in; we do not
            use third-party advertising or tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">How we use this information</h2>
          <p className="mt-3">We use the information above to:</p>
          <p className="mt-3">
            operate and display the directory; verify a cuddler's identity and licensing before publishing
            their listing; process subscription payments and boost purchases through Stripe; moderate
            client-submitted reviews and reports; respond to support requests; send required account emails
            (such as password resets); and, only where a cuddler has explicitly opted in, either feature their
            listing information or photos in our own marketing and social media (dashboard opt-in), or send them
            promotional emails (signup opt-in). We do not use verification documents (license/ID photos) for
            marketing under any circumstance.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Who we share information with</h2>
          <p className="mt-3">
            We share information with service providers who help us run {SITE_NAME}, currently: Stripe (payment
            processing) and Cloudflare (photo and document storage). These providers only receive what they need
            to perform their function and are not permitted to use it for their own purposes. Public listing
            information (name, photos, bio, services, rates, hours, location, reviews) is, by design, visible to
            anyone browsing the site. Verification documents are never shared publicly or with any third party
            beyond the storage provider hosting them. We do not sell personal information.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">How long we keep information</h2>
          <p className="mt-3">
            We retain account and listing information for as long as an account remains active. Verification
            documents are retained only as long as needed to support an active or recently active listing and
            for basic compliance recordkeeping; a cuddler may request deletion of their account and associated
            documents at any time by contacting us below.
          </p>
          <p className="mt-3">
            <strong>Customer reports (flagged contacts).</strong> Reports are retained indefinitely so that a
            reported phone number or email stays flagged for as long as the report exists. A cuddler can
            request removal of a specific report by contacting us below if they believe it was filed in error.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Your rights and choices</h2>
          <p className="mt-3">
            Cuddlers can review and update most of their information directly from their dashboard at any
            time, including their social media marketing opt-in. Every promotional email includes an unsubscribe
            link, and unsubscribing (or contacting us) stops promotional email immediately; it does not affect
            required account emails or your listing. As a {LEGAL_STATE}-based business, we honor requests from
            California residents to know what personal information we hold about them, correct it, or delete it,
            and we do not sell or share personal information as those terms are defined under California law.
            To make any of these requests, contact us at the email below.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Security</h2>
          <p className="mt-3">
            We use industry-standard safeguards appropriate to the sensitivity of each type of data, including
            encrypted connections (HTTPS), one-way password hashing, and storing verification documents in a
            private, non-public location accessible only to authorized administrators. No method of storage or
            transmission is perfectly secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Children's privacy</h2>
          <p className="mt-3">
            {SITE_NAME} is not directed to, and is not intended for use by, anyone under 18. Cuddlers must be
            18 or older to register.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Changes to this policy</h2>
          <p className="mt-3">
            We may update this policy from time to time. We'll update the date at the top of this page when we
            do; significant changes will be communicated to registered cuddlers by email.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Contact us</h2>
          <p className="mt-3">
            Questions about this policy, or requests regarding your personal information, can be sent to{" "}
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
