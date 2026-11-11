// 👍/👎 on the bot's answers, and a morning review of what the bot learned overnight.
// Votes and learned memories are kept in the org's Durable Object; the review posts
// both to MEMORY_REVIEW_CHANNEL, where ❌ on a memory's line deletes that memory.
import { decryptToken } from "@/lib/crypto"
import { deleteBrainDocumentByCustomId } from "../memory/cleanup"
import { brainAgent, type CompanyBrainAgent } from "../turn/agent"
import {
	getSlackMessagePermalink,
	lookupSlackUserInfo,
	postSlackEphemeral,
	postSlackMessage,
} from "./client"
import { type SlackTurnMessage, voteFromReaction } from "./events"
import { reviewSummaryText } from "../tools/mcp/shared-access"
import { lookupMessageTraceRecords } from "./message-trace"
import { getOrgActorBySlackIdentity, getWorkspaceByTeamId } from "./workspace"

function ensureTables(agent: CompanyBrainAgent): void {
	agent.sql`
		CREATE TABLE IF NOT EXISTS brain_answer_feedback (
			channel TEXT NOT NULL,
			message_ts TEXT NOT NULL,
			user_id TEXT NOT NULL,
			vote TEXT NOT NULL,
			trace_id TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			PRIMARY KEY (channel, message_ts, user_id)
		)
	`
	agent.sql`
		CREATE TABLE IF NOT EXISTS brain_learned_review (
			custom_id TEXT PRIMARY KEY,
			team_id TEXT NOT NULL,
			channel TEXT NOT NULL,
			title TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			review_ts TEXT
		)
	`
}

/** Called after a learning batch is written. Only team-wide memories are listed for review. */
export function recordLearnedForReview(
	agent: CompanyBrainAgent,
	teamId: string,
	channel: string,
	memories: Array<{ title: string; customId?: string }>,
): void {
	ensureTables(agent)
	const now = Date.now()
	for (const m of memories) {
		if (!m.customId) continue
		agent.sql`
			INSERT OR IGNORE INTO brain_learned_review (custom_id, team_id, channel, title, created_at)
			VALUES (${m.customId}, ${teamId}, ${channel}, ${m.title}, ${now})
		`
	}
}

export async function runSlackFeedbackReaction(
	agent: CompanyBrainAgent,
	msg: SlackTurnMessage,
): Promise<void> {
	const ev = msg.event
	const channel = ev.item?.channel
	const messageTs = ev.item?.ts
	if (!channel || !messageTs || !ev.user) return
	const env = brainAgent(agent).env
	const ws = await getWorkspaceByTeamId(env, msg.teamId)
	if (!ws || ws.orgId !== agent.name) return
	if (ws.botUserId && ev.user === ws.botUserId) return
	ensureTables(agent)

	const vote = voteFromReaction(ev.reaction)
	const trace = vote ? lookupMessageTraceRecords(agent, channel, [messageTs]).get(messageTs) : undefined
	const reviewed = !vote && channel === env.MEMORY_REVIEW_CHANNEL
		? agent.sql<{ custom_id: string; title: string }>`
				SELECT custom_id, title FROM brain_learned_review WHERE review_ts = ${messageTs}
			`[0]
		: undefined
	if (!trace && !reviewed) return // not one of our answers or review lines

	const botToken = await decryptToken(ws.botTokenEnc, env.ENCRYPTION_SECRET)
	const reactor = await lookupSlackUserInfo(botToken, ev.user)
	if (!reactor.ok) return
	const member = await getOrgActorBySlackIdentity(env, {
		orgId: ws.orgId,
		teamId: msg.teamId,
		slackUserId: ev.user,
		email: reactor.user.email,
	})
	if (!member.actor) return

	if (reviewed) {
		const deleted = await deleteBrainDocumentByCustomId({ env, orgId: ws.orgId, customId: reviewed.custom_id })
		console.log(
			`[company-brain] memory-review reject by=${ev.user} custom_id=${reviewed.custom_id} deleted=${deleted}`,
		)
		if (deleted) agent.sql`DELETE FROM brain_learned_review WHERE custom_id = ${reviewed.custom_id}`
		await postSlackEphemeral(
			botToken,
			channel,
			ev.user,
			deleted
				? `ลบความจำ "${reviewed.title}" แล้วครับ`
				: `ลบความจำ "${reviewed.title}" ไม่สำเร็จครับ ลองใหม่อีกครั้งหรือแจ้งทีมดูแลบอท`,
			messageTs,
		)
		return
	}

	if (!trace || !vote) return
	agent.sql`
		INSERT INTO brain_answer_feedback (channel, message_ts, user_id, vote, trace_id, created_at)
		VALUES (${channel}, ${messageTs}, ${ev.user}, ${vote}, ${trace.traceId}, ${Date.now()})
		ON CONFLICT(channel, message_ts, user_id) DO UPDATE SET vote = excluded.vote, created_at = excluded.created_at
	`
	console.log(
		`[company-brain] answer-feedback vote=${vote} channel=${channel} ts=${messageTs} trace=${trace.traceId} by=${ev.user}`,
	)
	if (vote === "down") {
		await postSlackEphemeral(
			botToken,
			channel,
			ev.user,
			"ขอบคุณที่บอกครับ ช่วยพิมพ์ในเธรดนี้หน่อยว่าผิดหรือขาดตรงไหน (แท็ก @Company Brain ด้วย) เดี๋ยวแก้ให้ และจะจำไว้ไม่ให้พลาดซ้ำครับ",
			trace.threadTs ?? messageTs,
		)
	}
}

