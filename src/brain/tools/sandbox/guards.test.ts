import { describe, expect, it } from "vitest"
import { downloadImage, workspacePath } from "./guards"

describe("workspacePath", () => {
	it("puts plain names in the workspace", () => {
		expect(workspacePath("test.docx", "workspace")).toBe("workspace/test.docx")
		expect(workspacePath("./a.py", "workspace")).toBe("workspace/a.py")
	})
	it("keeps workspace and absolute paths", () => {
		expect(workspacePath("workspace/x.pdf", "workspace")).toBe("workspace/x.pdf")
		expect(workspacePath("/workspace/x.pdf", "workspace")).toBe("/workspace/x.pdf")
		expect(workspacePath(undefined, "workspace")).toBe("workspace")
	})
})

describe("downloadImage", () => {
	const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
	const fakeFetch = (body: BodyInit, init?: ResponseInit) =>
		(async () => new Response(body, init)) as unknown as typeof fetch
	it("returns the bytes of a real image", async () => {
		const out = await downloadImage("https://cdn.example.com/a.png", fakeFetch(png))
		expect(out.ok && out.bytes.byteLength).toBe(7)
	})
	it("rejects private hosts, http, and non-images", async () => {
		expect((await downloadImage("http://cdn.example.com/a.png", fakeFetch(png))).ok).toBe(false)
		expect((await downloadImage("https://127.0.0.1/a.png", fakeFetch(png))).ok).toBe(false)
		expect((await downloadImage("https://x.com/a.png", fakeFetch("<html>login</html>"))).ok).toBe(false)
		expect((await downloadImage("https://x.com/a.png", fakeFetch(png, { status: 404 }))).ok).toBe(false)
	})
})
