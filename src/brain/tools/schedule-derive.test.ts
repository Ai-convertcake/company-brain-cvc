import { describe, expect, it } from "vitest"
import { savesAsAutomation } from "./schedule-derive"

describe("savesAsAutomation", () => {
	const recurring = { kind: "cron", cron: "0 2 * * 1-5" } as const

	it("saves recurring channel digests as automations", () => {
		for (const deliverTo of ["origin", "channel"] as const) {
			expect(
				savesAsAutomation({ when: recurring, kind: "digest", deliverTo }),
			).toBe(true)
		}
	})

	it("leaves reminders, one-off runs and DM digests alone", () => {
		expect(
			savesAsAutomation({
				when: recurring,
				kind: "reminder",
				deliverTo: "origin",
			}),
		).toBe(false)
		expect(
			savesAsAutomation({
				when: { kind: "in", delaySeconds: 60 },
				kind: "digest",
				deliverTo: "origin",
			}),
		).toBe(false)
		expect(
			savesAsAutomation({ when: recurring, kind: "digest", deliverTo: "dm" }),
		).toBe(false)
	})
})
