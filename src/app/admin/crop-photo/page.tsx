import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cuddlers } from "@/lib/schema";
import { currentAdmin } from "@/lib/adminAuth";
import CropTool from "./CropTool";

export const dynamic = "force-dynamic";

// Crop only ever applies to a cuddler's main profile photo (slot 1) — see the comment on
// cardPhotoUrl in schema.ts for why the other photo slots and agency employee photos aren't croppable
// here (they don't appear on cards, so there'd be nothing for a crop to fix).
export default async function CropPhotoPage(props: {
  searchParams: Promise<{ flagId?: string; cuddlerId?: string }>;
}) {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");

  const { flagId, cuddlerId } = await props.searchParams;
  if (!cuddlerId) notFound();

  const [t] = await db.select().from(cuddlers).where(eq(cuddlers.id, cuddlerId)).limit(1);
  if (!t || !t.photoUrl) notFound();

  const backHref = `/admin/cuddlers/${t.id}/edit`;

  return (
    <div className="container-page max-w-3xl py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Crop Card Photo</h1>
          <p className="mt-1 text-sm text-stone2">{t.name}</p>
        </div>
        <Link href={backHref} className="btn-ghost">Cancel</Link>
      </div>

      <p className="mt-3 max-w-xl text-xs text-stone2">
        This only changes the small square thumbnail shown on the homepage and search cards. The full photo on{" "}
        {t.name}&rsquo;s public profile page stays exactly as they uploaded it. Drag on the photo below to draw a
        crop box, adjust it as needed, then save. You can undo this later from the Edit page if it doesn&rsquo;t
        look right.
      </p>

      <div className="mt-6">
        <CropTool photoUrl={t.photoUrl} cuddlerId={t.id} flagId={flagId} backHref={backHref} />
      </div>
    </div>
  );
}
