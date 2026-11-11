/** Slack channels where org-shared MCP tools may be used (SHARED_MCP_CHANNELS). */
export function isApprovedSharedMcpChannel(
	env: Pick<Env, "SHARED_MCP_CHANNELS">,
	channelId: string,
): boolean {
	return (env.SHARED_MCP_CHANNELS ?? "")
		.split(",")
		.some((id) => id.trim() !== "" && id.trim() === channelId)
}

/** Private Slack channels the bot may learn from unprompted (LEARNING_CHANNELS). */
export function isApprovedLearningChannel(
	env: Pick<Env, "LEARNING_CHANNELS">,
	channelId: string,
): boolean {
	return (env.LEARNING_CHANNELS ?? "")
		.split(",")
		.some((id) => id.trim() !== "" && id.trim() === channelId)
}

/**
 * Private channels the bot learns from through the Nexus AI bot's token, without
 * being a member (NEXUS_LEARNING_CHANNELS). Their memories are team-wide.
 */
export function isNexusLearningChannel(
	env: Pick<Env, "NEXUS_LEARNING_CHANNELS" | "NEXUS_BOT_TOKEN">,
	channelId: string,
): boolean {
	return Boolean(env.NEXUS_BOT_TOKEN) && nexusLearningChannels(env).includes(channelId)
}

export function nexusLearningChannels(
	env: Pick<Env, "NEXUS_LEARNING_CHANNELS">,
): string[] {
	return (env.NEXUS_LEARNING_CHANNELS ?? "")
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean)
}

// "C123=Sentiment Watch;C456=..." limits a learned channel to posts containing that
// text, plus their threads. Channels not listed are learned in full.
export function nexusChannelKeyword(
	env: Pick<Env, "NEXUS_CHANNEL_FILTERS">,
	channelId: string,
): string | undefined {
	for (const pair of (env.NEXUS_CHANNEL_FILTERS ?? "").split(";")) {
		const [id, ...rest] = pair.split("=")
		if (id?.trim() === channelId) return rest.join("=").trim() || undefined
	}
	return undefined
}

