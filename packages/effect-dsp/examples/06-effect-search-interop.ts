/**
 * Uses the effect-dsp interop namespace for ask/tell orchestration, acquisition
 * selection, streamed progress, and Pareto-front inspection.
 *
 * Run: bun run examples/06-effect-search-interop.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import * as Direction from "@scenesystems/effect-search/Direction"
import * as SearchSpace from "@scenesystems/effect-search/SearchSpace"
import { Array as Arr, Chunk, Effect, Fiber, Number as Num, Ref, Schema, Stream } from "effect"

import { Optimizer } from "@scenesystems/effect-dsp"

const maximizeDirections = Schema.decodeUnknownSync(Schema.Array(Direction.Direction))(Arr.make("maximize", "maximize"))

const program = Effect.scoped(
  Effect.gen(function*() {
    const space = yield* SearchSpace.make({
      x: SearchSpace.float(Num.negate(2), 2),
      y: SearchSpace.float(Num.negate(2), 2)
    })

    const objective = (config: SearchSpace.Type<typeof space>) =>
      Effect.succeed(
        Num.negate(
          Num.sum(Num.multiply(config.x, config.x), Num.multiply(config.y, config.y))
        )
      )

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
        Num.multiply(asked.config.x, asked.config.y)
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
      progressEventCount: Arr.length(progressEvents),
      progressLineCount: Arr.length(progressLines)
    })
  })
)

BunRuntime.runMain(program)
