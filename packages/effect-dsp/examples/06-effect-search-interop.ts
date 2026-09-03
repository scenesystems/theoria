/**
 * Uses the effect-dsp interop namespace for ask/tell orchestration, acquisition
 * selection, streamed progress, and Pareto-front inspection.
 *
 * Run: bun run examples/06-effect-search-interop.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { SearchSpace } from "@scenesystems/effect-search"
import { Array as Arr, Chunk, Effect, Fiber, Ref, Stream } from "effect"

import { Optimizer } from "@scenesystems/effect-dsp"

const maximizeDirections: ReadonlyArray<"maximize" | "minimize"> = ["maximize", "maximize"]

const program = Effect.scoped(
  Effect.gen(function*() {
    const space = yield* SearchSpace.make({
      x: SearchSpace.float(-2, 2),
      y: SearchSpace.float(-2, 2)
    })

    const objective = (config: SearchSpace.Type<typeof space>) =>
      Effect.succeed(-(config.x * config.x + config.y * config.y))

    const sampler = Optimizer.effectSearchInterop.makeTpeSampler({
      seed: 345,
      acquisition: "thompson"
    })

    const handle = yield* Optimizer.effectSearchInterop.open({
      direction: "maximize",
      space,
      sampler,
      trials: 2,
      objective,
      concurrency: 1
    })

    const progressLinesRef = yield* Ref.make(Arr.empty<string>())
    const progressFiber = yield* Optimizer.effectSearchInterop.eventsWithProgress(
      handle,
      (line) => Ref.update(progressLinesRef, (lines) => Arr.append(lines, line.text)),
      { renderMode: "plain" }
    ).pipe(Stream.runCollect, Effect.map(Chunk.toReadonlyArray), Effect.fork)

    const askAndTellInteropTrial = Effect.fn("askAndTellInteropTrial")(function*() {
      const asked = yield* Optimizer.effectSearchInterop.ask(handle)
      yield* Optimizer.effectSearchInterop.tell(
        handle,
        asked.trialNumber,
        asked.config.x * asked.config.y
      )

      return Arr.make(asked.config.x, asked.config.y)
    })

    const firstObjectiveVector = yield* askAndTellInteropTrial()
    const secondObjectiveVector = yield* askAndTellInteropTrial()

    const studyResult = yield* Optimizer.effectSearchInterop.result(handle)
    const summary = Optimizer.effectSearchInterop.resultSummary(studyResult)

    const progressEvents = yield* Fiber.join(progressFiber)
    const progressLines = yield* Ref.get(progressLinesRef)

    const paretoIndices = Optimizer.effectSearchInterop.pareto.nonDominatedIndices(
      Arr.make(firstObjectiveVector, secondObjectiveVector),
      maximizeDirections
    )

    yield* Effect.log("effect-search interop summary", {
      kind: summary.kind,
      trialCount: summary.trialCount,
      paretoCount: summary.paretoCount,
      paretoIndices,
      progressEventCount: progressEvents.length,
      progressLineCount: progressLines.length
    })
  })
)

BunRuntime.runMain(program)
