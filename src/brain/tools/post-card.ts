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
			description: `Post a formatted Slack card in this conversation: a title, KPI fields, one table, link buttons. Use it for structured results such as client status lists, KPI summaries or comparisons; use plain text for everything else. After it posts, reply with one short line and do not repeat what the card shows.\n\n${CARD_SPEC_GUIDE}`,
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
