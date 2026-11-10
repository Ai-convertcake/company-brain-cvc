import { describe, expect, it } from "vitest"
import { specToSlackCard } from "./cards"

describe("Slack cards", () => {
	it("turns a Thai report spec into Slack blocks", () => {
		const out = specToSlackCard({
			root: "card",
			elements: {
				card: { type: "Card", props: { title: "สรุปลูกค้าวันนี้" }, children: ["kpis", "table"] },
				kpis: { type: "Fields", props: {}, children: ["f1"] },
				f1: { type: "Field", props: { label: "ลูกค้า 🔴", value: 2 }, children: [] },
				table: {
					type: "Table",
					props: { headers: ["ลูกค้า", "สถานะ"], rows: [["StashAway", "🟡"], ["THE NEXT", "🔴"]] },
					children: [],
				},
			},
		})
		expect(out.ok).toBe(true)
		if (!out.ok) return
		const types = out.card.blocks.map((b) => (b as { type: string }).type)
		expect(types[0]).toBe("header")
		expect(types).toContain("data_table")
		expect(out.card.text).toContain("สรุปลูกค้าวันนี้")
	})

	it("returns readable problems for a bad spec, and blocks buttons", () => {
		const out = specToSlackCard({
			root: "card",
			elements: {
				card: { type: "Card", props: {}, children: ["b"] },
				b: { type: "Button", props: { id: "x", label: "Go" }, children: [] },
			},
		})
		expect(out.ok).toBe(false)
	})

	it("turns a chart into a Slack data_visualization block", () => {
		const out = specToSlackCard({
			root: "card",
			elements: {
				card: { type: "Card", props: { title: "Spend" }, children: ["c"] },
				c: { type: "Chart", props: { title: "By platform", chart: { type: "pie", segments: [{ label: "TikTok", value: 60 }, { label: "Google", value: 40 }] } }, children: [] },
			},
		})
		expect(out.ok && out.card.blocks.some((b) => (b as { type: string }).type === "data_visualization")).toBe(true)
	})
})
