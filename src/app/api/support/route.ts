import { NextRequest, NextResponse } from "next/server";
import { verifyCaptcha } from "@/lib/captcha";
import { sendSupportEmail } from "@/lib/email";
import { SUPPORT_EMAIL, CONTACT_BODY_MAX_CHARS } from "@/lib/config";

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim();
  const subject = String(form.get("subject") || "General Question").trim();
  const message = String(form.get("message") || "").trim().slice(0, CONTACT_BODY_MAX_CHARS);

  if (!name) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!message) return NextResponse.json({ error: "Enter a message." }, { status: 400 });

  if (!(await verifyCaptcha(form.get("cf-turnstile-response")))) {
    return NextResponse.json({ error: "Captcha check failed, please try again." }, { status: 400 });
  }

  await sendSupportEmail({ to: SUPPORT_EMAIL, fromName: name, fromEmail: email, subjectLine: subject, message });

  return NextResponse.json({ ok: true });
}
