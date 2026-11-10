import { cardToBlockKit, cardToFallbackText } from "@chat-adapter/slack/blocks"
import { CardSpecError, schema, standardComponentDefinitions as std, toCard } from "@json-render/chat"
import { compileSpecStream, defineCatalog, type Spec } from "@json-render/core"

// ponytail: no Button yet; the bot has no click handler.
const components = {
	Card: std.Card,
	Section: std.Section,
	Text: std.Text,
	Fields: std.Fields,
	Field: std.Field,
	Table: std.Table,
	Chart: std.Chart,
	Divider: std.Divider,
	Actions: std.Actions,
	LinkButton: std.LinkButton,
}

// json-render's own catalog and prompt, limited to the components above.
export const cardCatalog = defineCatalog(schema, { components })
export const CARD_PROMPT = cardCatalog.prompt()

// Slack turns a second table into a code block and caps a table at 100 rows.
// ponytail: chart limits are a guess (2 charts, 31 points); Slack's own caps aren't checked yet.
const limits = { tables: 1, tableRows: 100, charts: 2, chartPoints: 31 }

export type SlackCard = { blocks: unknown[]; text: string }

/** Compile the model's JSONL patches (json-render's format) into Slack blocks, or return the problems. */
export function jsonlToSlackCard(
	jsonl: string,
): { ok: true; card: SlackCard } | { ok: false; issues: string[] } {
	try {
		const spec = compileSpecStream(jsonl) as unknown as Spec
		// The blocks subpath declares its own copy of chat's card type; the object is the same.
		const card = toCard(spec, { components, limits }) as unknown as Parameters<typeof cardToBlockKit>[0]
		return { ok: true, card: { blocks: cardToBlockKit(card), text: cardToFallbackText(card) } }
	} catch (err) {
		if (err instanceof CardSpecError) return { ok: false, issues: err.issues }
		return { ok: false, issues: [err instanceof Error ? err.message : String(err)] }
	}
}
