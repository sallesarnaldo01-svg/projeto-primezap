import { supabaseAdmin } from '../lib/supabase.server';

export async function requireSupabaseUser(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No token' });

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid token' });

    (req as any).user = data.user;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