// The learner numbers messages [1], [2]…; turn the refs a memory cites into message indexes.
export function citedMessageIndexes(refs: string[], messageCount: number, max = 3): number[] {
	const out: number[] = []
	for (const ref of refs) {
		const m = /^\s*[[#]?(\d+)\]?\s*$/.exec(ref)
		const i = m ? Number(m[1]) - 1 : -1
		if (i >= 0 && i < messageCount && !out.includes(i)) out.push(i)
		if (out.length >= max) break
	}
	return out
}

const FIRST_READ_DAYS = 30

// Never read further back than 30 days, even for a channel with no saved position.
export function observeStartTs(cursor: string, nowMs: number): string {
	const earliest = Math.floor(nowMs / 1000) - FIRST_READ_DAYS * 24 * 60 * 60
	return Number(cursor) > earliest ? cursor : String(earliest)
}

// Names the channel on every memory, so a client channel's memories say which client.
export function channelContextLine(info: {
	name?: string
	topic?: string
	purpose?: string
}): string {
	if (!info.name) return ""
	const about = [info.topic, info.purpose]
		.map((s) => s?.trim())
		.filter(Boolean)
		.join(" — ")
		.slice(0, 200)
	return `SLACK_CHANNEL: #${info.name}${about ? ` (${about})` : ""}`
}

// The learner only stores text, so fold file names and link previews into it.
export function observedMessageText(message: {
	text?: string
	files?: Array<{ name?: string; mimetype?: string }>
	attachments?: Array<{ title?: string; title_link?: string }>
}): string {
	const parts = [message.text ?? ""]
	for (const file of message.files ?? []) {
		if (file.name) {
			parts.push(`[file: ${file.name}${file.mimetype ? ` (${file.mimetype})` : ""}]`)
		}
	}
	for (const link of message.attachments ?? []) {
		if (link.title_link) parts.push(`[link: ${link.title ?? ""} ${link.title_link}]`)
	}
	return parts.filter(Boolean).join("\n")
}

const LEARNABLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"])
const MAX_LEARNED_IMAGE_BYTES = 10 * 1024 * 1024

// Images worth describing: posted by a person, a readable type, small enough, within budget.
export function imagesToDescribe<T extends { mimetype?: string; size?: number }>(
	files: T[] | undefined,
	fromBot: boolean,
	budget: number,
): T[] {
	if (fromBot || budget <= 0) return []
	return (files ?? [])
		.filter(
			(f) =>
				LEARNABLE_IMAGE_TYPES.has((f.mimetype ?? "").toLowerCase()) &&
				(f.size ?? 0) <= MAX_LEARNED_IMAGE_BYTES,
		)
		.slice(0, budget)
}

const READABLE_DOC = /\.(xlsx|docx|csv|tsv|txt|md|pdf)$/i

// Files worth summarizing: posted by a person, a readable kind, small enough, within budget.
export function documentsToRead<T extends { name?: string; mimetype?: string; size?: number }>(
	files: T[] | undefined,
	fromBot: boolean,
	budget: number,
): T[] {
	if (fromBot || budget <= 0) return []
	return (files ?? [])
		.filter(
			(f) =>
				(READABLE_DOC.test(f.name ?? "") || f.mimetype === "application/pdf") &&
				(f.size ?? 0) <= MAX_LEARNED_IMAGE_BYTES,
		)
		.slice(0, budget)
}

export type GoogleFileLink = { id: string; kind: "doc" | "sheet" }

// Google Docs and Sheets links in a message, deduped, in order.
export function googleFileLinks(text: string): GoogleFileLink[] {
	const out: GoogleFileLink[] = []
	for (const m of text.matchAll(/docs\.google\.com\/(document|spreadsheets)\/d\/([\w-]{20,})/g)) {
		const id = m[2] ?? ""
		if (!out.some((l) => l.id === id)) out.push({ id, kind: m[1] === "document" ? "doc" : "sheet" })
	}
	return out
}

// Composio wraps a download in nested JSON; the file itself sits behind an "s3url".
export function findS3Url(value: unknown): string | undefined {
	if (typeof value === "string") {
		try {
			return findS3Url(JSON.parse(value))
		} catch {
			return undefined
		}
	}
	if (!value || typeof value !== "object") return undefined
	const url = (value as { s3url?: unknown }).s3url
	if (typeof url === "string" && url.startsWith("https://")) return url
	for (const child of Object.values(value)) {
		const found = findS3Url(child)
		if (found) return found
	}
	return undefined
}

// Slack can answer a missing scope with an HTML sign-in page, so check the bytes are an image.
export function looksLikeImage(b: Uint8Array): boolean {
	const starts = (...bytes: number[]) => bytes.every((x, i) => b[i] === x)
	return (
		starts(0x89, 0x50, 0x4e, 0x47) || // png
		starts(0xff, 0xd8, 0xff) || // jpeg
		starts(0x47, 0x49, 0x46) || // gif
		(starts(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) // webp
	)
}

// No scope means company-wide memory, which must never hold a private channel.
export function observedMemoryScope(channelId: string, isPrivate: boolean) {
	return isPrivate
		? { kind: "private_channel" as const, channelId }
		: undefined
}

/** Read-only digests may use shared tools only when posting to an approved private channel. */
export function scheduledRunMayUseShared(args: {
	env: Pick<Env, "SHARED_MCP_CHANNELS">
	kind: string | undefined
	readOnly: boolean | undefined
	target: string
	isPrivate: boolean | undefined
}): boolean {
	return (
		args.kind === "digest" &&
		args.readOnly === true &&
		args.isPrivate === true &&
		isApprovedSharedMcpChannel(args.env, args.target)
	)
}

/** Servers we run and know are read-only, so an AI guess can't block their calls. */
export function isTrustedReadOnlyMcp(
	env: Pick<Env, "READ_ONLY_MCP_SERVERS">,
	serverSlug: string,
): boolean {
	return (env.READ_ONLY_MCP_SERVERS ?? "")
		.split(",")
		.some((slug) => slug.trim() !== "" && slug.trim() === serverSlug)
}

// Org-shared credentials reach everyone who can talk to the bot, so they stay
// hidden unless the turn opted in. Automations and rollout checks never do.
export function connectionsActorMayUse<T extends { userId: string | null }>(
	connections: T[],
	actor: { allowSharedConnections?: boolean },
): T[] {
	return actor.allowSharedConnections
		? connections
		: connections.filter((connection) => connection.userId !== null)
}

/** Pilot lockdown: no DMs, no automatic team invites, no automatic channel joins. */
export function isPilotLockdown(env: Pick<Env, "PILOT_LOCKDOWN">): boolean {
	return env.PILOT_LOCKDOWN === "on"
}

/** Channels Slack search may read besides the current one: the approved lists. */
export function isApprovedSearchChannel(
	env: Pick<Env, "SHARED_MCP_CHANNELS" | "LEARNING_CHANNELS">,
	channelId: string,
): boolean {
	return (
		isApprovedSharedMcpChannel(env, channelId) ||
		isApprovedLearningChannel(env, channelId)
	)
}
