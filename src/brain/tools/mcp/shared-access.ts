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
