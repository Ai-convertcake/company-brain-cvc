import type { ToolSet } from "ai"
import { CARD_SPEC_GUIDE, specToSlackCard } from "../slack/cards"
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
			description: `Post a formatted Slack card in this conversation: a title, KPI fields, one table, up to 2 charts, link buttons. Use this tool instead of a markdown table whenever the answer is about performance, spend, KPIs vs target, pacing, a breakdown by campaign, platform, client or month, or a list of clients with their status. Put the headline numbers in Fields, the breakdown in a Table, a trend or share in a Chart, and the data source and date in a muted Text. Use plain text for everything else. After it posts, reply with one or two short lines (the takeaway and any action) and do not repeat what the card shows.\n\n${CARD_SPEC_GUIDE}`,
			inputSchema: deps.z.object({
				spec: deps.z
					.object({
						root: deps.z.string(),
						elements: deps.z.record(deps.z.string(), deps.z.any()),
					})
					.describe("The json-render card spec."),
			}),
			execute: async ({ spec }) => {
				const out = specToSlackCard(spec)
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
