import { clerkMiddleware } from "@clerk/nextjs/server";

// Required for Clerk to attach auth() context to every request. Doesn't restrict any routes
// itself — each page/action still does its own currentCuddler()/redirect check, same pattern
// as before. Admin routes are untouched (lib/adminAuth.ts is a completely separate system).
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params
    "/((?!_next|.*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
