import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { layoutRequestFor } from "../../app/contracts/presentation/text.js"
import { projectText } from "../../app/web/view/text/authority.js"

describe("Theoria Text Authority", () => {
  it.effect("derives compact layout projections from contract semantics", () =>
    Effect.gen(function*() {
      const projection = yield* projectText({
        role: "status",
        variant: "compact",
        text: "Preload-before-run orchestration keeps runtime updates deterministic."
      })

      expect(projection.layout).toEqual(layoutRequestFor("status", "compact"))
      expect(projection.lines.length).toBeGreaterThan(0)
      expect(projection.summary.lineCount).toBe(projection.lines.length)
    }))

  it.effect("uses wider expanded semantics for the same text role", () =>
    Effect.gen(function*() {
      const text = "Expanded surfaces must preserve semantic text layout while deep-diving live evidence."

      const compactProjection = yield* projectText({
        role: "card-summary",
        variant: "compact",
        text
      })

      const expandedProjection = yield* projectText({
        role: "card-summary",
        variant: "expanded",
        text
      })

      expect(expandedProjection.layout.maxWidth).toBeGreaterThan(compactProjection.layout.maxWidth)
    }))
})
