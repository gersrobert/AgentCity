import { Router, Request, Response } from 'express';
import { processGMMessage } from '../services/llmService.js';
import type {
  GMChatRequest,
  WorldEvent,
  ApiResponse,
} from '../../../shared/types.js';

const router = Router();

router.post('/chat', async (req: Request, res: Response) => {
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
    const event = await processGMMessage(gmReq);
    const body: ApiResponse<WorldEvent> = { ok: true, data: event };
    res.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const body: ApiResponse<never> = { ok: false, error: message };
    res.status(502).json(body);
  }
});

export default router;
