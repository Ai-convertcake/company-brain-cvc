import { describe, expect, it } from "vitest"
import { isFeedbackReactionEvent, voteFromReaction } from "./events"
import { reviewSummaryText } from "../tools/mcp/shared-access"

describe("answer feedback", () => {
	it("reads thumbs with or without a skin tone", () => {
		expect(voteFromReaction("+1")).toBe("up")
		expect(voteFromReaction("+1::skin-tone-3")).toBe("up")
		expect(voteFromReaction("thumbsdown")).toBe("down")
		expect(voteFromReaction("-1::skin-tone-5")).toBe("down")
		expect(voteFromReaction("heart")).toBeUndefined()
	})

	it("only handles added thumbs or ❌ on a message", () => {
		const on = (type: string, reaction: string) =>
			isFeedbackReactionEvent({ type, reaction, item: { type: "message", channel: "C1", ts: "1.2" } } as never)
		expect(on("reaction_added", "+1")).toBe(true)
		expect(on("reaction_added", "x")).toBe(true)
		expect(on("reaction_removed", "+1")).toBe(false)
		expect(on("reaction_added", "bug")).toBe(false)
	})

	it("summarizes the night and yesterday's votes", () => {
		const text = reviewSummaryText({
			learned: [
				{ channel: "C1", title: "a" },
				{ channel: "C1", title: "b" },
				{ channel: "C2", title: "c" },
			],
			up: 4,
			down: 1,
			downLinks: ["https://x.slack.com/p1"],
		})
		expect(text).toContain("3 เรื่อง จาก 2 ช่อง")
		expect(text).toContain("👍 4  👎 1")
		expect(text).toContain("<https://x.slack.com/p1|ดูคำตอบ>")
		expect(reviewSummaryText({ learned: [], up: 0, down: 0, downLinks: [] })).not.toContain("👍")
	})
})
