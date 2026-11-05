/** Slack channels where org-shared MCP tools may be used (SHARED_MCP_CHANNELS). */
export function isApprovedSharedMcpChannel(
	env: Pick<Env, "SHARED_MCP_CHANNELS">,
	channelId: string,
): boolean {
	return (env.SHARED_MCP_CHANNELS ?? "")
		.split(",")
		.some((id) => id.trim() !== "" && id.trim() === channelId)
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
