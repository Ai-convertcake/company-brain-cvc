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

// No scope means company-wide memory, which must never hold a private channel.
export function observedMemoryScope(channelId: string, isPrivate: boolean) {
	return isPrivate
		? { kind: "private_channel" as const, channelId }
		: undefined
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
