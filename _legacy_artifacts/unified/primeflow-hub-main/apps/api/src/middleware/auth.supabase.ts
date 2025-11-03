import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase.server.js';

export async function requireSupabaseUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase não configurado' });
  }

  const authorization = req.headers.authorization ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    (req as Request & { user?: typeof data.user }).user = data.user;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
