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

  return {
    name: "decide_action",
    description:
      "Decide where to move next, what to buy here (if anything), update your mood and goal, and emit a thought bubble.",
    input_schema: {
      type: "object" as const,
      properties: {
        targetLocationId: {
          type: "string",
          description: "The id of the location to walk toward to sell your goods.",
          enum: locations.map((l) => l.id),
        },
        purchase: {
          type: "object",
          description: availableItems.length > 0
            ? "Item to buy here before leaving. Choose based on profit potential. Omit or set to null if you cannot afford anything or choose not to buy."
            : "No goods available for purchase at this location. Omit this field.",
          properties: {
            itemName: {
              type: "string",
              enum: availableItems.length > 0 ? availableItems : ["none"],
              description: "Name of the item to purchase.",
            },
            quantity: {
              type: "integer",
              minimum: 1,
              maximum: 5,
              description: "Number of units to buy. You pay buyPrice × quantity upfront.",
            },
          },
          required: ["itemName", "quantity"],
        },
        newMood: {
          type: "string",
          enum: [
            "happy",
            "anxious",
            "curious",
            "bored",
            "excited",
            "sad",
            "angry",
            "content",
          ],
        },
        newGoal: {
          type: "string",
          description:
            "A short phrase describing what you are trying to do (max 10 words).",
        },
        thought: {
          type: "string",
          description:
            "A single expressive sentence (max 12 words). Quirky and in character. If carrying risky goods, be vague and guarded — never name what you carry.",
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
          "A short narrative description of what happened (1–3 sentences, quirky city-sim tone).",
      },
      weather: {
        type: "string",
        enum: ["sunny", "cloudy", "raining", "stormy", "foggy", "snowing"],
        description: "New weather condition, if changed.",
      },
      timeOfDay: {
        type: "string",
        enum: ["dawn", "morning", "afternoon", "evening", "night"],
        description: "New time of day, if changed.",
      },
      activeEvents: {
        type: "array",
        items: { type: "string" },
        description:
          "New list of active world events (replaces current list). Short phrases.",
      },
      agentMoodOverrides: {
        type: "object",
        description:
          "Map of agentId to new mood. Only include agents whose mood should change.",
        additionalProperties: {
          type: "string",
          enum: [
            "happy",
            "anxious",
            "curious",
            "bored",
            "excited",
            "sad",
            "angry",
            "content",
          ],
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
      ? "(nobody nearby)"
      : nearbyAgents
          .map((a) => `- ${a.name} (${a.mood}): ${a.currentGoal}`)
          .join("\n");

  const eventsText =
    worldState.activeEvents.length > 0
      ? `- Active events: ${worldState.activeEvents.join(", ")}`
      : "";

  return `You are ${agent.name}, a character in a quirky pixelated city simulation.

YOUR PERSONALITY:
${agent.personality}

YOUR CURRENT STATE:
- Mood: ${agent.mood}
- Current goal: ${agent.currentGoal}
- Last thought: "${agent.currentThought}"
- Cash on hand: $${agent.cash}
- Carrying: ${agent.inventory ? `${agent.inventory.quantity}x ${agent.inventory.name} (paid $${agent.inventory.buyPrice * agent.inventory.quantity} total)` : 'nothing'}

AT THIS LOCATION (${agent.targetLocationId ?? 'unknown'}):
FOR SALE (you can buy):
${(() => {
  const listings = agent.targetLocationId ? getSellListings(agent.targetLocationId) : [];
  if (listings.length === 0) return '  (nothing for sale here)';
  return listings.map(l => {
    const buyers = getBuyersFor(l.itemName);
    const bestBuyer = buyers[0];
    const margin = bestBuyer ? bestBuyer.price - l.price : 0;
    const buyerNote = bestBuyer ? `best buyer: ${bestBuyer.locationId} pays $${bestBuyer.price} (+$${margin})` : 'no known buyers';
    return `  - ${l.itemName}: $${l.price}/unit  [${buyerNote}]`;
  }).join('\n');
})()}
WILL BUY FROM YOU:
${(() => {
  const loc = agent.targetLocationId;
  if (!loc) return '  (unknown)';
  const inv = agent.inventory;
  if (!inv) return '  (you are carrying nothing)';
  const listing = getBuyListing(loc, inv.name);
  if (!listing) return `  (does not buy ${inv.name})`;
  const revenue = listing.price * inv.quantity;
  const cost = inv.buyPrice * inv.quantity;
  return `  - ${inv.quantity}x ${inv.name} → $${listing.price}/unit = $${revenue} revenue (you paid $${cost}, profit +$${revenue - cost})`;
})()}

ALL MARKET PRICES (plan your routes):
${Object.entries(MARKET).map(([locId, mkt]) => {
  const sells = mkt.sells.map(l => `${l.itemName} $${l.price}`).join(', ');
  const buys  = mkt.buys.map(l => `${l.itemName} $${l.price}`).join(', ');
  return `  ${locId}: sells [${sells || 'nothing'}]  |  buys [${buys || 'nothing'}]`;
}).join('\n')}

You can carry only one item type (1–5 units). You must sell your goods at a location that buys them — not every location accepts every item. High-margin items carry risk; be discreet.

THE WORLD RIGHT NOW:
- Weather: ${worldState.weather}
- Time of day: ${worldState.timeOfDay}
${eventsText}

PLACES YOU CAN GO:
${worldState.locations.map((l) => `- ${l.id}: ${l.label} — ${l.description}`).join("\n")}

NEARBY CHARACTERS:
${nearbyText}

Decide where to go next and what to think. Stay in character. Use the decide_action tool.`;
}

function buildGMPrompt(req: GMChatRequest): string {
  const { playerMessage, worldState } = req;
  const agentsText = worldState.agents
    .map((a) => `${a.name} (${a.mood})`)
    .join(", ");

  return `You are the narrator and game master of AgentCity, a quirky pixel-art city simulation.
The player has issued a command or request. Interpret it creatively and apply changes to the world.

CURRENT WORLD STATE:
- Weather: ${worldState.weather}
- Time: ${worldState.timeOfDay}
- Active events: ${worldState.activeEvents.join(", ") || "none"}
- Agents present: ${agentsText}

PLAYER MESSAGE:
"${playerMessage}"

Use the apply_world_event tool to make changes real. Be creative but keep it grounded in the city sim aesthetic.`;
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
    max_tokens: 256,
    system: `You are ${req.agent.name}, a character in AgentCity. Always respond using the decide_action tool.`,
    messages: [{ role: "user", content: buildAgentPrompt(req) }],
    tools: [buildDecideActionTool(req.worldState.locations, req.agent.targetLocationId)],
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
      "You are the game master of AgentCity. Always respond using the apply_world_event tool.",
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
