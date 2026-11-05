import { describe, expect, it } from "vitest"
import {
	connectionsActorMayUse,
	isApprovedLearningChannel,
	observedMemoryScope,
	isApprovedSharedMcpChannel,
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

describe("private channel learning", () => {
	it("only learns from listed channels, and none by default", () => {
		const env = { LEARNING_CHANNELS: "C111, C222" }
		expect(isApprovedLearningChannel(env, "C222")).toBe(true)
		expect(isApprovedLearningChannel(env, "C333")).toBe(false)
		expect(isApprovedLearningChannel(env, "")).toBe(false)
		expect(isApprovedLearningChannel({}, "C111")).toBe(false)
	})

	it("saves private channels to their own space, never company-wide", () => {
		expect(observedMemoryScope("C111", true)).toEqual({
			kind: "private_channel",
			channelId: "C111",
		})
		expect(observedMemoryScope("C222", false)).toBeUndefined()
	})
})
