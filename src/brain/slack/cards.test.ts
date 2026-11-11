import { describe, expect, it } from "vitest"
import { CARD_PROMPT, jsonlToSlackCard } from "./cards"

const lines = (...ops: object[]) => ops.map((o) => JSON.stringify(o)).join("\n")

describe("Slack cards", () => {
	it("compiles json-render JSONL into Thai Slack blocks with fields and a table", () => {
		const out = jsonlToSlackCard(
			lines(
				{ op: "add", path: "/root", value: "card" },
				{ op: "add", path: "/elements/card", value: { type: "Card", props: { title: "สรุปลูกค้าวันนี้" }, children: ["kpis", "table"] } },
				{ op: "add", path: "/elements/kpis", value: { type: "Fields", props: {}, children: ["f1"] } },
				{ op: "add", path: "/elements/f1", value: { type: "Field", props: { label: "ลูกค้า 🔴", value: "Surgery: *9,325 THB*\\nAcne: *933 THB*" }, children: [] } },
				{ op: "add", path: "/elements/table", value: { type: "Table", props: { headers: ["ลูกค้า", "สถานะ"], rows: [["StashAway", "🟡"]] }, children: [] } },
			),
		)
		expect(out.ok).toBe(true)
		if (!out.ok) return
		const types = out.card.blocks.map((b) => (b as { type: string }).type)
		expect(types[0]).toBe("header")
		expect(types).toEqual(expect.arrayContaining(["section", "data_table"]))
		expect(out.card.text).toContain("สรุปลูกค้าวันนี้")
		// A double-escaped line break becomes a real one, so bold still works in Slack.
		expect(JSON.stringify(out.card.blocks)).toContain("*9,325 THB*\\nAcne")
		expect(JSON.stringify(out.card.blocks)).not.toContain("\\\\n")
	})

	it("rejects charts, which Slack doesn't render here", () => {
		const chart = jsonlToSlackCard(
			lines(
				{ op: "add", path: "/root", value: "card" },
				{ op: "add", path: "/elements/card", value: { type: "Card", props: {}, children: ["c"] } },
				{ op: "add", path: "/elements/c", value: { type: "Chart", props: { title: "x", chart: { type: "pie", segments: [{ label: "a", value: 1 }] } }, children: [] } },
			),
		)
		expect(chart.ok).toBe(false)
	})

	it("returns readable problems for buttons and broken input", () => {
		const button = jsonlToSlackCard(
			lines(
				{ op: "add", path: "/root", value: "card" },
				{ op: "add", path: "/elements/card", value: { type: "Card", props: {}, children: ["b"] } },
				{ op: "add", path: "/elements/b", value: { type: "Button", props: { id: "x", label: "Go" }, children: [] } },
			),
		)
		expect(button.ok).toBe(false)
		expect(jsonlToSlackCard("not json").ok).toBe(false)
		expect(CARD_PROMPT).toContain("Table")
	})
})
