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
			description: `Post a formatted Slack card in this conversation: a title, KPI fields, one table, up to 2 charts, link buttons. Use this tool instead of a markdown table whenever the answer is about performance, spend, KPIs vs target, pacing, a breakdown by campaign, platform, client or month, or a list of clients with their status. Layout that reads best:
1. A Text first with the takeaway in one or two sentences, key numbers in *bold* (e.g. "Combo CPR อยู่ที่ *13.41 THB* ดีกว่าเป้า 11% แต่ใช้งบ พ.ย. ช้า คาดจบเดือนที่ *58%*").
2. Fields with exactly 2 grouped Field items side by side, e.g. label "ผลลัพธ์" and label "งบ & Pacing". Each value is 2-4 lines, one metric per line: "CPR: *13.41 THB* ▲ ดีกว่าเป้า 11%". Use ▲/▼ or 🟢/🔴 for direction; keep each line short.
3. A Table for the breakdown (top 5-8 rows, short column names with units).
4. A Chart only when it adds something: prefer a bar chart comparing items (e.g. CPR by platform), a line chart for a trend; use pie only for 2-4 shares.
5. A muted Text last with the source and "ข้อมูลถึง <date>". Add an Actions LinkButton (e.g. "ดูรายงาน") only when you have a real URL. Use plain text for everything else. After it posts, reply only with any "→ ชื่อคน: action" lines; the takeaway is already in the card, so do not repeat it or its numbers.\n\nWrite the card in json-render's format below and pass it as jsonl. That format applies only to this argument; your replies to people stay normal text.\n<card_format>\n${CARD_PROMPT}\n</card_format>`,
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
					return "Card posted. Reply with one short line only; do not repeat what the card shows."
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
