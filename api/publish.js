module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const HOOK = process.env.DEPLOY_HOOK_URL;
  if (!SUPABASE_URL || !KEY || !ADMIN_EMAIL || !HOOK) return res.status(500).json({ error: 'server not configured' });
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const r = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: KEY, Authorization: 'Bearer ' + token } });
    if (!r.ok) return res.status(401).json({ error: 'unauthorized' });
    const user = await r.json();
    if (!user || !user.email || user.email.toLowerCase() !== ADMIN_EMAIL) return res.status(403).json({ error: 'forbidden' });
    const hr = await fetch(HOOK, { method: 'POST' });
    if (!hr.ok) return res.status(500).json({ error: 'publish failed' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'server error' });
  }
};
