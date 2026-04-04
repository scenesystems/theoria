import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"

import * as Browser from "../../src/Browser/index.js"
import { browserParityCasesForProfile, browserParityLayer } from "../../src/Browser/index.js"
import { Text } from "../../src/index.js"
import { preparedTextWithSegmentsCore } from "../../src/Text/model.js"

const fitPaintCase = (profile: Browser.BrowserSupportProfileType) =>
  Arr.findFirst(browserParityCasesForProfile(profile), (entry) => entry.caseId === "fit-paint-divergence")

describe("Text browser fit-paint kernel contracts", () => {
  it.effect("keeps fit and paint runtime tables distinct when browser measurement diverges", () =>
    Effect.gen(function*() {
      const profile = Browser.browserSupportProfile("canvas-monospace")
      const entry = yield* Option.match(fitPaintCase(profile), {
        onNone: () => Effect.dieMessage("Missing fit-paint browser accuracy case"),
        onSome: Effect.succeed
      })
      const prepared = yield* Text.prepareWithSegments(entry.prepare).pipe(
        Effect.provide(browserParityLayer(profile))
      )
      const core = preparedTextWithSegmentsCore(prepared)

      expect(core.kernel.runtime.fitAdvances[0]).toBe(24)
      expect(core.kernel.runtime.paintAdvances[0]).toBe(30)
      expect(core.kernel.runtime.breakablePrefixWidths[0]).toEqual([10, 18, 24])
      expect(core.kernel.runtime.breakableGraphemeWidths[0]).toEqual([10, 10, 10])
      expect(Text.layout(prepared, entry.request)).toEqual({
        lineCount: 1,
        height: 12,
        maxLineWidth: 30
      })
      expect(Text.layoutLines(prepared, entry.request)).toEqual([
        {
          baseDirection: "ltr",
          index: 0,
          order: "visual",
          text: "ffi",
          width: 30
        }
      ])
    }))
})
