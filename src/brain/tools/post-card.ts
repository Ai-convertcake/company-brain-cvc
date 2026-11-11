import type { ToolSet } from "ai"
import { CARD_PROMPT, jsonlToSlackCard } from "../slack/cards"
import { postSlackMessageRaw } from "../slack/client"
import type { TurnDeps } from "../turn/deps"

export type PostCardContext = { botToken: string; channel: string; threadTs?: string }

/** Posts a formatted card only where this conversation is happening; it takes no destination. */
export function createPostCardTools(
	deps: TurnDeps,
	ctx: PostCardContext,
	traceId: string,
): ToolSet {
	return {
		post_card: deps.tool({
			description: `Post a formatted Slack card in this conversation: text, side-by-side fields, one table, link buttons (no charts: Slack can't show them here). Use it when numbers are easier to compare in a card than in prose, such as performance, spend, KPIs vs target, pacing or a breakdown; for anything else plain text or bullets usually read better. Shape the card around what this answer needs. A layout that often works: the takeaway first with the key numbers in *bold*, fields grouping related metrics with ▲/▼ for direction, a table for the breakdown, then a small source line with \"ข้อมูลถึง <date>\". Use real line breaks inside a value, never a literal backslash-n. Add a LinkButton only for a real URL. After it posts, add only what the card doesn't already say (for example who should do what next); never repeat its numbers, and never leave the reply empty.\n\nWrite the card in json-render's format below and pass it as jsonl. That format applies only to this argument; your replies to people stay normal text.\n<card_format>\n${CARD_PROMPT}\n</card_format>`,
			inputSchema: deps.z.object({
				jsonl: deps.z.string().describe("The card as JSONL patch lines, one JSON object per line, in the card_format above."),
			}),
			execute: async ({ jsonl }) => {
				const out = jsonlToSlackCard(jsonl)
				if (!out.ok) {
					return `The card spec is invalid. Fix it, or answer in plain text:\n- ${out.issues.join("\n- ")}`
				}
				const { botToken, channel, threadTs } = ctx
				const posted = await postSlackMessageRaw(botToken, channel, out.card.text, threadTs, out.card.blocks)
				if (posted.ok) {
					console.log(`[company-brain][${traceId}] post_card posted channel=${channel} ts=${posted.ts}`)
					return "Card posted. Now reply with one short line: any \"→ name: action\" lines, or if there is nothing to do, a one-line pointer to the card (e.g. \"สรุปอยู่ในการ์ดด้านบนครับ\"). Never leave the reply empty, and do not repeat the card's numbers."
				}
				// Slack may reject a block type (e.g. data_table); the card's text version still gets through.
				console.warn(`[company-brain][${traceId}] post_card blocks rejected: ${posted.error}`)
				const plain = await postSlackMessageRaw(botToken, channel, out.card.text, threadTs)
				return plain.ok
					? `Slack rejected the card layout (${posted.error}), so its content was posted as plain text instead. Reply with one short line.`
					: `The card was NOT posted (${plain.error ?? posted.error}). Answer in plain text and do not say a card was posted.`
			},
		}),
	}
}
