"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import type { ClientSafeCuddler } from "@/lib/auth";
import { updateListing } from "@/app/actions";
import { isVip, photoLimit } from "@/lib/stripe";
import { RATE_CONTACT_LABEL, GENDER_OPTIONS, SOCIAL_PLATFORMS, SOCIAL_LINKS_MAX, SOCIAL_URL_MAX_CHARS, ENJOYS_PETS_OPTIONS, BODY_TYPE_OPTIONS, HAIR_COLOR_OPTIONS, EYE_COLOR_OPTIONS } from "@/lib/config";
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
  const [offersVirtual, setOffersVirtual] = useState(t.offersVirtual);

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
          placeholder="Warm, easygoing cuddle sessions in a relaxed setting" maxLength={90} />
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

      <div className="border-t border-line pt-4">
        <label className="label">Where You See Clients</label>
        <div className="mt-1 grid gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="hosts" defaultChecked={t.hosts} className="h-4 w-4 accent-spruce" />
            {agencyAccount ? "We Can Host (Client Comes To Us)" : "I Can Host (Client Comes To Me)"}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="mobile" defaultChecked={t.mobile} className="h-4 w-4 accent-spruce" />
            {agencyAccount ? "I Am Mobile (We Travel To The Client)" : "I Am Mobile (I Travel To The Client)"}
          </label>
        </div>
      </div>

      {!agencyAccount && (
        <div className="border-t border-line pt-4">
          <label className="label">
            Rates (Leave Blank To Show "{RATE_CONTACT_LABEL}")
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-stone2" htmlFor="hourlyRate">Hourly Rate (In-Person)</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone2">$</span>
                <input
                  id="hourlyRate"
                  name="hourlyRate"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  defaultValue={t.hourlyRate ?? ""}
                  placeholder={RATE_CONTACT_LABEL}
                  className="field pl-6"
                />
              </div>
            </div>
            {offersVirtual && (
              <div>
                <label className="mb-1 block text-xs text-stone2" htmlFor="virtualHourlyRate">Hourly Rate (Virtual)</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone2">$</span>
                  <input
                    id="virtualHourlyRate"
                    name="virtualHourlyRate"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    defaultValue={t.virtualHourlyRate ?? ""}
                    placeholder={RATE_CONTACT_LABEL}
                    className="field pl-6"
                  />
                </div>
              </div>
            )}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="offersVirtual"
              checked={offersVirtual}
              onChange={(e) => setOffersVirtual(e.target.checked)}
              className="h-4 w-4 accent-spruce"
            />
            I Also Offer Virtual (Video Call) Sessions
          </label>
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

      {!agencyAccount && (
        <div className="border-t border-line pt-4">
          <label className="label">Getting To Know You</label>
          <p className="mt-1 text-xs text-stone2">
            Optional; helps clients get a sense of who you are beyond the logistics. Shown on your
            public listing only for whichever fields you fill in.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="favoriteFood">Favorite Food</label>
              <input id="favoriteFood" name="favoriteFood" defaultValue={t.favoriteFood ?? ""} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="favoriteDessert">Favorite Dessert</label>
              <input id="favoriteDessert" name="favoriteDessert" defaultValue={t.favoriteDessert ?? ""} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="favoriteAnimal">Favorite Animal</label>
              <input id="favoriteAnimal" name="favoriteAnimal" defaultValue={t.favoriteAnimal ?? ""} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="enjoysPets">Do You Enjoy Pets?</label>
              <select id="enjoysPets" name="enjoysPets" defaultValue={t.enjoysPets ?? ""} className="field">
                <option value="">Prefer not to say</option>
                {ENJOYS_PETS_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="allergies">Allergies</label>
              <input id="allergies" name="allergies" defaultValue={t.allergies ?? ""} className="field" placeholder="None, or list any" />
            </div>
            <div>
              <label className="label" htmlFor="favoriteMusic">Favorite Music (Artist Or Band)</label>
              <input id="favoriteMusic" name="favoriteMusic" defaultValue={t.favoriteMusic ?? ""} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="favoriteMovie">Favorite Movie</label>
              <input id="favoriteMovie" name="favoriteMovie" defaultValue={t.favoriteMovie ?? ""} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="favoriteShow">Favorite TV Show</label>
              <input id="favoriteShow" name="favoriteShow" defaultValue={t.favoriteShow ?? ""} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="height">Height</label>
              <input id="height" name="height" defaultValue={t.height ?? ""} className="field" placeholder={"e.g. 5'8\""} maxLength={20} />
            </div>
            <div>
              <label className="label" htmlFor="bodyType">Body Type</label>
              <select id="bodyType" name="bodyType" defaultValue={t.bodyType ?? ""} className="field">
                <option value="">Prefer not to say</option>
                {BODY_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="hairColor">Hair Color</label>
              <select id="hairColor" name="hairColor" defaultValue={t.hairColor ?? ""} className="field">
                <option value="">Prefer not to say</option>
                {HAIR_COLOR_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="eyeColor">Eye Color</label>
              <select id="eyeColor" name="eyeColor" defaultValue={t.eyeColor ?? ""} className="field">
                <option value="">Prefer not to say</option>
                {EYE_COLOR_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 grid gap-3">
            <div>
              <label className="label" htmlFor="favoriteActivities">Favorite Things To Do</label>
              <input id="favoriteActivities" name="favoriteActivities" defaultValue={t.favoriteActivities ?? ""} className="field" maxLength={300} />
            </div>
            <div>
              <label className="label" htmlFor="enjoysAboutCuddling">What Do You Enjoy About Cuddling?</label>
              <textarea id="enjoysAboutCuddling" name="enjoysAboutCuddling" defaultValue={t.enjoysAboutCuddling ?? ""} rows={3} className="field" maxLength={500} />
            </div>
            <div>
              <label className="label" htmlFor="nextVacationDestination">Next Vacation Destination</label>
              <input id="nextVacationDestination" name="nextVacationDestination" defaultValue={t.nextVacationDestination ?? ""} className="field" />
            </div>
          </div>
        </div>
      )}

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
