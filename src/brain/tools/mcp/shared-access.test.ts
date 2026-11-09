import { describe, expect, it } from "vitest"
import {
	connectionsActorMayUse,
	isApprovedLearningChannel,
	isApprovedSearchChannel,
	isNexusLearningChannel,
	isPilotLockdown,
	observedMemoryScope,
	observeStartTs,
	scheduledRunMayUseShared,
	isApprovedSharedMcpChannel,
	isTrustedReadOnlyMcp,
} from "./shared-access"

describe("shared MCP access", () => {
	const shared = { userId: null }
	const personal = { userId: "u1" }

	it("hides shared connections unless the turn opted in", () => {
		expect(connectionsActorMayUse([shared, personal], {})).toEqual([personal])
		expect(
			connectionsActorMayUse([shared, personal], {
				allowSharedConnections: true,
			}),
		).toEqual([shared, personal])
	})

	it("only approves channels on the list, and none by default", () => {
		const env = { SHARED_MCP_CHANNELS: "C111, C222" }
		expect(isApprovedSharedMcpChannel(env, "C111")).toBe(true)
		expect(isApprovedSharedMcpChannel(env, "C222")).toBe(true)
		expect(isApprovedSharedMcpChannel(env, "C333")).toBe(false)
		expect(isApprovedSharedMcpChannel(env, "")).toBe(false)
		expect(isApprovedSharedMcpChannel({}, "C111")).toBe(false)
	})
})

describe("scheduled runs and shared tools", () => {
	const allowed = {
		env: { SHARED_MCP_CHANNELS: "C111" },
		kind: "digest",
		readOnly: true,
		target: "C111",
		isPrivate: true,
	}

	it("allows only a read-only digest to an approved private channel", () => {
		expect(scheduledRunMayUseShared(allowed)).toBe(true)
		for (const change of [
			{ kind: "reminder" },
			{ readOnly: undefined },
			{ target: "C222" },
			{ isPrivate: false },
			{ isPrivate: undefined },
			{ env: {} },
		]) {
			expect(scheduledRunMayUseShared({ ...allowed, ...change })).toBe(false)
		}
	})
})

describe("trusted read-only servers", () => {
	it("trusts only listed servers, and none by default", () => {
		const env = { READ_ONLY_MCP_SERVERS: "companybrainmcp" }
		expect(isTrustedReadOnlyMcp(env, "companybrainmcp")).toBe(true)
		expect(isTrustedReadOnlyMcp(env, "firecrawl")).toBe(false)
		expect(isTrustedReadOnlyMcp(env, "")).toBe(false)
		expect(isTrustedReadOnlyMcp({}, "companybrainmcp")).toBe(false)
	})
})

describe("private channel learning", () => {
	it("only learns from listed channels, and none by default", () => {
		const env = { LEARNING_CHANNELS: "C111, C222" }
		expect(isApprovedLearningChannel(env, "C222")).toBe(true)
		expect(isApprovedLearningChannel(env, "C333")).toBe(false)
		expect(isApprovedLearningChannel(env, "")).toBe(false)
		expect(isApprovedLearningChannel({}, "C111")).toBe(false)
	})

	it("reads back 30 days on the first run, then continues from the cursor", () => {
		const now = Date.UTC(2026, 10, 5)
		expect(observeStartTs("", now)).toBe(
			String(Date.UTC(2026, 9, 6) / 1000),
		)
		expect(observeStartTs("1793000000.000100", now)).toBe("1793000000.000100")
		expect(observeStartTs("1700000000.000100", now)).toBe(
			String(Date.UTC(2026, 9, 6) / 1000),
		)
	})

	it("saves private channels to their own space, never company-wide", () => {
		expect(observedMemoryScope("C111", true)).toEqual({
			kind: "private_channel",
			channelId: "C111",
		})
		expect(observedMemoryScope("C222", false)).toBeUndefined()
	})
})

describe("pilot lockdown", () => {
	it("is on only when PILOT_LOCKDOWN is on", () => {
		expect(isPilotLockdown({ PILOT_LOCKDOWN: "on" })).toBe(true)
		expect(isPilotLockdown({ PILOT_LOCKDOWN: "off" })).toBe(false)
		expect(isPilotLockdown({})).toBe(false)
	})
	it("allows search only in the approved channels", () => {
		const env = { SHARED_MCP_CHANNELS: "C1", LEARNING_CHANNELS: "C2, C3" }
		expect(isApprovedSearchChannel(env, "C1")).toBe(true)
		expect(isApprovedSearchChannel(env, "C3")).toBe(true)
		expect(isApprovedSearchChannel(env, "C9")).toBe(false)
		expect(isApprovedSearchChannel({}, "C1")).toBe(false)
	})

	it("learns through Nexus only for listed channels with a token", () => {
		const env = { NEXUS_LEARNING_CHANNELS: "C1, C2", NEXUS_BOT_TOKEN: "x" }
		expect(isNexusLearningChannel(env, "C2")).toBe(true)
		expect(isNexusLearningChannel(env, "C3")).toBe(false)
		expect(isNexusLearningChannel({ NEXUS_LEARNING_CHANNELS: "C1" }, "C1")).toBe(false)
	})
})
