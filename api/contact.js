/**
 * Contact form endpoint — Vercel serverless function.
 * ---------------------------------------------------------------------------
 * The browser cannot send email on its own, so the form POSTs here and this
 * function calls Resend. The API key stays on the server (RESEND_API_KEY);
 * it is never shipped to the browser.
 *
 * Setup (once):
 *   1. resend.com → sign up free → verify neelxm08@gmail.com
 *   2. resend.com → API Keys → Create API Key → copy it
 *   3. In this Vercel project: Settings → Environment Variables
 *        RESEND_API_KEY  =  re_xxxxxxxxxxxx
 *      (mark it for Production AND Preview, then redeploy)
 *
 * Sending address: until a domain is verified on Resend, use
 * "onboarding@resend.dev". That only delivers to the account owner's own
 * address, which is exactly what this form needs. To send from a nicer address
 * like no-reply@yourdomain.com, add the domain in Resend and set MAIL_FROM.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const MAIL_TO = process.env.MAIL_TO || "neelxm08@gmail.com";
const MAIL_FROM = process.env.MAIL_FROM || "Portfolio <onboarding@resend.dev>";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_NAME = 80;
const MAX_EMAIL = 160;
const MAX_MESSAGE = 4000;

// Crude but effective spam guard: 5 submissions per IP per 10 minutes.
// Serverless instances come and go, so this is best-effort, not a guarantee —
// it mainly stops someone hammering the button by accident.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: "Email is not set up yet. Please email directly instead.",
    });
  }

  // Bot trap: a hidden field that only automated form-fillers will fill in.
  // Answer with success so the bot has no reason to try again.
  const body = req.body || {};
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return res.status(200).json({ ok: true });
  }

  const name = String(body.name || "").trim().slice(0, MAX_NAME);
  const email = String(body.email || "").trim().slice(0, MAX_EMAIL);
  const message = String(body.message || "").trim().slice(0, MAX_MESSAGE);

  if (!name) return res.status(400).json({ ok: false, error: "Please enter your name." });
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ ok: false, error: "Please enter a valid email address." });
  }
  if (message.length < 10) {
    return res.status(400).json({ ok: false, error: "Please write a slightly longer message." });
  }

  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  if (rateLimited(ip)) {
    return res.status(429).json({
      ok: false,
      error: "That is a lot of messages at once. Please try again in a few minutes.",
    });
  }

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");

  try {
    const resendResponse = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [MAIL_TO],
        // Replying goes straight back to the visitor, not to you.
        reply_to: email,
        subject: `New message from portfolio: ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
        html: `
          <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.6;color:#2A2520">
            <h2 style="margin:0 0 16px;font-size:18px">New message from your portfolio</h2>
            <table cellpadding="0" cellspacing="0" style="font-size:14px">
              <tr><td style="padding:4px 12px 4px 0;color:#6B6358">Name</td><td style="padding:4px 0"><strong>${safeName}</strong></td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#6B6358">Email</td><td style="padding:4px 0"><a href="mailto:${safeEmail}" style="color:#a8510e">${safeEmail}</a></td></tr>
            </table>
            <div style="margin-top:16px;padding:14px 16px;background:#FAF5EA;border-left:3px solid #a8510e;border-radius:0 6px 6px 0">
              ${safeMessage}
            </div>
            <p style="margin-top:16px;font-size:12px;color:#6B6358">Reply directly to this email to answer ${safeName}.</p>
          </div>
        `.trim(),
      }),
    });

    if (!resendResponse.ok) {
      const detail = await resendResponse.text();
      console.error("Resend error", resendResponse.status, detail);
      return res.status(502).json({
        ok: false,
        error: "Could not send that just now. Please email directly instead.",
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Contact form failure", error);
    return res.status(502).json({
      ok: false,
      error: "Could not send that just now. Please email directly instead.",
    });
  }
}