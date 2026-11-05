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

const FIRST_READ_DAYS = 30

// Never read further back than 30 days, even for a channel with no saved position.
export function observeStartTs(cursor: string, nowMs: number): string {
	const earliest = Math.floor(nowMs / 1000) - FIRST_READ_DAYS * 24 * 60 * 60
	return Number(cursor) > earliest ? cursor : String(earliest)
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
