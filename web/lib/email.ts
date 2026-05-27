type AuthEmail =
  | { to: string; subject: string; kind: "magic-link"; url: string }
  | { to: string; subject: string; kind: "otp"; otp: string };

/**
 * Delivers an email.
 * - With RESEND_API_KEY set, sends via Resend (dev and prod).
 * - Otherwise in development, prints to the server console.
 * - Otherwise in production, throws so a half-configured deploy fails loudly.
 */
async function deliver(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (apiKey) {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const from = process.env.EMAIL_FROM ?? "Arbiter <onboarding@resend.dev>";
    const { error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    if (error) {
      throw new Error(
        `Failed to send email: ${error.message ?? String(error)}`,
      );
    }
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`\n[email -> ${opts.to}] ${opts.subject}\n  ${opts.text}\n`);
    return;
  }

  throw new Error(
    "No email provider configured. Set RESEND_API_KEY (and EMAIL_FROM) to send email.",
  );
}

function renderAuthBody(msg: AuthEmail): { text: string; html: string } {
  if (msg.kind === "magic-link") {
    return {
      text: `Sign in to Arbiter:\n${msg.url}\n\nThis link expires shortly. If you didn't request it, ignore this email.`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
  <h2 style="margin:0 0 12px">Sign in to Arbiter</h2>
  <p style="color:#444">Click the button below to sign in. This link expires shortly.</p>
  <p><a href="${msg.url}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Sign in</a></p>
  <p style="color:#888;font-size:12px">If the button doesn't work, paste this URL:<br>${msg.url}</p>
</div>`,
    };
  }
  return {
    text: `Your Arbiter sign-in code is ${msg.otp}. It expires shortly.`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
  <h2 style="margin:0 0 12px">Your Arbiter sign-in code</h2>
  <p style="font-size:28px;font-weight:700;letter-spacing:4px">${msg.otp}</p>
  <p style="color:#888;font-size:12px">This code expires shortly. If you didn't request it, ignore this email.</p>
</div>`,
  };
}

/** Sends a passwordless auth email (magic link or one-time code). */
export async function sendAuthEmail(msg: AuthEmail): Promise<void> {
  const { text, html } = renderAuthBody(msg);
  await deliver({ to: msg.to, subject: msg.subject, text, html });
}

/** Sends an organization invite email. */
export async function sendOrgInviteEmail(opts: {
  to: string;
  orgName: string;
  role: string;
  url: string;
}): Promise<void> {
  const roleLabel = opts.role.toLowerCase();
  await deliver({
    to: opts.to,
    subject: `You're invited to ${opts.orgName} on Arbiter`,
    text: `You've been invited to join ${opts.orgName} as ${roleLabel} on Arbiter.\nAccept: ${opts.url}\nThis invite expires in 7 days.`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
  <h2 style="margin:0 0 12px">You're invited to ${opts.orgName}</h2>
  <p style="color:#444">You've been invited to join <strong>${opts.orgName}</strong> as <strong>${roleLabel}</strong> on Arbiter.</p>
  <p><a href="${opts.url}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Accept invite</a></p>
  <p style="color:#888;font-size:12px">If the button doesn't work, paste this URL:<br>${opts.url}</p>
  <p style="color:#888;font-size:12px">This invite expires in 7 days. You'll need to sign in and link your Discord account to join.</p>
</div>`,
  });
}
