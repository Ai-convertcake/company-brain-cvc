import type { ScheduledTaskPayload, ScheduleWhen } from "./scheduling"

// One day of the week => weekly. Every day or several days, like Mon-Fri => daily.
export function cronToCadence(cron: string): "daily" | "weekly" {
	const dow = cron.trim().split(/\s+/)[4]
	return dow && /^\w+$/.test(dow) ? "weekly" : "daily"
}

// Recurring channel digests live on the Automations page, so admins can see and
// run them. Reminders and DM digests stay personal to whoever set them.
export function savesAsAutomation(args: {
	when: ScheduleWhen
	kind: ScheduledTaskPayload["kind"]
	deliverTo: ScheduledTaskPayload["deliverTo"]
}): boolean {
	return (
		args.when.kind === "cron" &&
		args.kind === "digest" &&
		args.deliverTo !== "dm"
	)
}

// Derived from timing and destination: inheriting these on replace leaks personal creds into channels.
export function derivedScheduleFields(args: {
	when: ScheduleWhen
	kind: ScheduledTaskPayload["kind"]
	deliverTo: ScheduledTaskPayload["deliverTo"]
}): Pick<
	ScheduledTaskPayload,
	"cadence" | "orgSharedOnly" | "readOnly" | "personalConnectionsOnly"
> {
	const orgScoped = args.kind === "digest" && args.deliverTo !== "dm"
	return {
		cadence:
			args.when.kind === "cron" ? cronToCadence(args.when.cron) : undefined,
		orgSharedOnly: orgScoped,
		// Every digest is read-only; only credential scope follows the destination.
		readOnly: args.kind === "digest" ? true : undefined,
		personalConnectionsOnly: orgScoped ? false : undefined,
	}
}
