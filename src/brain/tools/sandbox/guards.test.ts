import { describe, expect, it } from "vitest"
import { workspacePath } from "./guards"

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
