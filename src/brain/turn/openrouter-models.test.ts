import { afterEach, describe, expect, it, vi } from "vitest"
import { getModelInfo, isOpenRouterModelId } from "@/lib/model-registry"
import { listOpenRouterToolModels } from "./brain-model"
import {
	createModelProfile,
	resolveBrainMainModel,
	resolveBrainTriageModel,
} from "./model-profile"

const env = { OPENROUTER_API_KEY: "sk-or-test" } as unknown as Env
const reply = (status: number, data: unknown[] = []) =>
	new Response(JSON.stringify({ data }), { status })
const withTools = (id: string) => ({ id, supported_parameters: ["tools"] })

afterEach(() => vi.unstubAllGlobals())

describe("OpenRouter model selection", () => {
	it("keeps a picked OpenRouter model and rejects anything else", () => {
		const pick = (model: string) => ({
			brainModels: { main: model, triage: model },
		})
		expect(resolveBrainMainModel(pick("anthropic/claude-opus-5.5"))).toBe(
			"anthropic/claude-opus-5.5",
		)
		expect(resolveBrainTriageModel(pick("anthropic/claude-haiku-5.5"))).toBe(
			"anthropic/claude-haiku-5.5",
		)
		expect(resolveBrainMainModel(pick("not a model"))).toBe("grok-4.5")
		expect(isOpenRouterModelId("../../etc/passwd")).toBe(false)
	})

	it("maps vendors and sends no provider options for picked models", () => {
		expect(getModelInfo("anthropic/claude-opus-5.5").provider).toBe("anthropic")
		expect(getModelInfo("deepseek/deepseek-v4").provider).toBe("openai")
		expect(
			createModelProfile("anthropic/claude-opus-5.5", "high").providerOptions(
				"high",
			),
		).toEqual({})
	})

	it("lists only tool-capable models and drops batch variants", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				reply(200, [
					withTools("anthropic/claude-opus-5.5"),
					withTools("anthropic/claude-opus-5.5:batch"),
					{ id: "vendor/no-tools", supported_parameters: [] },
				]),
			),
		)
		expect(await listOpenRouterToolModels(env)).toEqual([
			"anthropic/claude-opus-5.5",
		])
	})

	it("falls back to the full list when the filtered one is refused", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(reply(403))
			.mockResolvedValueOnce(reply(200, [withTools("openai/gpt-5.6")]))
		vi.stubGlobal("fetch", fetchMock)
		expect(await listOpenRouterToolModels(env)).toEqual(["openai/gpt-5.6"])
		expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
			"https://openrouter.ai/api/v1/models/user",
			"https://openrouter.ai/api/v1/models",
		])
	})

	it("returns nothing without a key or when OpenRouter is down", async () => {
		expect(await listOpenRouterToolModels({} as Env)).toEqual([])
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")))
		expect(await listOpenRouterToolModels(env)).toEqual([])
	})
})
