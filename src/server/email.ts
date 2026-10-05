export interface Email {
  to: string;
  subject: string;
  text: string;
  attachments?: { filename: string; content: Buffer }[];
}

export type EmailSender = (email: Email) => Promise<{ sent: boolean }>;

/** Without RESEND_API_KEY emails are only logged, so development never sends real mail. */
const defaultSender: EmailSender = async (email) => {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email not sent: RESEND_API_KEY missing] to=${email.to} subject="${email.subject}"`);
    return { sent: false };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Family Tracker <onboarding@resend.dev>",
      to: [email.to],
      subject: email.subject,
      text: email.text,
      attachments: email.attachments?.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })),
    }),
  });
  if (!res.ok) throw new Error(`Email provider error ${res.status}: ${await res.text()}`);
  return { sent: true };
};

let sender: EmailSender = defaultSender;

/** Test hook. */
export function setEmailSender(fn: EmailSender | null) {
  sender = fn ?? defaultSender;
}

export function sendEmail(email: Email) {
  return sender(email);
}
