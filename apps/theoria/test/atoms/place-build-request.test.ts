import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import type { Scope } from "effect"
import { Duration, Effect, Option } from "effect"

import { placeScenarioMeta } from "../../app/contracts/imagined-place.js"
import {
  briefSettleDelay,
  chooseScenarioAtom,
  placeBriefAtom,
  placeBriefDraftAtom,
  placeBriefEditedAtom,
  placeBuildRequestAtom,
  placeControlsAtom
} from "../../app/web/atoms/imagined-place.js"

/**
 * What is built follows the controls at once — a story or a merge chosen is
 * a decision, not a keystroke — and follows the brief only once typing has
 * settled. The brief is typed under one story: a story chosen while a brief
 * is settling can never be built with the other story's words.
 */

const unfinished = placeScenarioMeta["unfinished-light"].brief
const lost = placeScenarioMeta["lost-market"].brief

/** A registry whose tasks run at once, holding the request mounted so its debounce is live. */
const mounted = Effect.acquireRelease(
  Effect.sync(() => {
    const registry = Registry.make({
      scheduleTask: (task) => {
        task()
      }
    })
    const unmount = registry.mount(placeBuildRequestAtom)
    return { registry, unmount }
  }),
  ({ unmount }) => Effect.sync(unmount)
)

/** Real time passes for the settle — the debounce is the page's own timer — so these run on the live clock. */
const settled = Effect.sleep(Duration.sum(briefSettleDelay, Duration.millis(50)))

/** A test on the live clock, with a scope for the mounted registry. */
const live = (name: string, body: Effect.Effect<void, never, Scope.Scope>) => it.live(name, () => Effect.scoped(body))

describe("the place's build request", () => {
  live(
    "a story chosen is built at once, with that story's own brief",
    Effect.gen(function*() {
      const { registry } = yield* mounted
      expect(registry.get(placeBuildRequestAtom).brief).toBe(unfinished)
      registry.set(chooseScenarioAtom, "lost-market")
      const request = registry.get(placeBuildRequestAtom)
      expect(request.scenario).toBe("lost-market")
      expect(request.brief).toBe(lost)
      expect(registry.get(placeBriefAtom)).toBe(lost)
      expect(registry.get(placeBriefEditedAtom)).toBe(false)
    })
  )

  live(
    "a merge chosen is built at once",
    Effect.gen(function*() {
      const { registry } = yield* mounted
      registry.set(placeControlsAtom, { ...registry.get(placeControlsAtom), acceptProgram: true })
      expect(registry.get(placeBuildRequestAtom).acceptProgram).toBe(true)
    })
  )

  live(
    "a brief typed shows at once, is edited at once, and is built only once typing has settled",
    Effect.gen(function*() {
      const { registry } = yield* mounted
      registry.set(placeBriefDraftAtom, Option.some({ scenario: "unfinished-light", text: "A lighthouse" }))
      expect(registry.get(placeBriefAtom)).toBe("A lighthouse")
      expect(registry.get(placeBriefEditedAtom)).toBe(true)
      expect(registry.get(placeBuildRequestAtom).brief).toBe(unfinished)
      yield* settled
      expect(registry.get(placeBuildRequestAtom).brief).toBe("A lighthouse")
    })
  )

  live(
    "a story chosen while a brief is settling is never built with the other story's words",
    Effect.gen(function*() {
      const { registry } = yield* mounted
      registry.set(placeBriefDraftAtom, Option.some({ scenario: "unfinished-light", text: "A lighthouse" }))
      registry.set(chooseScenarioAtom, "lost-market")
      expect(registry.get(placeBuildRequestAtom)).toMatchObject({ scenario: "lost-market", brief: lost })
      expect(registry.get(placeBriefAtom)).toBe(lost)
      yield* settled
      expect(registry.get(placeBuildRequestAtom)).toMatchObject({ scenario: "lost-market", brief: lost })
    })
  )

  live(
    "a settled brief that changed nothing is the same request, so nothing is built again",
    Effect.gen(function*() {
      const { registry } = yield* mounted
      const before = registry.get(placeBuildRequestAtom)
      registry.set(placeBriefDraftAtom, Option.some({ scenario: "unfinished-light", text: "A lighthouse" }))
      registry.set(placeBriefDraftAtom, Option.some({ scenario: "unfinished-light", text: unfinished }))
      yield* settled
      expect(registry.get(placeBuildRequestAtom)).toBe(before)
    })
  )
})
