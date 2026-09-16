import { expect, it } from "@effect/vitest"
import * as History from "@scenesystems/effect-study/History"
import { Array as Arr, Deferred, Effect, Either, Fiber, Tuple } from "effect"

import { initializeRuntime, modifyStudyState, readStudyState } from "../../src/internal/study/runtime/runtimeState.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"
import * as Study from "../../src/Study.js"
import * as Trial from "../../src/Trial.js"
import { makeStudyMachineSettings } from "../helpers/studyMachineSettings.js"

it.scoped("does not publish interrupted mutations and permits the next reservation", () =>
  Effect.gen(function*() {
    const runtime = yield* initializeRuntime(yield* makeStudyMachineSettings())
    const entered = yield* Deferred.make<void>()
    const blocked = yield* modifyStudyState(runtime, (state) =>
      Deferred.succeed(entered, undefined).pipe(
        Effect.zipRight(Effect.never),
        Effect.as(Tuple.make(undefined, History.set(state, Trial.makeRunning(0, { x: 1, depth: 1 }, 0))))
      )).pipe(Effect.forkScoped)
    yield* Deferred.await(entered)
    yield* Fiber.interrupt(blocked)
    yield* modifyStudyState(runtime, (state) =>
      Effect.succeed(Tuple.make(undefined, History.set(state, Trial.makeRunning(1, { x: 2, depth: 1 }, 0)))))
    const records = History.values(yield* readStudyState(runtime))
    expect(records).toEqual(Arr.of(Trial.makeRunning(1, { x: 2, depth: 1 }, 0)))
  }))

it.effect("rejects reservations after the manual handle's scope closes", () =>
  Effect.gen(function*() {
    const space = yield* SearchSpace.make({ x: SearchSpace.float(0, 1) })
    const handle = yield* Study.open({
      space,
      sampler: Sampler.random({ seed: 5 }),
      direction: "minimize",
      trials: 2,
      objective: () => Effect.succeed(0)
    }).pipe(Effect.scoped)

    const outcome = yield* Study.ask(handle).pipe(Effect.either)
    const error = yield* Either.getLeft(outcome)
    expect(error._tag).toBe("effect-search/InvalidStudyConfig")
  }))
