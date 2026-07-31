import { SUPPORT_EMAIL } from "@/lib/config";
import ContactForm from "@/components/ContactForm";

export const metadata = { title: "Contact Support" };

export default function ContactPage() {
  return (
    <div className="container-page flex justify-center py-16">
      <div className="w-full max-w-lg">
        <h1 className="font-display text-2xl font-semibold">Contact Support</h1>
        <p className="mt-2 text-sm text-stone2">
          Questions, account help, or anything else, send us a message and we'll reply from {SUPPORT_EMAIL}.
        </p>
        <div className="mt-6">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
