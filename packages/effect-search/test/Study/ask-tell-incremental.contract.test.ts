import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Fiber, Stream } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as Study from "../../src/Study/index.js"
import { projectEvent, singleObjective, singleObjectiveSpace } from "./snapshot/helpers.js"

const tpeOptions = {
  seed: 919,
  nStartupTrials: 2,
  nEiCandidates: 8
}

describe("Study ask/tell incremental contract", () => {
  it.effect("keeps event order, cancellation, and snapshot truth stable across ask/tell progress", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handle = yield* Study.open({
          space: singleObjectiveSpace,
          sampler: Sampler.tpe(tpeOptions),
          direction: "minimize",
          trials: 2,
          objective: singleObjective
        })

        const eventsFiber = yield* Study.events(handle).pipe(Stream.runCollect, Effect.fork)
        yield* Effect.yieldNow()

        const asked = yield* Study.ask(handle)
        const value = yield* singleObjective(asked.config)
        yield* Study.tell(handle, asked.trialNumber, value)

        const snapshotBeforeCancel = yield* Study.snapshot(handle)
        yield* Study.cancel(handle)
        const snapshotAfterCancel = yield* Study.snapshot(handle)
        const events = yield* Fiber.join(eventsFiber)

        expect(snapshotAfterCancel).toEqual(snapshotBeforeCancel)
        expect(Chunk.toReadonlyArray(events).map(projectEvent)).toEqual([
          `start:${asked.trialNumber}`,
          `complete:${asked.trialNumber}:${value}`,
          `best:${asked.trialNumber}:${value}`,
          "completed:interrupted"
        ])
      })
    ))
})
