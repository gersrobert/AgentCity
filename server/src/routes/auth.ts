import { Router, Request, Response } from 'express';
import { setKey, hasKey } from '../session.js';
import type { ApiKeyRequest, ApiResponse } from '../../../shared/types.js';

const router = Router();

router.post('/key', (req: Request, res: Response) => {
  const { apiKey } = req.body as ApiKeyRequest;

  if (!apiKey || typeof apiKey !== 'string') {
    const body: ApiResponse<never> = { ok: false, error: 'Missing apiKey' };
    res.status(400).json(body);
    return;
  }

  setKey(apiKey);
  const body: ApiResponse<{ validated: true }> = {
    ok: true,
    data: { validated: true },
  };
  res.json(body);
});

router.get('/status', (_req: Request, res: Response) => {
  res.json({ hasKey: hasKey() });
});

export default router;
