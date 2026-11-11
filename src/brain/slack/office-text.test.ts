import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { fileToText, textFileKind } from "./office-text"

const fixture = (name: string) => new Uint8Array(readFileSync(`${__dirname}/__fixtures__/${name}`))

describe("office-text", () => {
	it("knows which files it can read", () => {
		expect(textFileKind("a.xlsx")).toBe("xlsx")
		expect(textFileKind("a.bin", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("docx")
		expect(textFileKind("a.csv", "application/octet-stream")).toBe("text")
		expect(textFileKind("a.png", "image/png")).toBeUndefined()
	})
	it("reads an Excel sheet with names, shared strings, gaps and formulas", async () => {
		const text = await fileToText("xlsx", fixture("plan.xlsx"))
		expect(text).toBe("## Sheet: งบ & KPI\nPlatform | Budget\nMeta Ads |  | 50000")
	})
	it("reads a Word document with a table", async () => {
		const text = await fileToText("docx", fixture("brief.docx"))
		expect(text).toContain("Brief: Dr. Tan")
		expect(text).toContain("KPI\n | CPL < 300")
	})
	it("passes CSV through", async () => {
		expect(await fileToText("text", new TextEncoder().encode("a,b\n1,2"))).toBe("a,b\n1,2")
	})
})
