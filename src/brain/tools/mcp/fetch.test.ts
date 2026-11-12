import { describe, expect, it } from "vitest"
import { suffixMetadataUrl, withMcpFetchTimeout } from "./fetch"

describe("OAuth metadata fallback", () => {
	it("maps the RFC 8414 path form to the path-suffix form", () => {
		expect(suffixMetadataUrl("https://h.net/.well-known/oauth-authorization-server/social-media")?.href).toBe(
			"https://h.net/social-media/.well-known/oauth-authorization-server",
		)
		expect(suffixMetadataUrl("https://h.net/.well-known/oauth-authorization-server")).toBeUndefined()
		expect(suffixMetadataUrl("https://h.net/social-media/mcp")).toBeUndefined()
	})

	it("retries a 404 at the suffix URL and keeps the original 404 if that fails too", async () => {
		const seen: string[] = []
		const fake = (ok: string) => async (url: string | URL) => {
			seen.push(String(url))
			return new Response("{}", { status: String(url) === ok ? 200 : 404 })
		}
		const good = withMcpFetchTimeout(fake("https://h.net/app/.well-known/oauth-authorization-server"))
		expect((await good("https://h.net/.well-known/oauth-authorization-server/app")).status).toBe(200)
		const bad = withMcpFetchTimeout(fake("none"))
		expect((await bad("https://h.net/.well-known/oauth-authorization-server/app")).status).toBe(404)
		expect((await bad("https://h.net/app/mcp")).status).toBe(404)
		expect(seen.length).toBe(5)
	})
})
