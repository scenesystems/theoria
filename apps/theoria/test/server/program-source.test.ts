import { BunContext } from "@effect/platform-bun"
import { expect, layer } from "@effect/vitest"
import { Effect } from "effect"

import { preloadProgram as preloadDigestProgram } from "../../app/server/adapters/digest/run.js"
import { preloadProgram as preloadEffectDspProgram } from "../../app/server/adapters/effect-dsp/run.js"
import { preloadProgram as preloadEffectSearchProgram } from "../../app/server/adapters/effect-search/preload.js"
import { preloadProgram as preloadEffectTextProgram } from "../../app/server/adapters/effect-text/preload.js"

layer(BunContext.layer)("Theoria Entry Program Sources", (it) => {
  it.effect("publishes a virtual workspace for prepared effect-text sources", () =>
    Effect.gen(function*() {
      const program = yield* preloadEffectTextProgram

      expect(program.files.map((file) => file.entry)).toEqual([
        "server/adapters/effect-text/run.ts",
        "server/adapters/effect-text/package-story.ts",
        "web/text/browserTextLayout.ts",
        "web/view/text/authority.ts",
        "web/atoms/text.ts",
        "web/atoms/reflow.ts"
      ])
    }))

  it.effect("keeps related contract and animation files in the prepared workspace", () =>
    Effect.gen(function*() {
      const program = yield* preloadEffectSearchProgram

      expect(program.files.map((file) => file.entry)).toEqual([
        "server/adapters/effect-search/run.ts",
        "contracts/capability/effect-search.ts",
        "web/atoms/run/optimization-animation.ts"
      ])
    }))

  it.effect("publishes the DSP contract beside the runnable workspace", () =>
    Effect.gen(function*() {
      const program = yield* preloadEffectDspProgram

      expect(program.files.map((file) => file.entry)).toEqual([
        "server/adapters/effect-dsp/run.ts",
        "contracts/capability/effect-dsp.ts"
      ])
    }))

  it.effect("strips repository coordinates from single-file entry workspaces", () =>
    Effect.gen(function*() {
      const program = yield* preloadDigestProgram

      expect(program.files.map((file) => file.entry)).toEqual(["server/adapters/digest/run.ts"])
    }))
})
