import { cardToBlockKit, cardToFallbackText } from "@chat-adapter/slack/blocks"
import { CardSpecError, schema, standardComponentDefinitions as std, toCard } from "@json-render/chat"
import { compileSpecStream, defineCatalog, type Spec } from "@json-render/core"

// ponytail: no Button yet; the bot has no click handler.
// No Chart: Slack showed the plain-text fallback instead of any card that had a data_visualization block.
const components = {
	Card: std.Card,
	Section: std.Section,
	Text: std.Text,
	Fields: std.Fields,
	Field: std.Field,
	Table: std.Table,
	Divider: std.Divider,
	Actions: std.Actions,
	LinkButton: std.LinkButton,
}

// json-render's own catalog and prompt, limited to the components above.
export const cardCatalog = defineCatalog(schema, { components })
export const CARD_PROMPT = cardCatalog.prompt()

// Slack turns a second table into a code block and caps a table at 100 rows.
const limits = { tables: 1, tableRows: 100, charts: 0, chartPoints: 0 }

// Models often double-escape line breaks, which Slack shows as a literal "\n" and which breaks *bold*.
function realLineBreaks(value: unknown): unknown {
	if (typeof value === "string") return value.replaceAll("\\n", "\n")
	if (Array.isArray(value)) return value.map(realLineBreaks)
	if (value && typeof value === "object") {
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, realLineBreaks(v)]))
	}
	return value
}

export type SlackCard = { blocks: unknown[]; text: string }

/** Compile the model's JSONL patches (json-render's format) into Slack blocks, or return the problems. */
export function jsonlToSlackCard(
	jsonl: string,
): { ok: true; card: SlackCard } | { ok: false; issues: string[] } {
	try {
		const spec = realLineBreaks(compileSpecStream(jsonl)) as unknown as Spec
		// The blocks subpath declares its own copy of chat's card type; the object is the same.
		const card = toCard(spec, { components, limits }) as unknown as Parameters<typeof cardToBlockKit>[0]
		return { ok: true, card: { blocks: cardToBlockKit(card), text: cardToFallbackText(card) } }
	} catch (err) {
		if (err instanceof CardSpecError) return { ok: false, issues: err.issues }
		return { ok: false, issues: [err instanceof Error ? err.message : String(err)] }
	}
}
