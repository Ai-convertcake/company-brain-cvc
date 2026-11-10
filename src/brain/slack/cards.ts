import { cardToBlockKit, cardToFallbackText } from "@chat-adapter/slack/blocks"
import { CardSpecError, standardComponentDefinitions as std, toCard } from "@json-render/chat"
import type { Spec } from "@json-render/core"

// ponytail: no Button (the bot has no click handler) and no Chart (not checked in Slack yet).
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

// Short guide for the model; json-render's own catalog.prompt() teaches a 12k-char streaming format.
export const CARD_SPEC_GUIDE = `Spec shape: { "root": "<id>", "elements": { "<id>": { "type", "props", "children": ["<id>", ...] } } }. The root element must be a Card.
Components:
- Card { title?, subtitle? } — the message; children are the content.
- Section {} — groups children.
- Text { content, style?: "plain"|"bold"|"muted" } — markdown paragraph.
- Fields {} with Field children { label, value } — KPI grid.
- Table { headers: string[], rows: (string|number)[][], align?: ("left"|"center"|"right")[], caption? } — one table per card, at most 100 rows.
- Divider {} — separator.
- Actions {} with LinkButton children { label, url } — buttons that open links.
Every element needs "children" (use [] when empty).`

// Slack turns a second table into a code block and caps a table at 100 rows.
const limits = { tables: 1, tableRows: 100 }

export type SlackCard = { blocks: unknown[]; text: string }

/** Validate a json-render spec and turn it into Slack blocks, or return the problems. */
export function specToSlackCard(
	spec: unknown,
): { ok: true; card: SlackCard } | { ok: false; issues: string[] } {
	try {
		// The blocks subpath declares its own copy of chat's card type; the object is the same.
		const card = toCard(spec as Spec, { components, limits }) as unknown as Parameters<typeof cardToBlockKit>[0]
		return { ok: true, card: { blocks: cardToBlockKit(card), text: cardToFallbackText(card) } }
	} catch (err) {
		if (err instanceof CardSpecError) return { ok: false, issues: err.issues }
		return { ok: false, issues: [err instanceof Error ? err.message : String(err)] }
	}
}