export async function runMemoryReview(agent: CompanyBrainAgent): Promise<void> {
	const env = brainAgent(agent).env
	const target = env.MEMORY_REVIEW_CHANNEL
	if (!target) return
	ensureTables(agent)
	const learned = agent.sql<{ custom_id: string; team_id: string; channel: string; title: string }>`
		SELECT custom_id, team_id, channel, title FROM brain_learned_review
		WHERE review_ts IS NULL ORDER BY channel, created_at
	`
	const since = Date.now() - 24 * 60 * 60 * 1000
	const votes = agent.sql<{ channel: string; message_ts: string; vote: string }>`
		SELECT channel, message_ts, vote FROM brain_answer_feedback WHERE created_at >= ${since}
	`
	const teamId =
		learned[0]?.team_id ??
		agent.sql<{ team_id: string }>`SELECT team_id FROM brain_learned_review LIMIT 1`[0]?.team_id
	if (!teamId) return
	const ws = await getWorkspaceByTeamId(env, teamId)
	if (!ws || ws.orgId !== agent.name) return
	const botToken = await decryptToken(ws.botTokenEnc, env.ENCRYPTION_SECRET)

	const downs = votes.filter((v) => v.vote === "down").slice(0, 10)
	const downLinks = (
		await Promise.all(downs.map((v) => getSlackMessagePermalink(botToken, v.channel, v.message_ts)))
	).filter((l): l is string => Boolean(l))
	const text = reviewSummaryText({
		learned,
		up: votes.filter((v) => v.vote === "up").length,
		down: votes.filter((v) => v.vote === "down").length,
		downLinks,
	})
	const parentTs = await postSlackMessage(botToken, target, text)
	if (!parentTs) {
		console.error("[company-brain] memory-review post failed")
		return
	}
	// One reply per memory so ❌ can target it. Slack allows about one post per second.
	for (const m of learned) {
		const ts = await postSlackMessage(botToken, target, `<#${m.channel}> · ${m.title}`, parentTs)
		if (ts) agent.sql`UPDATE brain_learned_review SET review_ts = ${ts} WHERE custom_id = ${m.custom_id}`
		await new Promise((r) => setTimeout(r, 1100))
	}
	// Reviewed rows stay for a week so a late ❌ still works.
	agent.sql`DELETE FROM brain_learned_review WHERE review_ts IS NOT NULL AND created_at < ${Date.now() - 7 * 24 * 60 * 60 * 1000}`
	console.log(`[company-brain] memory-review posted memories=${learned.length} votes=${votes.length}`)
}

/** Keep exactly one daily review schedule (08:30 Bangkok, after the 02:00 learning run). */
export async function ensureMemoryReviewSchedule(agent: CompanyBrainAgent): Promise<void> {
	const existing = agent.getSchedules().filter((s) => s.callback === "runMemoryReview")
	if (!brainAgent(agent).env.MEMORY_REVIEW_CHANNEL) {
		await Promise.all(existing.map((s) => agent.cancelSchedule(s.id)))
		return
	}
	if (!existing.some((s) => s.type === "cron")) await agent.schedule("30 1 * * *", "runMemoryReview")
}
