import Anthropic from "@anthropic-ai/sdk";

export type Suggestion = {
	ids: string[];
	search?: string;
	activeSprint?: boolean;
	assignToMe?: boolean;
};

const MAX_SUGGESTIONS = 3;

const SYSTEM = `You help users of a Jira terminal app pick a command from its command palette.
Given what the user typed (any language), choose up to ${MAX_SUGGESTIONS} command ids from the list that best match their intent, most relevant first.
When the intent is to find tickets, describe them: "search" is the plain-text query (keywords only, no filler words), "activeSprint" is true if they must be in the current/active sprint.
Set "assignToMe" to true only if the user wants to assign those tickets to themselves; then "search" and/or "activeSprint" must describe which tickets.
Return no ids if no listed command fits. Never pick a single-ticket command when the user means several tickets.`;

const schema = {
	type: "object",
	properties: {
		ids: { type: "array", items: { type: "string" } },
		search: { type: "string" },
		activeSprint: { type: "boolean" },
		assignToMe: { type: "boolean" },
	},
	required: ["ids"],
	additionalProperties: false,
};

export const createClient = (apiKey: string) => new Anthropic({ apiKey });

// Seuls la phrase tapée et les libellés des commandes partent chez Anthropic.
export function createSuggester(client: Pick<Anthropic, "messages">) {
	const cache = new Map<string, Suggestion>();
	return async (
		phrase: string,
		commands: { id: string; label: string }[],
		signal?: AbortSignal,
	): Promise<Suggestion> => {
		const list = commands.map((c) => `${c.id}: ${c.label}`).join("\n");
		const cacheKey = `${phrase}\n${list}`;
		const hit = cache.get(cacheKey);
		if (hit) return hit;
		const response = await client.messages.create(
			{
				model: "claude-haiku-4-5",
				max_tokens: 256,
				system: `${SYSTEM}\n\nCommands:\n${list}`,
				messages: [{ role: "user", content: phrase }],
				output_config: { format: { type: "json_schema", schema } },
			},
			{ signal },
		);
		const text = response.content.find((b) => b.type === "text");
		const parsed = JSON.parse(text?.type === "text" ? text.text : "{}");
		const known = new Set(commands.map((c) => c.id));
		const suggestion: Suggestion = {
			ids: ((parsed.ids as string[]) ?? [])
				.filter((id) => known.has(id))
				.slice(0, MAX_SUGGESTIONS),
			search: parsed.search?.trim() || undefined,
			activeSprint: parsed.activeSprint || undefined,
			assignToMe: parsed.assignToMe || undefined,
		};
		cache.set(cacheKey, suggestion);
		return suggestion;
	};
}
