import { Router } from 'express';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import db from '../db.js';

const router = Router();

// GET /api/invite/info?token=X
// Public endpoint (no auth required) to peek at invite token details
router.get('/info', (req: Request, res: Response) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    res.status(400).json({ message: 'Token is required' });
    return;
  }

  // Hash the token
  const hash = createHash('sha256').update(token).digest('hex');

  // Look up token
  const row = db.prepare(`
    SELECT rt.new_email, rt.invitee_email, rt.expires_at, rt.used
    FROM reset_tokens rt
    WHERE rt.token_hash = ? AND rt.type = 'invite'
  `).get(hash) as {
    new_email: string | null;
    invitee_email: string | null;
    expires_at: string;
    used: number;
  } | undefined;

  if (!row) {
    res.status(404).json({ message: 'Invalid or expired invite link' });
    return;
  }

  if (row.used) {
    res.status(410).json({ message: 'This invite has already been used' });
    return;
  }

  if (new Date(row.expires_at) < new Date()) {
    res.status(410).json({ message: 'This invite link has expired' });
    return;
  }

  const householdId = row.new_email;
  const inviteeEmail = row.invitee_email;

  // Get household name
  const householdRow = db.prepare('SELECT name FROM households WHERE id = ?').get(householdId) as { name: string } | undefined;

  // Check if user with this email exists
  const userRow = db.prepare('SELECT 1 FROM users WHERE email = ?').get(inviteeEmail);
  const userExists = !!userRow;

  res.json({
    householdName: householdRow?.name ?? 'a household',
    inviteeEmail,
    userExists,
  });
});

export default router;
