import { describe, expect, it } from "vitest"
import {
	buildBrainPersonalEntityContext,
	buildBrainPrivateChannelEntityContext,
	buildBrainSelfEntityContext,
	buildBrainSharedEntityContext,
	ENTITY_CONTEXT_MAX_CHARS,
} from "./profile-config"

describe("entity context", () => {
	it("fits Supermemory's limit, or it gets rejected and no rules apply", () => {
		const contexts = [
			buildBrainSelfEntityContext(),
			buildBrainSharedEntityContext({
				orgName: "Convert Cake",
				domain: "convertcake.com",
			}),
			buildBrainPrivateChannelEntityContext({
				channelName: "recovery-me-clinic",
			}),
			buildBrainPersonalEntityContext({ memberName: "Wave Nattametee" }),
		]
		for (const context of contexts) {
			expect(context.length).toBeLessThanOrEqual(ENTITY_CONTEXT_MAX_CHARS)
		}
	})
})
