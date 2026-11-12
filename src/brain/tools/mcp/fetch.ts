import type { FetchLike } from "@modelcontextprotocol/sdk/shared/transport.js"

// Above the SDK's 60s per-request timeout so this only catches what it misses:
// the OAuth discovery and token fetches, which carry no signal at all.
const MCP_FETCH_TIMEOUT_MS = 75_000

function acceptHeader(headers: RequestInit["headers"]): string {
	if (!headers) return ""
	if (headers instanceof Headers) return headers.get("accept") ?? ""
	const entries = Array.isArray(headers)
		? (headers as string[][])
		: Object.entries(headers as Record<string, string>)
	for (const [key, value] of entries) {
		if (key?.toLowerCase() === "accept") return value ?? ""
	}
	return ""
}

// The long-lived notification stream is the only GET asking for text/event-stream
// alone; JSON-RPC POSTs accept application/json too. It must not be timed out.
function isNotificationStream(init?: RequestInit): boolean {
	if ((init?.method ?? "GET").toUpperCase() !== "GET") return false
	return acceptHeader(init?.headers).includes("text/event-stream")
}

// Some servers with a path in their issuer (https://host/app) publish OAuth metadata at
// /app/.well-known/oauth-authorization-server, not the RFC 8414 /.well-known/oauth-authorization-server/app
// the SDK asks for. Without this the SDK falls through to an OpenID URL and fails on missing OIDC fields.
export function suffixMetadataUrl(url: string | URL): URL | undefined {
	const u = new URL(url)
	const prefix = "/.well-known/oauth-authorization-server/"
	if (!u.pathname.startsWith(prefix)) return undefined
	return new URL(`/${u.pathname.slice(prefix.length)}/.well-known/oauth-authorization-server`, u.origin)
}

export function withMcpFetchTimeout(inner?: FetchLike): FetchLike {
	const base: FetchLike = inner ?? ((url, init) => fetch(url, init))
	const timed: FetchLike = (url, init) => {
		if (isNotificationStream(init)) return base(url, init)
		const timeout = AbortSignal.timeout(MCP_FETCH_TIMEOUT_MS)
		return base(url, {
			...init,
			signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
		})
	}
	return async (url, init) => {
		const res = await timed(url, init)
		const fallback = res.status === 404 ? suffixMetadataUrl(url) : undefined
		if (!fallback) return res
		const retry = await timed(fallback, init)
		if (retry.ok) return retry
		await retry.body?.cancel()
		return res
	}
}
