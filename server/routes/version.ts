import { Router } from 'express';
import type { Request, Response } from 'express';
import { getVersionInfo } from '../services/versionChecker.js';

const router = Router();

// GET /api/version — no auth required
router.get('/', (_req: Request, res: Response) => {
  res.json(getVersionInfo());
});

export default router;
