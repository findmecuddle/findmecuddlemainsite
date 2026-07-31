import { redirect } from "next/navigation";
import { currentClerkUserId, currentCuddler } from "@/lib/auth";
import OnboardingForm from "./OnboardingForm";

export const dynamic = "force-dynamic";

// One-time step right after a Clerk signup: Clerk only collected login credentials, so this is
// where we collect the actual listing info (name, location, consent) and create the cuddlers
// row — see completeOnboarding() in app/actions.ts.
export default async function OnboardingPage() {
  const userId = await currentClerkUserId();
  if (!userId) redirect("/login");

  const already = await currentCuddler();
  if (already) redirect("/dashboard");

  return (
    <div className="container-page flex justify-center py-16">
      <div className="card w-full max-w-md p-8">
        <h1 className="font-display text-2xl font-semibold">Finish setting up your listing</h1>
        <p className="mt-1 text-sm text-stone2">
          Your account's created — just a couple more details before your dashboard is ready.
        </p>
        <OnboardingForm />
      </div>
    </div>
  );
}
