/**
 * Minimal transactional email sender, used only for password reset links right now.
 *
 * Uses Resend (https://resend.com) — a simple, cheap email API. Free tier covers a small
 * site's volume comfortably. If RESEND_API_KEY isn't set (e.g. local dev before you've created
 * an account), this logs the email to the console instead of sending it, so the reset flow is
 * still testable without a real inbox.
 */

const FROM = process.env.RESEND_FROM_EMAIL || "Find Me Cuddle <onboarding@resend.dev>";

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const subject = "Reset your Find Me Cuddle password";
  const html = `
    <p>Someone requested a password reset for this account.</p>
    <p><a href="${resetUrl}">Click here to set a new password</a>. This link expires in 1 hour.</p>
    <p>If you didn't request this, you can safely ignore this email.</p>
  `;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.log(`[email:dev] Would send password reset to ${to}:\n${resetUrl}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error("Failed to send password reset email:", await res.text());
  }
}

/** Sent to SUPPORT_EMAIL (lib/config.ts) whenever someone submits the /contact form. */
export async function sendSupportEmail(opts: {
  to: string;
  fromName: string;
  fromEmail: string;
  subjectLine: string;
  message: string;
}) {
  const { to, fromName, fromEmail, subjectLine, message } = opts;
  const subject = `[Contact] ${subjectLine} — ${fromName}`;
  const html = `
    <p><strong>From:</strong> ${escapeHtml(fromName)} (${escapeHtml(fromEmail)})</p>
    <p><strong>Subject:</strong> ${escapeHtml(subjectLine)}</p>
    <p style="white-space: pre-line;">${escapeHtml(message)}</p>
  `;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.log(`[email:dev] Would send support message from ${fromEmail} to ${to}:\n${message}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    // reply_to means hitting "Reply" in the support inbox goes straight back to the sender.
    body: JSON.stringify({ from: FROM, to, subject, html, reply_to: fromEmail }),
  });

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error("Failed to send support email:", await res.text());
  }
}

/**
 * Sent to a cuddler when a client uses "Send My Info" on their public profile (see
 * /api/inquiries and components/SendInfoForm.tsx) — a lighter-weight alternative to on-site
 * messaging: the client's contact details land directly in the cuddler's own inbox, and any
 * follow-up happens off-platform via a normal reply/call/text, same as every other contact method
 * on the site. The same request is also saved to the inquiries table and shown in the cuddler's
 * dashboard message list (see MessagesCard.tsx), so this email is a real-time nudge, not the only
 * record of it. When the client provided an email, reply_to is set to it so hitting "Reply" in the
 * cuddler's inbox goes straight back to them.
 */
export async function sendInquiryEmail(opts: {
  to: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  message: string | null;
  cuddleType?: string | null;
  locationType?: "incall" | "outcall" | null;
  preferredDate?: string | null;
  preferredTime?: string | null;
  duration?: string | null;
  flexible?: boolean;
  cuddlerName: string;
  listingUrl: string;
  siteName: string;
}) {
  const {
    to,
    clientName,
    clientPhone,
    clientEmail,
    message,
    cuddleType,
    locationType,
    preferredDate,
    preferredTime,
    duration,
    flexible,
    cuddlerName,
    listingUrl,
    siteName,
  } = opts;
  const subject = `New inquiry from ${clientName} — ${siteName}`;
  const locationLabel = locationType === "incall" ? "In-Studio (at their place)" : locationType === "outcall" ? "Outcall (at client's place)" : null;
  const whenLabel = flexible
    ? "Whenever you're open"
    : [preferredDate, preferredTime].filter(Boolean).join(" at ") || null;
  const html = `
    <p>${escapeHtml(clientName)} would like to hear from you about your listing on ${escapeHtml(siteName)}.</p>
    <p>
      <strong>Name:</strong> ${escapeHtml(clientName)}<br />
      ${clientPhone ? `<strong>Phone:</strong> ${escapeHtml(clientPhone)}<br />` : ""}
      ${clientEmail ? `<strong>Email:</strong> ${escapeHtml(clientEmail)}<br />` : ""}
      ${cuddleType ? `<strong>Cuddle Type:</strong> ${escapeHtml(cuddleType)}<br />` : ""}
      ${duration ? `<strong>Duration:</strong> ${escapeHtml(duration)}<br />` : ""}
      ${whenLabel ? `<strong>Requested Time:</strong> ${escapeHtml(whenLabel)}<br />` : ""}
      ${locationLabel ? `<strong>Location:</strong> ${escapeHtml(locationLabel)}<br />` : ""}
    </p>
    ${message ? `<p style="white-space: pre-line;">${escapeHtml(message)}</p>` : ""}
    <p style="margin-top: 24px; font-size: 12px; color: #6B685F;">
      Sent via your listing at <a href="${listingUrl}">${listingUrl}</a>. Reply to this email${clientPhone ? ", or call/text the number above" : ""} to reach ${escapeHtml(clientName.split(" ")[0])} directly. This request is also saved in your ${escapeHtml(siteName)} dashboard.
    </p>
  `;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.log(`[email:dev] Would send inquiry from ${clientName} to ${to} (for ${cuddlerName})`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to,
      subject,
      html,
      ...(clientEmail ? { reply_to: clientEmail } : {}),
    }),
  });

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error(`Failed to send inquiry email to ${to}:`, await res.text());
  }
}

/** New-listings digest, sent by scripts/send-newsletter.ts — one email per subscriber. */
export async function sendNewsletterDigestEmail(opts: {
  to: string;
  name: string;
  siteName: string;
  siteUrl: string;
  listings: { name: string; city: string; state: string; url: string }[];
  unsubscribeUrl: string;
}) {
  const { to, name, siteName, siteUrl, listings, unsubscribeUrl } = opts;
  const subject = `${listings.length} New Cuddle Professional${listings.length === 1 ? "" : "s"} Near You`;
  const rows = listings
    .map(
      (l) =>
        `<li><a href="${l.url}">${escapeHtml(l.name)}</a> in ${escapeHtml(l.city)}, ${escapeHtml(l.state)}</li>`
    )
    .join("");
  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>New cuddlers just joined ${escapeHtml(siteName)} near you:</p>
    <ul>${rows}</ul>
    <p><a href="${siteUrl}">See all listings near you</a></p>
    <p style="margin-top: 24px; font-size: 12px; color: #6B685F;">
      You're receiving this because you signed up for local cuddler updates on ${escapeHtml(siteName)}.
      <a href="${unsubscribeUrl}">Unsubscribe</a> anytime.
    </p>
  `;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.log(`[email:dev] Would send newsletter digest to ${to}: ${listings.length} listing(s)`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error(`Failed to send newsletter digest to ${to}:`, await res.text());
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
