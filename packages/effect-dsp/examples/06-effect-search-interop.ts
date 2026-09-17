/**
 * Uses effect-search directly for ask/tell orchestration, acquisition selection,
 * streamed progress, and Pareto-front inspection.
 *
 * Run: bun run examples/06-effect-search-interop.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import * as Direction from "@scenesystems/effect-search/Direction"
import * as Optimization from "@scenesystems/effect-search/Optimization"
import * as Pareto from "@scenesystems/effect-search/Pareto"
import * as Progress from "@scenesystems/effect-search/Progress"
import * as Sampler from "@scenesystems/effect-search/Sampler"
import * as SearchSpace from "@scenesystems/effect-search/SearchSpace"
import { Array as Arr, Effect, Fiber, Match, Number as Num, Ref, Schema, Stream } from "effect"

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

    const sampler = Sampler.tpe({
      seed: 345,
      acquisition: "thompson"
    })

    const handle = yield* Optimization.open({
      direction: "maximize",
      space,
      sampler,
      trials: 2,
      objective,
      concurrency: 1
    })

    const progressLinesRef = yield* Ref.make(Arr.empty<string>())
    const progressFiber = yield* Optimization.events(handle).pipe(
      Stream.tap((event) =>
        Effect.forEach(Progress.format(event), (line) => Ref.update(progressLinesRef, Arr.append(line.text)), {
          discard: true
        })
      ),
      Stream.runCollect,
      Effect.fork
    )

    const askAndTellInteropTrial = Effect.fn("askAndTellInteropTrial")(function*() {
      const asked = yield* Optimization.ask(handle)
      yield* Optimization.tell(
        handle,
        asked.trialNumber,
        Num.multiply(asked.config.x, asked.config.y)
      )

      return Arr.make(asked.config.x, asked.config.y)
    })

    const firstObjectiveVector = yield* askAndTellInteropTrial()
    const secondObjectiveVector = yield* askAndTellInteropTrial()

    const studyResult = yield* Optimization.result(handle)

    const progressEvents = yield* Fiber.join(progressFiber)
    const progressLines = yield* Ref.get(progressLinesRef)

    const paretoIndices = Pareto.nonDominatedIndices(
      Arr.make(firstObjectiveVector, secondObjectiveVector),
      maximizeDirections
    )

    yield* Match.value(studyResult).pipe(
      Match.tagsExhaustive({
        SingleObjective: ({ trials }) =>
          Effect.log("effect-search summary", { trialCount: Arr.length(Arr.fromIterable(trials)) }),
        MultiObjective: ({ trials }) =>
          Effect.log("effect-search summary", { trialCount: Arr.length(Arr.fromIterable(trials)) })
      }),
      Effect.annotateLogs({
        paretoIndices,
        progressEventCount: Arr.length(Arr.fromIterable(progressEvents)),
        progressLineCount: Arr.length(progressLines)
      })
    )
  })
)

BunRuntime.runMain(program)
