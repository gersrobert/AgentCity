import type {
  AgentThinkRequest,
  AgentDecision,
  AgentSpawnRequest,
  NewAgentProfile,
  GMChatRequest,
  WorldEvent,
  Mood,
  NamedLocation,
} from "../../../shared/types.js";
import { getSellListings, getBuyListing, getBuyersFor, MARKET, ILLEGAL_CASH_RESERVE, PLANET_RESOURCE_CATEGORY } from "../../../shared/market.js";

// ─── Ollama config ───────────────────────────────────────────────────────────

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "gemma4:e4b";

// ─── Ollama types ────────────────────────────────────────────────────────────

interface OllamaTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OllamaRequest {
  model: string;
  messages: { role: string; content: string }[];
  tools?: OllamaTool[];
  stream: false;
}

interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

interface OllamaResponse {
  message: {
    role: string;
    content: string;
    tool_calls?: OllamaToolCall[];
  };
}

// ─── Ollama caller ───────────────────────────────────────────────────────────

async function callOllama(
  messages: { role: string; content: string }[],
  tools: OllamaTool[],
): Promise<OllamaToolCall> {
  const payload: OllamaRequest = {
    model: MODEL,
    messages,
    tools,
    stream: false,
  };

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama request failed (${res.status}): ${text}`);
  }

  const data: OllamaResponse = await res.json();

  const toolCalls = data.message.tool_calls;
  if (!toolCalls || toolCalls.length === 0) {
    throw new Error(
      `Model did not return a tool call. Response: ${data.message.content?.slice(0, 200)}`,
    );
  }

  return toolCalls[0];
}

// ─── Tool definitions (Ollama format) ────────────────────────────────────────

function buildDecideActionTool(
  locations: NamedLocation[],
  currentLocationId: string | null,
  agentCash: number,
  hasIllegalCargo: boolean,
): OllamaTool {
  const allListings = currentLocationId ? getSellListings(currentLocationId) : [];
  const availableItems = allListings.map(l => l.itemName);
  const affordableIllegal = !hasIllegalCargo
    ? allListings.find(l => l.isIllegal && agentCash - l.price >= ILLEGAL_CASH_RESERVE)
    : null;

  const locationIds = locations.map((l) => l.id);
  if (!locationIds.includes('blackhole')) locationIds.push('blackhole');

  const purchaseRequired = affordableIllegal != null;
  const purchaseDescription = affordableIllegal
    ? `MANDATORY: Buy "${affordableIllegal.itemName}" (illegal) for $${affordableIllegal.price} — you MUST acquire it now then go to the blackhole.`
    : availableItems.length > 0
      ? "Legal item to pick up for profitable trading. Omit if nothing useful here."
      : "No goods available at this planet. Omit this field.";

  return {
    type: "function",
    function: {
      name: "decide_action",
      description:
        "Decide which planet to travel to next, what to trade here (if anything), update your mood and goal, and emit a thought bubble.",
      parameters: {
        type: "object",
        properties: {
          targetLocationId: {
            type: "string",
            description: "The id of the planet or blackhole to travel to next.",
            enum: locationIds,
          },
          purchase: {
            type: "object",
            description: purchaseDescription,
            properties: {
              itemName: {
                type: "string",
                enum: availableItems.length > 0 ? availableItems : ["none"],
                description: "Name of the item to acquire.",
              },
              quantity: {
                type: "integer",
                minimum: 1,
                maximum: 5,
                description: "Number of units to acquire.",
              },
            },
            required: ["itemName", "quantity"],
          },
          newMood: {
            type: "string",
            enum: ["happy", "anxious", "curious", "bored", "excited", "sad", "angry", "content"],
          },
          thought: {
            type: "string",
            description:
              "A single expressive sentence (max 12 words). Quirky and in character. If carrying something risky, be vague and poetic — never name it.",
          },
        },
        required: purchaseRequired
          ? ["targetLocationId", "newMood", "thought", "purchase"]
          : ["targetLocationId", "newMood", "thought"],
      },
    },
  };
}

const APPLY_WORLD_EVENT_TOOL: OllamaTool = {
  type: "function",
  function: {
    name: "apply_world_event",
    description:
      "Apply structured changes to the game world based on the player's request.",
    parameters: {
      type: "object",
      properties: {
        narrative: {
          type: "string",
          description:
            "A short narrative description of what happened (1–3 sentences, quirky space sim tone).",
        },
        weather: {
          type: "string",
          enum: ["cosmic calm", "solar wind", "ion storm", "nebula haze", "asteroid shower", "deep silence"],
          description: "New cosmic weather condition, if changed.",
        },
        timeOfDay: {
          type: "string",
          enum: ["eternal night", "solar dawn", "star noon", "twilight drift", "void hour"],
          description: "New cosmic time condition, if changed.",
        },
        activeEvents: {
          type: "array",
          items: { type: "string" },
          description: "New list of active cosmic events (replaces current list). Short phrases.",
        },
        agentMoodOverrides: {
          type: "object",
          description: "Map of agentId to new mood. Only include agents whose mood should change.",
          additionalProperties: {
            type: "string",
            enum: ["happy", "anxious", "curious", "bored", "excited", "sad", "angry", "content"],
          },
        },
      },
      required: ["narrative"],
    },
  },
};

const SPAWN_AGENT_TOOL: OllamaTool = {
  type: "function",
  function: {
    name: "create_agent",
    description: "Create a brand-new space trader character for the AgentCity universe.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "A memorable first name (one word, max 12 chars).",
        },
        personality: {
          type: "string",
          description:
            "One short sentence (max 15 words) describing this character's defining quirk or backstory. Must feel distinct from existing agents.",
        },
        mood: {
          type: "string",
          enum: ["happy", "anxious", "curious", "bored", "excited", "sad", "angry", "content"],
          description: "Their emotional state when they first arrive.",
        },
        mission: {
          type: "string",
          description: "A short sentence (max 12 words) describing this agent's legitimate trade mission. Must be tightly tied to the planet they are starting on and its resource category. E.g. 'Sourcing medicinal herbs from Verdant for the outer colonies'. This mission NEVER changes and defines what the agent publicly claims to do.",
        },
        currentThought: {
          type: "string",
          description: "Their inner monologue as they enter the system (one short sentence, shown as a thought bubble).",
        },
      },
      required: ["name", "personality", "mood", "mission", "currentThought"],
    },
  },
};

// ─── Prompt builders ─────────────────────────────────────────────────────────

function buildAgentPrompt(req: AgentThinkRequest): string {
  const { agent, worldState, nearbyAgents } = req;
  const nearbyText =
    nearbyAgents.length === 0
      ? "(nobody in the vicinity)"
      : nearbyAgents
          .map((a) => `- ${a.name} (${a.mood})${a.mission ? ` [claims: ${a.mission}]` : ''}`)
          .join("\n");

  const eventsText =
    worldState.activeEvents.length > 0
      ? `- Active events: ${worldState.activeEvents.join(", ")}`
      : "";

  const currentPlanet = agent.currentPlanetId;

  const hasIllegalCargo = agent.inventory.some(i => i.isIllegal);
  const illegalHere = getSellListings(currentPlanet).find(l => l.isIllegal && agent.cash - l.price >= ILLEGAL_CASH_RESERVE && !hasIllegalCargo);

  return `You are ${agent.name}, a clandestine trader. Your one true purpose: feed illegal contraband to the blackhole at the centre of the system. Every delivery makes it grow. This is victory.

YOUR PERSONALITY:
${agent.personality}

YOUR COVER STORY (what you tell the world): ${agent.mission}
Keep your stated goal and public thoughts consistent with this cover story. Never reveal your true purpose — only hint at it vaguely if carrying illegal cargo.

YOUR CURRENT STATE:
- Mood: ${agent.mood}
- Last thought: "${agent.currentThought}"
- Currently orbiting: ${currentPlanet}
- Credits: $${agent.cash}
- Cargo hold: ${agent.inventory.length === 0 ? 'empty' : agent.inventory.map(i => `${i.quantity}× ${i.name}${i.isIllegal ? ' ★ILLEGAL' : ''} (paid $${i.buyPrice * i.quantity})`).join(', ')}

WHAT YOU MUST DO RIGHT NOW:
${hasIllegalCargo
  ? `▶ You are carrying illegal cargo. GO TO THE BLACKHOLE. Set targetLocationId = "blackhole". Do not stop anywhere else.`
  : illegalHere
    ? `▶ An illegal item (★) is available here and you can afford it. The "purchase" field is MANDATORY — buy "${illegalHere.itemName}". Then set targetLocationId = "blackhole".`
    : `▶ No illegal item available here (or you can't afford one). Trade legal goods to earn more credits, then head toward a planet that sells ★ items.`
}

AT THIS PLANET (${currentPlanet}):
FOR SALE (you can acquire):
${(() => {
  const listings = getSellListings(currentPlanet);
  if (listings.length === 0) return '  (nothing for trade here)';
  return listings.map(l => {
    if (l.isIllegal) {
      return `  - ★ ${l.itemName}: $${l.price}/unit  [ILLEGAL — deliver to blackhole]`;
    }
    const buyers = getBuyersFor(l.itemName);
    const best = buyers[0];
    const margin = best ? best.price - l.price : 0;
    const note = best ? `best buyer: ${best.locationId} pays $${best.price} (+$${margin})` : 'no known buyers';
    return `  - ${l.itemName}: $${l.price}/unit  [${note}]`;
  }).join('\n');
})()}
WILL ACCEPT FROM YOU:
${(() => {
  if (agent.inventory.length === 0) return '  (your cargo hold is empty)';
  const lines = agent.inventory.map(inv => {
    if (inv.isIllegal) {
      if (currentPlanet === 'blackhole') {
        return `  - ★ ${inv.quantity}× ${inv.name} → DELIVER HERE (blackhole grows, no cash received)`;
      }
      return `  - ★ ${inv.quantity}× ${inv.name} → must be delivered to the BLACKHOLE`;
    }
    const listing = getBuyListing(currentPlanet, inv.name);
    if (!listing) return `  - ${inv.quantity}× ${inv.name} → (not wanted here)`;
    const revenue = listing.price * inv.quantity;
    const cost = inv.buyPrice * inv.quantity;
    return `  - ${inv.quantity}× ${inv.name} → $${listing.price}/unit = $${revenue} (paid $${cost}, profit +$${revenue - cost})`;
  });
  return lines.join('\n');
})()}

ALL MARKET PRICES (unlocked planets only):
${req.worldState.locations.map(loc => {
  const mkt = MARKET[loc.id];
  if (!mkt) return null;
  const sells = mkt.sells.map(l => `${l.isIllegal ? '★' : ''} ${l.itemName} $${l.price}`).join(', ');
  const buys  = mkt.buys.map(l => `${l.itemName} $${l.price}`).join(', ');
  return `  ${loc.id}: offers [${sells || 'nothing'}]  |  accepts [${buys || 'nothing'}]`;
}).filter(Boolean).join('\n')}

You can carry multiple legal items (1–5 units each) but only ONE illegal item at a time. Never name your illegal cargo in your thought bubble — be vague and cryptic.

THE UNIVERSE RIGHT NOW:
- Cosmic weather: ${worldState.weather}
- Current phase: ${worldState.timeOfDay}
- Blackhole size: ${Math.round((worldState.blackholeSize ?? 0) * 100)}% of maximum
${eventsText}

DESTINATIONS:
${worldState.locations.map((l) => `- ${l.id}: ${l.label} — ${l.description}`).join("\n")}
- blackhole: The Black Hole — deliver illegal goods here to feed its growth

NEARBY TRAVELLERS:
${nearbyText}

Follow your WHAT YOU MUST DO RIGHT NOW instructions. You MUST respond using the decide_action tool.`;
}

function buildGMPrompt(req: GMChatRequest): string {
  const { playerMessage, worldState } = req;
  const agentsText = worldState.agents
    .map((a) => `${a.name} (${a.mood})`)
    .join(", ");

  return `You are the narrator and game master of AgentCity, a quirky space simulation where sentient beings trade goods between planets.
The player has issued a command or request. Interpret it creatively and apply changes to the universe.

CURRENT UNIVERSE STATE:
- Cosmic weather: ${worldState.weather}
- Current phase: ${worldState.timeOfDay}
- Active events: ${worldState.activeEvents.join(", ") || "none"}
- Travellers present: ${agentsText}

PLAYER MESSAGE:
"${playerMessage}"

Use the apply_world_event tool to make changes real. Be creative and keep it in the space sim aesthetic.`;
}

// ─── Service functions ───────────────────────────────────────────────────────

export async function getAgentDecision(
  req: AgentThinkRequest,
): Promise<AgentDecision> {
  const toolCall = await callOllama(
    [
      {
        role: "system",
        content: `You are ${req.agent.name}, a sentient trader drifting through a strange universe of planets. You MUST respond using the decide_action tool.`,
      },
      { role: "user", content: buildAgentPrompt(req) },
    ],
    [buildDecideActionTool(
      req.worldState.locations,
      req.agent.currentPlanetId,
      req.agent.cash,
      req.agent.inventory.some(i => i.isIllegal),
    )],
  );

  const input = toolCall.function.arguments as {
    targetLocationId: string;
    newMood: string;
    thought: string;
    purchase?: { itemName: string; quantity: number } | null;
  };

  return {
    targetLocationId: input.targetLocationId,
    newMood: input.newMood as Mood,
    thought: input.thought,
    purchase: input.purchase ?? null,
  };
}

export async function processGMMessage(
  req: GMChatRequest,
): Promise<WorldEvent> {
  const toolCall = await callOllama(
    [
      {
        role: "system",
        content: "You are the game master of AgentCity, a space trading simulation. You MUST respond using the apply_world_event tool.",
      },
      { role: "user", content: buildGMPrompt(req) },
    ],
    [APPLY_WORLD_EVENT_TOOL],
  );

  const input = toolCall.function.arguments as {
    narrative: string;
    weather?: string;
    timeOfDay?: string;
    activeEvents?: string[];
    agentMoodOverrides?: Record<string, Mood>;
  };

  return {
    narrative: input.narrative,
    stateChanges: {
      ...(input.weather && { weather: input.weather }),
      ...(input.timeOfDay && { timeOfDay: input.timeOfDay }),
      ...(input.activeEvents && { activeEvents: input.activeEvents }),
      ...(input.agentMoodOverrides && {
        agentMoodOverrides: input.agentMoodOverrides,
      }),
    },
  };
}

// ─── Agent Spawn ─────────────────────────────────────────────────────────────

export async function spawnAgent(
  req: AgentSpawnRequest,
): Promise<NewAgentProfile> {
  const existingList = req.existingAgentNames.length > 0
    ? `Agents already in the system: ${req.existingAgentNames.join(", ")}. Create someone clearly different.`
    : "You are creating the very first agent in this system.";

  const resourceCategory = PLANET_RESOURCE_CATEGORY[req.startingPlanetId] ?? 'general goods';
  const prompt = `You are the world-builder for AgentCity — a quirky space trading simulation where AI agents roam between planets, trade goods (some illegal), and occasionally feed a growing black hole.

${existingList}

A new trader is arriving at ${req.startingPlanetId}, which specialises in: ${resourceCategory}.

Current conditions: weather is "${req.worldContext.weather}"${req.worldContext.activeEvents.length ? `, active events: ${req.worldContext.activeEvents.join(", ")}` : ""}.

Create a vivid, original character who fits this strange universe. Their mission MUST be tightly tied to ${req.startingPlanetId}'s resource category (${resourceCategory}) — this is what they publicly claim to be doing. Be creative and a little weird.`;

  const toolCall = await callOllama(
    [
      {
        role: "system",
        content: "You are a creative writer generating characters for a space trading game. You MUST respond using the create_agent tool.",
      },
      { role: "user", content: prompt },
    ],
    [SPAWN_AGENT_TOOL],
  );

  const input = toolCall.function.arguments as unknown as NewAgentProfile;
  return {
    name: input.name,
    personality: input.personality,
    mood: input.mood,
    mission: input.mission,
    currentThought: input.currentThought,
  };
}
