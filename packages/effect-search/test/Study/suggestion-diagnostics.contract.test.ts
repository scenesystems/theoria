import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Fiber, Match, Option, Stream } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"
import * as StudyEvent from "../../src/StudyEvent/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-1, 1),
    depth: SearchSpace.int(1, 3)
  })

describe("Study suggestion diagnostics", () => {
  it.effect("emits typed prepared-suggestion diagnostics when TPE reuses prepared state after startup", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handle = yield* Study.open({
          space: makeSpace(),
          sampler: Sampler.tpe({ seed: 714, nStartupTrials: 2, nEiCandidates: 8 }),
          direction: "minimize",
          trials: 4,
          objective: () => Effect.succeed(0)
        })

        const eventsFiber = yield* Study.events(handle).pipe(Stream.runCollect, Effect.fork)
        yield* Effect.yieldNow()

        const first = yield* Study.ask(handle)
        yield* Study.tell(handle, first.trialNumber, 0.5)

        const second = yield* Study.ask(handle)
        yield* Study.tell(handle, second.trialNumber, 0.25)

        yield* Study.ask(handle)
        yield* Study.cancel(handle)

        const events = Chunk.toReadonlyArray(yield* Fiber.join(eventsFiber))
        const preparedEvent = [...events].reverse().find(
          (event) =>
            Match.value(event).pipe(
              Match.tag(
                "TrialStarted",
                ({ diagnostics }) => diagnostics?.preparedStateKind === "effect-search/tpe/model-context"
              ),
              Match.orElse(() => false)
            )
        )

        const diagnosticsOption = Option.fromNullable(preparedEvent).pipe(
          Option.flatMap((event) =>
            Match.value(event).pipe(
              Match.tag("TrialStarted", ({ diagnostics }) => Option.fromNullable(diagnostics)),
              Match.orElse(() => Option.none())
            )
          )
        )

        expect(Option.isSome(diagnosticsOption)).toBe(true)

        if (Option.isNone(diagnosticsOption)) {
          return
        }

        expect(StudyEvent.isStudyEvent(preparedEvent)).toBe(true)
        expect(diagnosticsOption.value.samplerKind).toBe("Tpe")
        expect(diagnosticsOption.value.reusedPreparedState).toBe(true)
        expect(diagnosticsOption.value.completedCount).toBe(2)
        expect(diagnosticsOption.value.pendingCount).toBe(0)
        expect(diagnosticsOption.value.belowCount).toBeGreaterThan(0)
        expect(diagnosticsOption.value.aboveCount).toBeGreaterThan(0)
      })
    ))
})
