/**
 * Example contract: storage-backed study resume behavior while the objective
 * evaluates an effect-dsp module with a mock LanguageModel.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { FileSystem } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import * as Evaluate from "@scenesystems/effect-dsp/Evaluate"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as ObjectiveCache from "@scenesystems/effect-search/ObjectiveCache"
import * as Optimization from "@scenesystems/effect-search/Optimization"
import * as OptimizationStorage from "@scenesystems/effect-search/OptimizationStorage"
import * as Progress from "@scenesystems/effect-search/Progress"
import * as Sampler from "@scenesystems/effect-search/Sampler"
import * as SearchSpace from "@scenesystems/effect-search/SearchSpace"
import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"
import { Array as Arr, Chunk, Effect, Layer, Match, Option, Ref, Schema, Stream, String as Str } from "effect"

const makeSpace = SearchSpace.make({
  instructionIndex: SearchSpace.int(0, 2),
  demoIndex: SearchSpace.int(0, 2)
})

const italyEvalset = Arr.make(
  new Example({
    input: { question: "What is the capital of Italy?" },
    output: { answer: "Rome" }
  })
)

const franceDemo = new Demonstration({
  input: { question: "What is the capital of France?" },
  output: { answer: "Paris" }
})

const japanDemo = new Demonstration({
  input: { question: "What is the capital of Japan?" },
  output: { answer: "Tokyo" }
})

const instructionCandidate = (index: number): string =>
  Match.value(index).pipe(
    Match.when(0, () => "Answer geography questions with concise city names"),
    Match.when(1, () => "Answer with canonical capital city names only"),
    Match.orElse(() => "Use provided demonstrations to infer the correct city")
  )

const demoCandidate = (index: number) =>
  Match.value(index).pipe(
    Match.when(0, () => Arr.empty()),
    Match.when(1, () => Arr.make(franceDemo)),
    Match.orElse(() => Arr.make(franceDemo, japanDemo))
  )

const responseForPrompt = (prompt: string) =>
  Match.value(prompt).pipe(
    Match.when(Str.includes("What is the capital of France?"), () => ({ answer: "Paris" })),
    Match.when(Str.includes("What is the capital of Japan?"), () => ({ answer: "Tokyo" })),
    Match.when(Str.includes("What is the capital of Italy?"), (italyPrompt) =>
      Match.value(italyPrompt).pipe(
        Match.when(Str.includes("canonical capital city names"), () => ({ answer: "Rome" })),
        Match.orElse(() => ({ answer: "Milan" }))
      )),
    Match.orElse(() => ({ answer: "Unknown" }))
  )

const makeQAModule = Effect.gen(function*() {
  const signature = yield* Signature.make(
    "Answer geography questions with concise city names",
    {
      question: Signature.describe(Schema.String, "Question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "Short factual answer")
    }
  )

  return yield* Module.predict("qa-mipro-resume-test", signature)
})

const silentSink = Progress.makeSink(
  new Progress.SinkOptions({
    supportsAnsi: Effect.succeed(false),
    writeStdout: () => Effect.void,
    writeStderr: () => Effect.void
  })
)

const runtimeLayer = (
  directory: string,
  cachePrefix: string
) =>
  Layer.merge(
    OptimizationStorage.layerFileSystem(StudyStorage.fileSystemOptions(directory, "optimization.jsonl")),
    ObjectiveCache.layerMemory(new ObjectiveCache.Options({ scope: cachePrefix }))
  )

describe("examples/07-miprov2-resume-from-storage", () => {
  it.scoped("writes snapshot/log state and resumes from persisted storage", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-dsp-example-resume-"
      })
      const module = yield* makeQAModule
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map(responseForPrompt)
      )

      const space = yield* makeSpace
      const objective = (raw: unknown) =>
        Effect.gen(function*() {
          const config = yield* Schema.decodeUnknown(space.schema)(raw)

          yield* Ref.set(
            module.params,
            new ModuleParameters({
              instructions: instructionCandidate(config.instructionIndex),
              demos: demoCandidate(config.demoIndex),
              outputStrategy: "structured"
            })
          )

          const report = yield* Evaluate.run({
            module,
            examples: italyEvalset,
            metrics: {
              exactMatch: Metric.exactMatch("answer")
            },
            concurrency: 1
          }).pipe(
            Effect.provideService(LanguageModel.LanguageModel, mock.service)
          )

          return Option.getOrElse(
            Option.fromNullable(report.overallScores.exactMatch),
            () => 0
          )
        })

      const runtimeOptions = {
        storageDirectory: directory,
        cachePrefix: "effect-dsp/examples/resume-test",
        sink: silentSink
      }

      const firstLeg = yield* Stream.runCollect(
        Optimization.stream({
          space,
          sampler: Sampler.random({ seed: 64 }),
          direction: "maximize",
          trials: 3,
          objective
        }).pipe(Progress.tap(runtimeOptions.sink))
      ).pipe(
        Effect.provide(runtimeLayer(runtimeOptions.storageDirectory, runtimeOptions.cachePrefix))
      )

      const resumed = yield* Stream.runCollect(
        Optimization.resumeFromStorageStream({
          space,
          sampler: Sampler.random({ seed: 64 }),
          direction: "maximize",
          trials: 2,
          objective
        }).pipe(Progress.tap(runtimeOptions.sink))
      ).pipe(
        Effect.provide(runtimeLayer(runtimeOptions.storageDirectory, runtimeOptions.cachePrefix))
      )

      const storage = yield* OptimizationStorage.makeFileSystem(
        StudyStorage.fileSystemOptions(directory, "optimization.jsonl")
      )
      const snapshotOption = yield* storage.loadSnapshot()
      const trialLog = yield* storage.loadTrialLog()
      const resumedTags = Arr.map(Chunk.toReadonlyArray(resumed), (event) => event._tag)
      const calls = yield* Ref.get(mock.calls)

      expect(Arr.length(Chunk.toReadonlyArray(firstLeg))).toBeGreaterThan(0)
      expect(resumedTags).toContain("Completed")
      expect(Arr.last(resumedTags)).toEqual(Option.some("Completed"))
      expect(Option.isSome(snapshotOption)).toBe(true)
      expect(Arr.length(trialLog)).toBeGreaterThanOrEqual(5)
      expect(Arr.length(calls)).toBeGreaterThan(0)
      expect(Arr.some(calls, (call) => Str.includes("What is the capital of Italy?")(call.prompt))).toBe(true)

      yield* Option.match(snapshotOption, {
        onNone: () => Effect.dieMessage("study storage did not persist a snapshot"),
        onSome: (snapshot) =>
          Effect.sync(() => {
            expect(snapshot.nextTrialNumber).toBe(5)
            expect(snapshot.completedCount).toBe(5)
          })
      })
    }).pipe(Effect.provide(BunContext.layer)))
})
