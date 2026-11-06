import type { SlackMemberLookup } from "../slack/workspace"

// Who a brain turn runs as. Org-scoped, optionally tied to a Slack user.
export type TurnActor = {
	orgId: string
	userId?: string
	isAdmin?: boolean
	/** Slack turns outside approved channels use only personal connections. */
	personalConnectionsOnly?: boolean
	/** Automations read strictly org-shared connections, ignoring userId. */
	orgSharedOnly?: boolean
	/** Approved channel: org-shared connections and the sandbox stay hidden otherwise. */
	allowSharedConnections?: boolean
	/** Block ALL MCP writes (org-shared and personal). Automations are read-only. */
	readOnly?: boolean
	memberLookup?: SlackMemberLookup
}
