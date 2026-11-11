import { describe, expect, it } from "vitest"
import {
	channelContextLine,
	connectionsActorMayUse,
	isApprovedLearningChannel,
	isApprovedSearchChannel,
	isNexusLearningChannel,
	isPilotLockdown,
	observedMemoryScope,
	observedMessageText,
	citedMessageIndexes,
	nexusChannelKeyword,
	documentsToRead,
	findS3Url,
	googleFileLinks,
	imagesToDescribe,
	looksLikeImage,
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

	it("names the channel so memories say which client they are about", () => {
		expect(channelContextLine({ name: "sukishi-cvc", topic: " Sukishi ads ", purpose: "" })).toBe(
			"SLACK_CHANNEL: #sukishi-cvc (Sukishi ads)",
		)
		expect(channelContextLine({ name: "general" })).toBe("SLACK_CHANNEL: #general")
		expect(channelContextLine({ topic: "x" })).toBe("")
	})

	it("keeps file names and link previews in the learned text", () => {
		expect(
			observedMessageText({
				text: "brief here",
				files: [{ name: "Nov_pricing.pdf", mimetype: "application/pdf" }, {}],
				attachments: [{ title: "Tracker", title_link: "https://docs.google.com/x" }, { title: "no link" }],
			}),
		).toBe("brief here\n[file: Nov_pricing.pdf (application/pdf)]\n[link: Tracker https://docs.google.com/x]")
		expect(observedMessageText({ files: [{ name: "a.png" }] })).toBe("[file: a.png]")
		expect(observedMessageText({})).toBe("")
	})

	it("describes only people's images of a readable type, within the budget", () => {
		const png = { mimetype: "image/png", size: 1000 }
		const files = [png, { mimetype: "application/pdf" }, { mimetype: "image/jpeg", size: 20 * 1024 * 1024 }, png]
		expect(imagesToDescribe(files, false, 10)).toEqual([png, png])
		expect(imagesToDescribe(files, false, 1)).toEqual([png])
		expect(imagesToDescribe(files, true, 10)).toEqual([])
		expect(imagesToDescribe(files, false, 0)).toEqual([])
	})

	it("tells real images from an HTML sign-in page", () => {
		expect(looksLikeImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe(true)
		expect(looksLikeImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true)
		expect(looksLikeImage(new TextEncoder().encode("<!DOCTYPE html>"))).toBe(false)
	})

	it("finds a channel's keyword filter, and none for unlisted channels", () => {
		const env = { NEXUS_CHANNEL_FILTERS: "C0126BTMW80=Sentiment Watch; C999=a=b" }
		expect(nexusChannelKeyword(env, "C0126BTMW80")).toBe("Sentiment Watch")
		expect(nexusChannelKeyword(env, "C999")).toBe("a=b")
		expect(nexusChannelKeyword(env, "C111")).toBeUndefined()
		expect(nexusChannelKeyword({}, "C0126BTMW80")).toBeUndefined()
	})

	it("turns cited message numbers into indexes, ignoring junk and duplicates", () => {
		expect(citedMessageIndexes(["3", "[1]", "#3", "https://x.com", "99", "0"], 5)).toEqual([2, 0])
		expect(citedMessageIndexes(["1", "2", "3", "4"], 9)).toEqual([0, 1, 2])
		expect(citedMessageIndexes([], 9)).toEqual([])
	})
})

describe("documentsToRead", () => {
	it("picks Excel, Word, CSV and PDF files from people, within budget", () => {
		const xlsx = { name: "plan.xlsx", size: 100 }
		const pdf = { name: "report", mimetype: "application/pdf", size: 100 }
		const files = [xlsx, { name: "a.png", mimetype: "image/png" }, pdf, { name: "big.docx", size: 20 * 1024 * 1024 }]
		expect(documentsToRead(files, false, 5)).toEqual([xlsx, pdf])
		expect(documentsToRead(files, false, 1)).toEqual([xlsx])
		expect(documentsToRead(files, true, 5)).toEqual([])
	})
})

describe("google links", () => {
	it("finds Docs and Sheets ids once each", () => {
		const text =
			"brief <https://docs.google.com/document/d/12mPCecm8Wt5RSu_6yI3MjxEii4IHS0aJR4Xt1J069tA/edit?tab=t.0|doc> plan https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789/edit#gid=0 again https://docs.google.com/document/d/12mPCecm8Wt5RSu_6yI3MjxEii4IHS0aJR4Xt1J069tA/edit"
		expect(googleFileLinks(text)).toEqual([
			{ id: "12mPCecm8Wt5RSu_6yI3MjxEii4IHS0aJR4Xt1J069tA", kind: "doc" },
			{ id: "1AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789", kind: "sheet" },
		])
	})
	it("digs the download link out of Composio's nested reply", () => {
		const reply = {
			content: [
				{
					type: "text",
					text: JSON.stringify({ data: { results: [{ response: { data: { downloaded_file_content: { s3url: "https://x.r2.dev/f?sig=1" } } } }] } }),
				},
			],
		}
		expect(findS3Url(reply)).toBe("https://x.r2.dev/f?sig=1")
		expect(findS3Url({ content: [{ type: "text", text: "error" }] })).toBeUndefined()
	})
})
