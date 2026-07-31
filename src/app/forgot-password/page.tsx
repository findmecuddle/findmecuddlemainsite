import { redirect } from "next/navigation";

// Superseded — password reset is now handled inside Clerk's <SignIn> component on /login itself
// ("Forgot password?" is built into that flow). Kept as a redirect stub rather than deleted so any
// bookmarked/indexed links to this URL still land somewhere useful.
export default function ForgotPasswordPage() {
  redirect("/login");
}
