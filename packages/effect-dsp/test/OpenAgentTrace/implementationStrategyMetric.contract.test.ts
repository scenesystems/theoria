/**
 * Contract for the package-owned implementation-strategy rubric metric.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Experimental from "effect-dsp/experimental"

const ImplementationStrategy = Experimental.OpenAgentTrace.ImplementationStrategy

const canonicalStrategy =
  "Keep the declared generic as source of truth, derive exact products before runtime views, split noun and mechanism authority at the real seam, and avoid widening, helper indirection, sidecar witnesses, overload detours, or downstream detours."

const forbiddenStrategy =
  "Introduce helper aliases, add a witness type, broaden declarations into shared record families, add overload dispatch, and use an intermediate runtime product before restoring the public surface."

describe("OpenAgentTrace/implementationStrategyRubricMetric", () => {
  it.effect("preserves required-signal scoring, forbidden penalties, and explanatory feedback", () =>
    Effect.gen(function*() {
      const strong = yield* ImplementationStrategy.rubricMetric.score(
        { strategy: canonicalStrategy },
        { strategy: canonicalStrategy }
      )
      const weak = yield* ImplementationStrategy.rubricMetric.score(
        { strategy: forbiddenStrategy },
        { strategy: canonicalStrategy }
      )

      expect(strong.score).toBe(1)
      expect(strong.feedback).toContain("Target strategy")
      expect(weak.score).toBeLessThan(strong.score)
      expect(weak.feedback).toContain("Missing:")
      expect(weak.feedback).toContain("Forbidden moves:")
      expect(weak.feedback).toContain("helper alias plan")
    }))
})
