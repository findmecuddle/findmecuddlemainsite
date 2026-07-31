"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import type { ClientSafeCuddler } from "@/lib/auth";
import { updateListing } from "@/app/actions";
import { isVip, photoLimit } from "@/lib/stripe";
import { RATE_DURATIONS, RATE_CONTACT_LABEL, RATE_NOT_OFFERED, CUDDLE_TYPES, AMENITIES, PAYMENT_METHODS, DISCOUNT_TYPES, WEBSITE_URL_MAX_CHARS, GENDER_OPTIONS, SOCIAL_PLATFORMS, SOCIAL_LINKS_MAX, SOCIAL_URL_MAX_CHARS } from "@/lib/config";
import { parseSocialLinks } from "@/lib/socialLinks";
import PhotoUploader from "./PhotoUploader";

type FormAction = (
  state: { error?: string; ok?: string } | null,
  formData: FormData
) => Promise<{ error?: string; ok?: string }>;

export default function ListingForm({
  cuddler: t,
  action: actionProp,
  flagPhotoAction,
  undoCropAction,
}: {
  cuddler: ClientSafeCuddler;
  // Lets the admin "edit on behalf of a cuddler" panel pass a bound admin action
  // (adminUpdateListing.bind(null, cuddlerId)) instead of the cuddler's own updateListing —
  // same form, same validation, different auth/target. See admin/cuddlers/[id]/edit/page.tsx.
  action?: FormAction;
  // Admin-only: manualFlagPhoto from admin/actions.ts. Passing this (along with undoCropAction)
  // switches the photo editor below into admin mode — same Change/Remove/Set As Profile Pic
  // controls as the cuddler's own dashboard, uploading through the admin-authenticated routes,
  // plus Flag and Undo Crop on the profile pic. Undefined on the cuddler's own dashboard.
  flagPhotoAction?: (formData: FormData) => void | Promise<void>;
  // Admin-only: undoCardCrop from admin/actions.ts — reverts a manual crop on the profile photo
  // (slot 1) card thumbnail. Undefined on the cuddler's own dashboard.
  undoCropAction?: (formData: FormData) => void | Promise<void>;
}) {
  const [state, action] = useFormState(
    actionProp ?? updateListing,
    null as null | { error?: string; ok?: string }
  );

  const vip = isVip(t);
  const agencyAccount = t.accountType === "agency";
  const selectedServices = (t.services ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const otherServices = selectedServices.filter((s) => !CUDDLE_TYPES.includes(s));
  const selectedAmenities = (t.amenities ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const otherAmenities = selectedAmenities.filter((a) => !AMENITIES.includes(a));
  const selectedPayments = (t.paymentMethods ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const otherPayments = selectedPayments.filter((p) => !PAYMENT_METHODS.includes(p));
  const selectedDiscounts = (t.discounts ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const otherDiscounts = selectedDiscounts.filter((d) => !DISCOUNT_TYPES.includes(d));

  // Pad out to SOCIAL_LINKS_MAX rows so the form always renders a fixed number of platform/URL
  // pairs regardless of how many the cuddler has actually filled in — see socialLinks.ts.
  const existingSocialLinks = parseSocialLinks(t.socialLinks);
  const socialLinkRows = Array.from({ length: SOCIAL_LINKS_MAX }, (_, i) => existingSocialLinks[i] ?? { platform: "", url: "" });

  const [acceptsCalls, setAcceptsCalls] = useState(t.acceptsCalls);
  const [acceptsTexts, setAcceptsTexts] = useState(t.acceptsTexts);
  const [acceptsEmail, setAcceptsEmail] = useState(t.acceptsEmail);
  // Coerced to a real boolean — the column is nullable at the DB level (see schema.ts), but the
  // checkbox's `checked` prop needs a plain boolean, not boolean | null.
  const [messagesOnly, setMessagesOnly] = useState(!!t.messagesOnly);
  const needsPhone = !messagesOnly && (acceptsCalls || acceptsTexts);

  // Site Messages Only is mutually exclusive with the other three — checking it clears them (so
  // the form matches what applyListingUpdate will actually save), and it disables them rather than
  // hiding them so it's obvious why they're unavailable instead of them just vanishing.
  function toggleMessagesOnly(next: boolean) {
    setMessagesOnly(next);
    if (next) {
      setAcceptsCalls(false);
      setAcceptsTexts(false);
      setAcceptsEmail(false);
    }
  }

  // Which rate durations are marked "I don't offer this" — starts from whatever's already stored
  // (RATE_NOT_OFFERED sentinel) so re-opening the form shows the checkbox already checked.
  const [notOffered, setNotOffered] = useState<Set<string>>(
    new Set(RATE_DURATIONS.filter(({ key }) => t[key] === RATE_NOT_OFFERED).map(({ key }) => key))
  );
  function toggleNotOffered(key: string, checked: boolean) {
    setNotOffered((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  return (
    <form action={action} className="card grid gap-4 p-6">
      <h2 className="font-display text-lg font-semibold">Edit Your Ad</h2>

      <div>
        <label className="label" htmlFor="name">{agencyAccount ? "Agency Or Business Name" : "Display Name"}</label>
        <input id="name" name="name" defaultValue={t.name} className="field" required />
      </div>

      <div className="border-t border-line pt-4">
        <label className="label">Contact Methods (Select At Least 1)</label>
        <div className="mt-1 grid gap-3 sm:grid-cols-2">
          <label className={`flex items-center gap-2 text-sm ${messagesOnly ? "opacity-40" : ""}`}>
            <input
              type="checkbox"
              name="acceptsCalls"
              checked={acceptsCalls}
              disabled={messagesOnly}
              onChange={(e) => setAcceptsCalls(e.target.checked)}
              className="h-4 w-4 accent-spruce"
            />
            Phone Call
          </label>
          <label className={`flex items-center gap-2 text-sm ${messagesOnly ? "opacity-40" : ""}`}>
            <input
              type="checkbox"
              name="acceptsTexts"
              checked={acceptsTexts}
              disabled={messagesOnly}
              onChange={(e) => setAcceptsTexts(e.target.checked)}
              className="h-4 w-4 accent-spruce"
            />
            Text
          </label>
          <label className={`flex items-center gap-2 text-sm ${messagesOnly ? "opacity-40" : ""}`}>
            <input
              type="checkbox"
              name="acceptsEmail"
              checked={acceptsEmail}
              disabled={messagesOnly}
              onChange={(e) => setAcceptsEmail(e.target.checked)}
              className="h-4 w-4 accent-spruce"
            />
            Email
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="messagesOnly"
              checked={messagesOnly}
              onChange={(e) => toggleMessagesOnly(e.target.checked)}
              className="h-4 w-4 accent-spruce"
            />
            Site Messages Only
          </label>
        </div>
        {messagesOnly && (
          <p className="mt-2 text-xs text-stone2">
            Your phone and email stay private. Clients can only reach you through &ldquo;Send My
            Info&rdquo; on your profile. Every message is automatically checked against reports
            from other cuddlers before it reaches your inbox.
          </p>
        )}

        {needsPhone && (
          <div className="mt-3">
            <label className="label" htmlFor="phone">Phone Number (Shown To Clients)</label>
            <input id="phone" name="phone" defaultValue={t.phone ?? ""} className="field" placeholder="(555) 201-8834" required />
          </div>
        )}
        {acceptsEmail && (
          <div className="mt-3">
            <label className="label" htmlFor="contactEmail">Contact Email (Shown To Clients, Can Differ From Your Login Email)</label>
            <input id="contactEmail" name="contactEmail" type="email" defaultValue={t.contactEmail ?? ""} className="field"
              placeholder="jordan@example.com" required />
          </div>
        )}
      </div>

      {!agencyAccount && (
        <div>
          <label className="label" htmlFor="gender">Gender (Optional)</label>
          <select id="gender" name="gender" defaultValue={t.gender ?? ""} className="field">
            <option value="">Prefer not to say</option>
            {GENDER_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="label" htmlFor="headline">Headline</label>
        <input id="headline" name="headline" defaultValue={t.headline ?? ""} className="field"
          placeholder="Deep tissue & sports cuddle — 10 years experience" maxLength={90} />
      </div>

      <div>
        <label className="label" htmlFor="bio">{agencyAccount ? "About Your Agency" : "About You"}</label>
        <textarea id="bio" name="bio" defaultValue={t.bio ?? ""} rows={6} className="field"
          placeholder={
            agencyAccount
              ? "Tell clients about your agency, your space, and what to expect."
              : "Tell clients about your background, approach, and what to expect."
          } />
      </div>

      {agencyAccount ? (
        <div className="border-t border-line pt-4">
          <p className="text-xs text-stone2">
            Cuddle types are set per team member in the &ldquo;Your Team&rdquo; section below — they
            automatically show up on your public listing.
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" name="mobile" defaultChecked={t.mobile} className="h-4 w-4 accent-spruce" />
            Mobile Session (We Travel To The Client)
          </label>
        </div>
      ) : (
        <div>
          <label className="label">Services</label>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {CUDDLE_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="services"
                  value={type}
                  defaultChecked={selectedServices.includes(type)}
                  className="h-4 w-4 accent-spruce"
                />
                {type}
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="mobile" defaultChecked={t.mobile} className="h-4 w-4 accent-spruce" />
              Mobile Session (I Travel To The Client)
            </label>
          </div>
          <input
            name="servicesOther"
            defaultValue={otherServices.join(", ")}
            className="field mt-3"
            placeholder="Other (comma separated) — anything not listed above"
          />
        </div>
      )}

      <div>
        <label className="label">Amenities &amp; Add-Ons</label>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {AMENITIES.map((item) => (
            <label key={item} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="amenities"
                value={item}
                defaultChecked={selectedAmenities.includes(item)}
                className="h-4 w-4 accent-spruce"
              />
              {item}
            </label>
          ))}
        </div>
        <input
          name="amenitiesOther"
          defaultValue={otherAmenities.join(", ")}
          className="field mt-3"
          placeholder="Other (comma separated) — anything not listed above"
        />
      </div>

      <div>
        <label className="label">Payment Methods Accepted</label>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {PAYMENT_METHODS.map((method) => (
            <label key={method} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="paymentMethods"
                value={method}
                defaultChecked={selectedPayments.includes(method)}
                className="h-4 w-4 accent-spruce"
              />
              {method}
            </label>
          ))}
        </div>
        <input
          name="paymentMethodsOther"
          defaultValue={otherPayments.join(", ")}
          className="field mt-3"
          placeholder="Other (comma separated) — anything not listed above"
        />
      </div>

      <div>
        <label className="label">Discounts &amp; Promotions</label>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {DISCOUNT_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="discounts"
                value={type}
                defaultChecked={selectedDiscounts.includes(type)}
                className="h-4 w-4 accent-spruce"
              />
              {type}
            </label>
          ))}
        </div>
        <input
          name="discountsOther"
          defaultValue={otherDiscounts.join(", ")}
          className="field mt-3"
          placeholder="Other (comma separated) — e.g. &quot;10% off for teachers&quot;"
        />
      </div>

      {!agencyAccount && (
        <div>
          <label className="label">
            Rates (Leave Blank To Show "{RATE_CONTACT_LABEL}" For That Length, Or Check "I Don&rsquo;t
            Offer This" To Remove It From Your Listing)
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {RATE_DURATIONS.map(({ key, label }) => {
              const isNotOffered = notOffered.has(key);
              const storedRate = t[key] === RATE_NOT_OFFERED ? "" : t[key] ?? "";
              return (
                <div key={key}>
                  <label className="mb-1 block text-xs text-stone2" htmlFor={key}>{label}</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone2">$</span>
                    <input
                      id={key}
                      name={key}
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      defaultValue={storedRate}
                      placeholder={RATE_CONTACT_LABEL}
                      disabled={isNotOffered}
                      className="field pl-6 disabled:bg-porcelain disabled:text-stone2"
                    />
                  </div>
                  <label className="mt-1.5 flex items-center gap-1.5 text-xs text-stone2">
                    <input
                      type="checkbox"
                      name={`${key}NotOffered`}
                      checked={isNotOffered}
                      onChange={(e) => toggleNotOffered(key, e.target.checked)}
                      className="h-3.5 w-3.5 accent-spruce"
                    />
                    I Don&rsquo;t Offer This
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="location">Primary Location (Zip Or City, ST)</label>
          <input id="location" name="location" defaultValue={t.zip || `${t.city}, ${t.state}`} className="field" required />
        </div>
        <div>
          <label className="label" htmlFor="location2">Second Location {vip ? "(Optional)" : ""}</label>
          {vip ? (
            <input id="location2" name="location2" defaultValue={t.zip2 || (t.city2 ? `${t.city2}, ${t.state2}` : "")}
              className="field" placeholder="Zip code or City, ST" />
          ) : (
            <p className="rounded-lg border border-line bg-porcelain px-3 py-2.5 text-sm leading-relaxed text-stone2">
              <Link href="/pricing" className="font-medium text-spruce hover:underline">Upgrade to Monthly VIP</Link>
              {" "}to post a second location.
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-line pt-4">
        <label className="label" htmlFor="websiteUrl">Your Website (Optional)</label>
        <input
          id="websiteUrl"
          name="websiteUrl"
          type="text"
          defaultValue={t.websiteUrl ?? ""}
          className="field"
          placeholder="yourbusiness.com"
          maxLength={WEBSITE_URL_MAX_CHARS}
        />
        <p className="mt-1 text-xs text-stone2">
          Link to your own personal or business website. Our team reviews every new or changed link before it's
          shown on your public listing — we don't allow links we haven't checked.
        </p>
        {t.websiteStatus === "pending" && (
          <p className="mt-2 text-xs font-medium text-gold">Pending review — not shown on your listing yet.</p>
        )}
        {t.websiteStatus === "approved" && (
          <p className="mt-2 text-xs font-medium text-spruce">✓ Approved — shown on your public listing.</p>
        )}
        {t.websiteStatus === "rejected" && (
          <p className="mt-2 text-xs font-medium text-red-700">
            Not approved{t.websiteNote ? `: ${t.websiteNote}` : ""}.
          </p>
        )}
      </div>

      <div className="border-t border-line pt-4">
        <label className="label">Social Links (Optional, Up To {SOCIAL_LINKS_MAX})</label>
        <p className="mt-1 text-xs text-stone2">
          Add your Instagram, TikTok, or X profile. These go live right away, no review needed.
        </p>
        <div className="mt-2 grid gap-2">
          {socialLinkRows.map((row, i) => (
            <div key={i} className="flex gap-2">
              <select
                name={`social_platform_${i + 1}`}
                defaultValue={row.platform}
                className="field w-36 shrink-0"
              >
                <option value="">Platform…</option>
                {SOCIAL_PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <input
                name={`social_url_${i + 1}`}
                type="text"
                defaultValue={row.url}
                className="field flex-1"
                placeholder="https://..."
                maxLength={SOCIAL_URL_MAX_CHARS}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-line pt-4">
        <p className="text-sm font-medium text-ink">Photo Requirements</p>
        <p className="mt-1 text-xs text-stone2">
          Include at least one full-face photo of yourself, no AI-generated images, and one photo of your
          workspace, agency, or location. Photos go live as soon as you upload them.
        </p>
        {t.photosStatus === "approved" && (
          <p className="mt-2 text-xs font-medium text-spruce">✓ Your photos are live.</p>
        )}
      </div>

      <PhotoUploader
        cuddler={t}
        maxPhotos={photoLimit(t)}
        admin={flagPhotoAction && undoCropAction ? { flagPhotoAction, undoCropAction } : undefined}
      />

      <p className="border-t border-line pt-4 text-xs text-stone2">
        Publishing your ad live is now a one-click toggle in the Status card on the right, not part of this
        form.
      </p>

      <label className="flex items-start gap-2 border-t border-line pt-4 text-sm">
        <input
          type="checkbox"
          name="socialMediaOptIn"
          defaultChecked={t.socialMediaOptIn}
          className="mt-0.5 h-4 w-4 accent-spruce"
        />
        <span>
          I agree to let Find Me Cuddle use my listing information and photos in our marketing
          and social media (Instagram, X, etc.). (Optional) You can uncheck this any time.
        </span>
      </label>

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-spruce">{state.ok}</p>}
      <button className="btn-primary w-fit">Save Changes</button>
    </form>
  );
}
