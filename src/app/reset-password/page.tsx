import { redirect } from "next/navigation";

// Superseded — password reset is now handled inside Clerk's <SignIn> component on /login itself.
// Kept as a redirect stub rather than deleted so old emailed reset links still land somewhere useful.
export default function ResetPasswordPage() {
  redirect("/login");
}
