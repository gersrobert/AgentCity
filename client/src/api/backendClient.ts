import type {
  AgentThinkRequest,
  AgentDecision,
  AgentSpawnRequest,
  NewAgentProfile,
  GMChatRequest,
  WorldEvent,
  ApiResponse,
} from '@shared/types';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json: ApiResponse<T> = await res.json();

  if (!json.ok || json.data === undefined) {
    throw new Error(json.error ?? `Request to ${path} failed`);
  }

  return json.data;
}

export async function agentThink(req: AgentThinkRequest): Promise<AgentDecision> {
  return post<AgentDecision>('/api/agent/think', req);
}

export async function gmChat(req: GMChatRequest): Promise<WorldEvent> {
  return post<WorldEvent>('/api/gamemaster/chat', req);
}

export async function spawnAgent(req: AgentSpawnRequest): Promise<NewAgentProfile> {
  return post<NewAgentProfile>('/api/agent/spawn', req);
}
