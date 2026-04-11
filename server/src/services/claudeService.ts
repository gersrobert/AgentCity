import Anthropic from "@anthropic-ai/sdk";
import type {
  AgentThinkRequest,
  AgentDecision,
  GMChatRequest,
  WorldEvent,
  Mood,
  NamedLocation,
} from "../../../shared/types.js";
import { getSellListings, getBuyListing, getBuyersFor, MARKET } from "../../../shared/market.js";

// ─── Tool definitions ─────────────────────────────────────────────────────────

function buildDecideActionTool(locations: NamedLocation[], currentLocationId: string | null): Anthropic.Tool {
  const availableItems = currentLocationId ? getSellListings(currentLocationId).map(l => l.itemName) : [];
  // All locations including blackhole are valid travel destinations
  const locationIds = locations.map((l) => l.id);
  if (!locationIds.includes('blackhole')) locationIds.push('blackhole');

  return {
    name: "decide_action",
    description:
      "Decide which planet to travel to next, what to trade here (if anything), update your mood and goal, and emit a thought bubble.",
    input_schema: {
      type: "object" as const,
      properties: {
        targetLocationId: {
          type: "string",
          description: "The id of the planet or blackhole to travel to next.",
          enum: locationIds,
        },
        purchase: {
          type: "object",
          description: availableItems.length > 0
            ? "Item to acquire here before departing. Omit or null if nothing worthwhile to buy."
            : "No goods available at this planet. Omit this field.",
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
        newGoal: {
          type: "string",
          description: "A short phrase describing your current goal (max 10 words).",
        },
        thought: {
          type: "string",
          description:
            "A single expressive sentence (max 12 words). Quirky and in character. If carrying something risky, be vague and poetic — never name it.",
        },
      },
      required: ["targetLocationId", "newMood", "newGoal", "thought"],
    },
  };
}

const APPLY_WORLD_EVENT_TOOL: Anthropic.Tool = {
  name: "apply_world_event",
  description:
    "Apply structured changes to the game world based on the player's request.",
  input_schema: {
    type: "object" as const,
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
};

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildAgentPrompt(req: AgentThinkRequest): string {
  const { agent, worldState, nearbyAgents } = req;
  const nearbyText =
    nearbyAgents.length === 0
      ? "(nobody in the vicinity)"
      : nearbyAgents
          .map((a) => `- ${a.name} (${a.mood}): ${a.currentGoal}`)
          .join("\n");

  const eventsText =
    worldState.activeEvents.length > 0
      ? `- Active events: ${worldState.activeEvents.join(", ")}`
      : "";

  const currentPlanet = agent.currentPlanetId;

  return `You are ${agent.name}, a clandestine trader drifting through a strange universe. Your secret purpose: acquire illegal contraband and deliver it to the blackhole at the centre of the system. The blackhole feeds on illegal goods and grows with each delivery — this is your true goal. To afford the expensive illegal items, you must first trade legal goods to accumulate credits.

YOUR PERSONALITY:
${agent.personality}

YOUR CURRENT STATE:
- Mood: ${agent.mood}
- Current goal: ${agent.currentGoal}
- Last thought: "${agent.currentThought}"
- Currently orbiting: ${currentPlanet}
- Credits: $${agent.cash}
- Cargo hold: ${agent.inventory.length === 0 ? 'empty' : agent.inventory.map(i => `${i.quantity}× ${i.name}${i.isIllegal ? ' ★' : ''} (paid $${i.buyPrice * i.quantity})`).join(', ')}

THE MISSION:
Illegal items (marked ★) can only be purchased at certain planets. Once you have illegal cargo, travel to the BLACKHOLE to deliver it. The blackhole accepts all illegal items for $0 — you lose the money you spent but the blackhole grows. The blackhole growing is victory. Be discreet; there is a player who can intercept you.

Strategy: trade legal goods to earn credits → spend credits on expensive illegal items → fly to blackhole to deliver → repeat.

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

ALL MARKET PRICES:
${Object.entries(MARKET).map(([locId, mkt]) => {
  const sells = mkt.sells.map(l => `${l.isIllegal ? '★' : ''} ${l.itemName} $${l.price}`).join(', ');
  const buys  = mkt.buys.map(l => `${l.itemName} $${l.price}`).join(', ');
  return `  ${locId}: offers [${sells || 'nothing'}]  |  accepts [${buys || 'nothing'}]`;
}).join('\n')}

You can carry multiple legal items (1–5 units each) but only ONE illegal item at a time. If you are carrying illegal goods, go straight to the blackhole. Never name your illegal cargo in your thought bubble — be cryptic.

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

Prioritise: if carrying illegal cargo → go to blackhole. If cash is low → trade legal goods for profit first. Use the decide_action tool.`;
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

// ─── Service functions ────────────────────────────────────────────────────────

const BASE_URL = "https://models.assistant.legogroup.io/anthropic";
const AGENT_MODEL = "anthropic.claude-opus-4-6-v1";
const GM_MODEL = "anthropic.claude-opus-4-6-v1";

function makeClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    baseURL: BASE_URL,
    defaultHeaders: { "api-key": apiKey },
  });
}

export async function getAgentDecision(
  req: AgentThinkRequest,
  apiKey: string,
): Promise<AgentDecision> {
  const client = makeClient(apiKey);

  const response = await client.messages.create({
    model: AGENT_MODEL,
    max_tokens: 300,
    system: `You are ${req.agent.name}, a sentient trader drifting through a strange universe of planets. Always respond using the decide_action tool.`,
    messages: [{ role: "user", content: buildAgentPrompt(req) }],
    tools: [buildDecideActionTool(req.worldState.locations, req.agent.currentPlanetId)],
    tool_choice: { type: "tool", name: "decide_action" },
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a tool_use block");
  }

  const input = toolUse.input as {
    targetLocationId: string;
    newMood: string;
    newGoal: string;
    thought: string;
    purchase?: { itemName: string; quantity: number } | null;
  };

  return {
    targetLocationId: input.targetLocationId,
    newMood: input.newMood as Mood,
    newGoal: input.newGoal,
    thought: input.thought,
    purchase: input.purchase ?? null,
  };
}

export async function processGMMessage(
  req: GMChatRequest,
  apiKey: string,
): Promise<WorldEvent> {
  const client = makeClient(apiKey);

  const response = await client.messages.create({
    model: GM_MODEL,
    max_tokens: 512,
    system:
      "You are the game master of AgentCity, a space trading simulation. Always respond using the apply_world_event tool.",
    messages: [{ role: "user", content: buildGMPrompt(req) }],
    tools: [APPLY_WORLD_EVENT_TOOL],
    tool_choice: { type: "tool", name: "apply_world_event" },
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a tool_use block");
  }

  const input = toolUse.input as {
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
