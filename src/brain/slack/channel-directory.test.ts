import { describe, expect, it } from "vitest"
import { checkAskerCanSearchChannel } from "./channel-directory"

const env = { SHARED_MCP_CHANNELS: "CPILOT", LEARNING_CHANNELS: "" } as Env
const channel = (id: string) => ({ id, name: id, isPrivate: false }) as never

describe("checkAskerCanSearchChannel approved list", () => {
	it("refuses other channels that are not approved", async () => {
		const r = await checkAskerCanSearchChannel(env, "T", "xoxb", channel("CHELP"), "U1", {
			currentChannelId: "CPILOT",
			isOrgMember: true,
		})
		expect(r).toEqual({ ok: false, reason: "not_approved_channel" })
	})
	it("allows an approved public channel and the current channel", async () => {
		const opts = { currentChannelId: "CHELP", isOrgMember: true }
		expect(await checkAskerCanSearchChannel(env, "T", "xoxb", channel("CPILOT"), "U1", opts)).toEqual({ ok: true })
		expect(await checkAskerCanSearchChannel(env, "T", "xoxb", channel("CHELP"), "U1", opts)).toEqual({ ok: true })
	})
})
