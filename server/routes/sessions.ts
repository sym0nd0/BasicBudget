import { Router } from 'express';
import type { Request, Response } from 'express';
import { UAParser } from 'ua-parser-js';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import type { SessionInfo } from '../../shared/types.js';

const router = Router();
router.use(requireAuth);

interface SessionRow {
  sid: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  expired: number;
}

// GET /api/auth/sessions
router.get('/', (req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT sid, user_agent, ip_address, created_at, expired
    FROM sessions
    WHERE user_id = ? AND expired > ?
    ORDER BY created_at DESC
  `).all(req.userId!, Date.now()) as SessionRow[];

  const sessions: SessionInfo[] = rows.map(r => {
    const ua = r.user_agent ? new UAParser(r.user_agent).getResult() : null;
    const browser = ua ? [ua.browser.name, ua.browser.version?.split('.')[0]].filter(Boolean).join(' ') : undefined;
    const os = ua ? [ua.os.name, ua.os.version].filter(Boolean).join(' ') : undefined;
    const device = ua?.device.type ?? undefined;
    return {
      sid: r.sid,
      user_agent: r.user_agent,
      ip_address: r.ip_address,
      created_at: r.created_at,
      expired: r.expired,
      current: r.sid === req.sessionID,
      browser: browser || undefined,
      os: os || undefined,
      device,
    };
  });

  res.json(sessions);
});

// DELETE /api/auth/sessions/:sid
router.delete('/:sid', (req: Request, res: Response) => {
  const sid = req.params['sid'] as string;
  if (sid === req.sessionID) {
    res.status(400).json({ message: 'Cannot revoke your current session. Use logout instead.' });
    return;
  }

  const row = db.prepare('SELECT sid FROM sessions WHERE sid = ? AND user_id = ?').get(sid, req.userId!);
  if (!row) {
    res.status(404).json({ message: 'Session not found' });
    return;
  }

  db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
  res.status(204).send();
});

export default router;
