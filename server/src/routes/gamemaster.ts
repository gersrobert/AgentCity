import { Router, Request, Response } from 'express';
import { getKey } from '../session.js';
import { processGMMessage } from '../services/claudeService.js';
import type {
  GMChatRequest,
  WorldEvent,
  ApiResponse,
} from '../../../shared/types.js';

const router = Router();

router.post('/chat', async (req: Request, res: Response) => {
  const key = getKey();
  if (!key) {
    const body: ApiResponse<never> = {
      ok: false,
      error: 'No API key set. Please enter your Anthropic API key first.',
    };
    res.status(401).json(body);
    return;
  }

  const gmReq = req.body as GMChatRequest;

  if (!gmReq.playerMessage || !gmReq.worldState) {
    const body: ApiResponse<never> = {
      ok: false,
      error: 'Missing required fields: playerMessage, worldState',
    };
    res.status(400).json(body);
    return;
  }

  try {
    const event = await processGMMessage(gmReq, key);
    const body: ApiResponse<WorldEvent> = { ok: true, data: event };
    res.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const body: ApiResponse<never> = { ok: false, error: message };
    res.status(502).json(body);
  }
});

export default router;
