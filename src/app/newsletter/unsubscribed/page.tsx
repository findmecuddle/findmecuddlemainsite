import Link from "next/link";

export const metadata = { title: "Unsubscribed" };

export default function UnsubscribedPage() {
  return (
    <div className="container-page flex justify-center py-24">
      <div className="card max-w-md p-8 text-center">
        <h1 className="font-display text-xl font-semibold">You're Unsubscribed</h1>
        <p className="mt-2 text-sm text-stone2">
          You won't receive any more new-cuddler emails from us. Changed your mind? You can
          resubscribe anytime from the homepage.
        </p>
        <Link href="/" className="btn-ghost mt-5 inline-block">Back To Home</Link>
      </div>
    </div>
  );
}
