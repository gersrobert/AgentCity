import { Router, Request, Response } from "express";
import { getKey } from "../session.js";
import { getAgentDecision } from "../services/claudeService.js";
import type {
  AgentThinkRequest,
  AgentDecision,
  ApiResponse,
} from "../../../shared/types.js";

const router = Router();

router.post("/think", async (req: Request, res: Response) => {
  const key = getKey();
  if (!key) {
    const body: ApiResponse<never> = {
      ok: false,
      error: "No API key set. Please enter your Anthropic API key first.",
    };
    res.status(401).json(body);
    return;
  }

  const thinkReq = req.body as AgentThinkRequest;

  if (!thinkReq.agent || !thinkReq.worldState) {
    const body: ApiResponse<never> = {
      ok: false,
      error: "Missing required fields: agent, worldState",
    };
    res.status(400).json(body);
    return;
  }

  try {
    const decision = await getAgentDecision(thinkReq, key);
    console.log("decision", decision);
    const body: ApiResponse<AgentDecision> = { ok: true, data: decision };
    res.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const body: ApiResponse<never> = { ok: false, error: message };
    res.status(502).json(body);
  }
});

export default router;
