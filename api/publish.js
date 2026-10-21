/**
 * Publish endpoint — verifies the signed-in admin, then starts a Vercel
 * deploy through a Deploy Hook. The hook URL and Supabase key live only in
 * server environment variables; neither is ever returned or logged.
 */

const GENERIC_AUTH_ERROR = "Not authorized.";
const GENERIC_PUBLISH_ERROR = "Could not start the rebuild. Please try again.";

function timeLimitedSignal(ms) {
  return typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(ms) : undefined;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || "";
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const deployHookUrl = process.env.DEPLOY_HOOK_URL || "";

  if (!supabaseUrl || !supabaseKey || !adminEmail || !deployHookUrl) {
    return res.status(500).json({ ok: false, error: "Publishing is not configured." });
  }

  const authHeader = String(req.headers.authorization || "").trim();
  const bearer = /^Bearer\s+(.+)$/i.exec(authHeader);
  const token = bearer ? bearer[1].trim() : "";

  if (!token) {
    return res.status(401).json({ ok: false, error: GENERIC_AUTH_ERROR });
  }

  let user;
  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${token}`,
      },
      signal: timeLimitedSignal(10000),
    });
    if (!userResponse.ok) {
      return res.status(401).json({ ok: false, error: GENERIC_AUTH_ERROR });
    }
    user = await userResponse.json();
  } catch {
    return res.status(401).json({ ok: false, error: GENERIC_AUTH_ERROR });
  }

  const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
  if (!email || email !== adminEmail) {
    return res.status(401).json({ ok: false, error: GENERIC_AUTH_ERROR });
  }

  try {
    const deployResponse = await fetch(deployHookUrl, {
      method: "POST",
      signal: timeLimitedSignal(10000),
    });
    if (!deployResponse.ok) {
      console.error("Publish deploy hook failed", deployResponse.status);
      return res.status(502).json({ ok: false, error: GENERIC_PUBLISH_ERROR });
    }
  } catch {
    console.error("Publish deploy hook request failed");
    return res.status(502).json({ ok: false, error: GENERIC_PUBLISH_ERROR });
  }

  return res.status(200).json({ ok: true });
}
