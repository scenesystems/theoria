import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { preloadProgram as preloadDigestProgram } from "../../app/server/demos/digest/run.js"
import { preloadProgram as preloadEffectSearchProgram } from "../../app/server/demos/effect-search/preload.js"
import { preloadProgram as preloadEffectTextProgram } from "../../app/server/demos/effect-text/preload.js"

describe("Theoria Demo Program Sources", () => {
  it.effect("publishes a virtual workspace for prepared effect-text sources", () =>
    Effect.gen(function*() {
      const program = yield* preloadEffectTextProgram

      expect(program.files.map((file) => file.entry)).toEqual([
        "server/run.ts",
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

  it.effect("strips repository coordinates from single-file demo workspaces", () =>
    Effect.gen(function*() {
      const program = yield* preloadDigestProgram

      expect(program.files.map((file) => file.entry)).toEqual(["server/run.ts"])
    }))
})
