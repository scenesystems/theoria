import { BunContext } from "@effect/platform-bun"
import { expect, layer } from "@effect/vitest"
import { Effect } from "effect"

import { preloadProgram as preloadDigestProgram } from "../../app/server/demos/digest/run.js"
import { preloadProgram as preloadEffectDspProgram } from "../../app/server/demos/effect-dsp/run.js"
import { preloadProgram as preloadEffectSearchProgram } from "../../app/server/demos/effect-search/preload.js"
import { preloadProgram as preloadEffectTextProgram } from "../../app/server/demos/effect-text/preload.js"

layer(BunContext.layer)("Theoria Demo Program Sources", (it) => {
  it.effect("publishes a virtual workspace for prepared effect-text sources", () =>
    Effect.gen(function*() {
      const program = yield* preloadEffectTextProgram

      expect(program.files.map((file) => file.entry)).toEqual([
        "server/run.ts",
        "contracts/demo/text.ts",
        "web/atoms/animation.ts"
      ])
    }))

  it.effect("keeps related contract and animation files in the prepared workspace", () =>
    Effect.gen(function*() {
      const program = yield* preloadEffectSearchProgram

      expect(program.files.map((file) => file.entry)).toEqual([
        "server/run.ts",
        "contracts/demo/objective.ts",
        "web/atoms/optimization-animation.ts"
      ])
    }))

  it.effect("publishes the DSP contract beside the runnable workspace", () =>
    Effect.gen(function*() {
      const program = yield* preloadEffectDspProgram

      expect(program.files.map((file) => file.entry)).toEqual([
        "server/run.ts",
        "contracts/demo/dsp.ts"
      ])
    }))

  it.effect("strips repository coordinates from single-file demo workspaces", () =>
    Effect.gen(function*() {
      const program = yield* preloadDigestProgram

      expect(program.files.map((file) => file.entry)).toEqual(["server/run.ts"])
    }))
})
