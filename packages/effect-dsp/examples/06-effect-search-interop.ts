/**
 * Uses effect-search directly for ask/tell orchestration, acquisition selection,
 * streamed progress, and Pareto-front inspection.
 *
 * Run: bun run examples/06-effect-search-interop.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Pareto, Sampler, SearchSpace, Study } from "@scenesystems/effect-search"
import type { Contracts } from "@scenesystems/effect-search"
import { Array as Arr, Chunk, Effect, Fiber, Match, Number, Ref, Stream } from "effect"

const maximize: Contracts.Direction = "maximize"
const maximizeDirections = Arr.make(maximize, maximize)

const program = Effect.scoped(
  Effect.gen(function*() {
    const space = yield* SearchSpace.make({
      x: SearchSpace.float(-2, 2),
      y: SearchSpace.float(-2, 2)
    })

    const objective = (config: SearchSpace.Type<typeof space>) =>
      Effect.succeed(
        Number.multiply(
          -1,
          Number.sum(Number.multiply(config.x, config.x), Number.multiply(config.y, config.y))
        )
      )

    const sampler = Sampler.tpe({
      seed: 345,
      acquisition: "thompson"
    })

    const handle = yield* Study.open({
      direction: "maximize",
      space,
      sampler,
      trials: 2,
      objective,
      concurrency: 1
    })

    const progressLinesRef = yield* Ref.make(Arr.empty<string>())
    const progressFiber = yield* Study.events(handle).pipe(
      Stream.tap((event) =>
        Effect.forEach(
          Study.formatTerminalProgressEvent(event, { renderMode: "plain" }),
          (line) => Ref.update(progressLinesRef, (lines) => Arr.append(lines, line.text)),
          { discard: true }
        )
      ),
      Stream.runCollect,
      Effect.map(Chunk.toReadonlyArray),
      Effect.fork
    )

    const askAndTellInteropTrial = Effect.fn("askAndTellInteropTrial")(function*() {
      const asked = yield* Study.ask(handle)
      yield* Study.tell(
        handle,
        asked.trialNumber,
        Number.multiply(asked.config.x, asked.config.y)
      )

      return Arr.make(asked.config.x, asked.config.y)
    })

    const firstObjectiveVector = yield* askAndTellInteropTrial()
    const secondObjectiveVector = yield* askAndTellInteropTrial()

    const studyResult = yield* Study.result(handle)

    const progressEvents = yield* Fiber.join(progressFiber)
    const progressLines = yield* Ref.get(progressLinesRef)

    const paretoIndices = Pareto.nonDominatedIndices(
      Arr.make(firstObjectiveVector, secondObjectiveVector),
      maximizeDirections
    )

    yield* Match.value(studyResult).pipe(
      Match.tag("SingleObjective", ({ trials }) =>
        Effect.log("effect-search summary", {
          kind: "SingleObjective",
          trialCount: Arr.length(trials),
          paretoCount: 1,
          paretoIndices,
          progressEventCount: Arr.length(progressEvents),
          progressLineCount: Arr.length(progressLines)
        })),
      Match.tag("MultiObjective", ({ paretoFront, trials }) =>
        Effect.log("effect-search summary", {
          kind: "MultiObjective",
          trialCount: Arr.length(trials),
          paretoCount: Arr.length(paretoFront),
          paretoIndices,
          progressEventCount: Arr.length(progressEvents),
          progressLineCount: Arr.length(progressLines)
        })),
      Match.exhaustive
    )
  })
)

BunRuntime.runMain(program)
