import { Router, Request, Response } from "express";
import { getAgentDecision, spawnAgent } from "../services/llmService.js";
import type {
  AgentThinkRequest,
  AgentDecision,
  AgentSpawnRequest,
  NewAgentProfile,
  ApiResponse,
} from "../../../shared/types.js";

const router = Router();

router.post("/think", async (req: Request, res: Response) => {
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
    const decision = await getAgentDecision(thinkReq);
    console.log("decision", decision);
    const body: ApiResponse<AgentDecision> = { ok: true, data: decision };
    res.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const body: ApiResponse<never> = { ok: false, error: message };
    res.status(502).json(body);
  }
});

router.post("/spawn", async (req: Request, res: Response) => {
  const spawnReq = req.body as AgentSpawnRequest;

  if (!spawnReq.startingPlanetId || !spawnReq.worldContext) {
    const body: ApiResponse<never> = {
      ok: false,
      error: "Missing required fields: startingPlanetId, worldContext",
    };
    res.status(400).json(body);
    return;
  }

  try {
    const profile = await spawnAgent(spawnReq);
    const body: ApiResponse<NewAgentProfile> = { ok: true, data: profile };
    res.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const body: ApiResponse<never> = { ok: false, error: message };
    res.status(502).json(body);
  }
});

export default router;
