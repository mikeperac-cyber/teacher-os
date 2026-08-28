/**
 * Email integration — scaffolding that works without keys and real provider when connected.
 *
 * Two modes:
 *  - If RESEND_API_KEY is set, send via Resend (https://resend.com) — the
 *    default for Vercel deployments.
 *  - Otherwise log and return a dry-run result, so the feature is testable
 *    locally without credentials and does not silently fail in production.
 *
 * Server-only: never expose the API key to the client.
 */
import "server-only";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
};

type SendResult = { ok: true; id?: string } | { ok: false; error: string; dryRun?: boolean };

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Dry run — log for local development so the teacher can see what would have been sent.
    console.info(`[email:dry-run] to=${args.to} subject=${JSON.stringify(args.subject)}`);
    return { ok: true, id: "dry-run" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: args.from ?? process.env.EMAIL_FROM ?? "Teacher OS <noreply@teacher-os.example>",
        to: [args.to],
        subject: args.subject,
        html: args.html,
        reply_to: args.replyTo,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false, error: `Resend ${response.status}: ${body.slice(0, 400)}` };
    }

    const data = (await response.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Convenience: homework assigned notification. */
export async function notifyHomeworkAssigned(input: {
  learnerEmail: string;
  learnerName: string;
  title: string;
  dueAt?: string | null;
  instructions?: string | null;
}): Promise<SendResult> {
  const due = input.dueAt ? `Due ${new Date(input.dueAt).toLocaleDateString()}` : "No due date";
  return sendEmail({
    to: input.learnerEmail,
    subject: `New homework: ${input.title}`,
    html: `
      <p>Hi ${input.learnerName},</p>
      <p>Your teacher assigned <strong>${input.title}</strong>.</p>
      <p>${due}</p>
      ${input.instructions ? `<p>${input.instructions}</p>` : ""}
      <p>Sign in to view and submit at your portal.</p>
    `,
  });
}

/** Convenience: feedback released. */
export async function notifyFeedbackReleased(input: {
  learnerEmail: string;
  learnerName: string;
  task: string;
  feedback: string;
}): Promise<SendResult> {
  return sendEmail({
    to: input.learnerEmail,
    subject: `Feedback ready: ${input.task}`,
    html: `
      <p>Hi ${input.learnerName},</p>
      <p>Feedback on <strong>${input.task}</strong> is ready.</p>
      <blockquote>${input.feedback}</blockquote>
    `,
  });
}
