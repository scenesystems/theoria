import { HttpServerResponse } from "@effect/platform"
import { Clock, Effect, Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import { Capabilities } from "../../contracts/capabilities.js"
import { type Card, cardsForReleaseStage } from "../../contracts/card.js"
import type { ReleaseStage } from "../../contracts/release-stage.js"
import { serverReleaseStage } from "../config/release-stage.js"
import { RuntimeInfo } from "../config/runtime.js"
import { DspProviderRuntime } from "../demos/effect-dsp/provider.js"

const jsonResponse = (body: unknown) =>
  HttpServerResponse.json(body, {
    status: 200,
    headers: {
      "cache-control": "no-store"
    }
  })

const nonDspCapabilities = (stage: ReleaseStage) =>
  Arr.filter(cardsForReleaseStage(stage), (card) => card.id !== "effect-dsp")

const dspDemoCapability = (
  runtime: {
    readonly capability: {
      readonly enabled: boolean
      readonly reason: Option.Option<string>
    }
  }
) => ({
  id: "effect-dsp",
  enabled: runtime.capability.enabled,
  ...Option.match(runtime.capability.reason, {
    onNone: () => ({}),
    onSome: (reason) => ({ reason })
  })
})

const dspProviderFields = (
  runtime: {
    readonly capability: {
      readonly provider: Option.Option<"openai" | "anthropic" | "openrouter">
      readonly model: Option.Option<string>
    }
  }
) => ({
  ...Option.match(runtime.capability.provider, {
    onNone: () => ({}),
    onSome: (provider) => ({ provider })
  }),
  ...Option.match(runtime.capability.model, {
    onNone: () => ({}),
    onSome: (model) => ({ model })
  })
})

const capabilityEntry = (id: Card["id"]) =>
  Match.value(id).pipe(
    Match.when("effect-dsp", () => ({
      id: "effect-dsp",
      enabled: false,
      reason: "Managed by provider capability state."
    })),
    Match.orElse((demoId) => ({
      id: demoId,
      enabled: true
    }))
  )

export const capabilitiesRoute = (requestId: string) =>
  Effect.gen(function*() {
    const startedAtMs = yield* Clock.currentTimeMillis
    const releaseStage = yield* serverReleaseStage
    const runtimeInfo = yield* RuntimeInfo
    const dspRuntime = yield* DspProviderRuntime
    const endedAtMs = yield* Clock.currentTimeMillis

    const data = yield* Schema.decodeUnknown(Capabilities)({
      demos: [
        ...Arr.map(nonDspCapabilities(releaseStage), (card) => capabilityEntry(card.id)),
        dspDemoCapability(dspRuntime)
      ],
      dsp: dspProviderFields(dspRuntime)
    })

    return jsonResponse({
      ok: true,
      meta: {
        requestId,
        buildSha: runtimeInfo.buildSha,
        durationMs: endedAtMs - startedAtMs
      },
      data
    })
  })
