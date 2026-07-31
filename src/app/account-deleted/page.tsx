import Link from "next/link";
import { SITE_NAME } from "@/lib/config";

export const metadata = { title: "Account Deleted" };

export default function AccountDeletedPage() {
  return (
    <div className="container-page flex justify-center py-24">
      <div className="card max-w-md p-8 text-center">
        <h1 className="font-display text-xl font-semibold">Your Account Has Been Deleted</h1>
        <p className="mt-2 text-sm text-stone2">
          Your listing, photos, and subscription have all been removed. Any active billing was
          canceled immediately. Thanks for having been part of {SITE_NAME}.
        </p>
        <Link href="/" className="btn-ghost mt-5 inline-block">Back To Home</Link>
      </div>
    </div>
  );
}
