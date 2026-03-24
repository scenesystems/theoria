/**
 * Example contract: storage-backed study resume behavior while the objective
 * evaluates an effect-dsp module with a mock LanguageModel.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { FileSystem } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Layer, Match, Option, Ref, Schema, Stream } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
import * as Evaluate from "effect-dsp/Evaluate"
import { Demo, Example } from "effect-dsp/Example"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"
import { Contracts, Sampler, SearchSpace, Study } from "effect-search"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    instructionIndex: SearchSpace.int(0, 2),
    demoIndex: SearchSpace.int(0, 2)
  })

const italyEvalset = Arr.make(
  new Example({
    input: { question: "What is the capital of Italy?" },
    output: { answer: "Rome" }
  })
)

const franceDemo = new Demo({
  input: { question: "What is the capital of France?" },
  output: { answer: "Paris" }
})

const japanDemo = new Demo({
  input: { question: "What is the capital of Japan?" },
  output: { answer: "Tokyo" }
})

const instructionCandidate = (index: number): string =>
  Match.value(index).pipe(
    Match.when(0, () => "Answer geography questions with concise city names"),
    Match.when(1, () => "Answer with canonical capital city names only"),
    Match.orElse(() => "Use provided demonstrations to infer the correct city")
  )

const demoCandidate = (index: number): ReadonlyArray<Demo> =>
  Match.value(index).pipe(
    Match.when(0, () => Arr.empty()),
    Match.when(1, () => Arr.make(franceDemo)),
    Match.orElse(() => Arr.make(franceDemo, japanDemo))
  )

const responseForPrompt = (prompt: string) =>
  prompt.includes("What is the capital of France?")
    ? { answer: "Paris" }
    : prompt.includes("What is the capital of Japan?")
    ? { answer: "Tokyo" }
    : prompt.includes("What is the capital of Italy?")
    ? prompt.includes("canonical capital city names")
      ? { answer: "Rome" }
      : { answer: "Milan" }
    : { answer: "Unknown" }

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

const silentSink = Study.makeTerminalSink({
  supportsAnsi: Effect.succeed(false),
  writeStdout: () => Effect.void,
  writeStderr: () => Effect.void
})

const makeEnvelopeContextLayer = Effect.gen(function*() {
  const packageVersion = yield* Schema.decode(Contracts.PackageVersion)("0.1.0")
  const runId = yield* Schema.decode(Contracts.RunId)("01HZ0000000000000000000000")
  return Contracts.EnvelopeContextLive({
    packageVersion,
    runId,
    studyId: "resume-test"
  })
})

const runtimeLayer = (
  directory: string,
  cachePrefix: string,
  envelopeContextLayer: Layer.Layer<Contracts.EnvelopeContext>
) =>
  Layer.provideMerge(
    Layer.merge(
      Study.StudyStorageLive(Study.studyStorageOptions(directory)),
      Study.StudyObjectiveCacheMemory(Study.studyObjectiveCacheOptions(cachePrefix))
    ),
    Layer.merge(
      Contracts.fileSystemSink(directory),
      envelopeContextLayer
    )
  )

describe("examples/07-miprov2-resume-from-storage", () => {
  it.scoped("writes snapshot/log state and resumes from persisted storage", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-dsp-example-resume-"
      })
      const envelopeContextLayer = yield* makeEnvelopeContextLayer

      const module = yield* makeQAModule
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map(responseForPrompt)
      )

      const space = makeSpace()
      const decode = Schema.decodeUnknownSync(space.schema)
      const objective = (raw: unknown) =>
        Effect.gen(function*() {
          const config = decode(raw)

          yield* Ref.set(
            module.params,
            new ModuleParams({
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
        Study.optimizeStream({
          space,
          sampler: Sampler.random({ seed: 64 }),
          direction: "maximize",
          trials: 3,
          objective
        }).pipe(Study.tapTerminalProgress({ sink: runtimeOptions.sink }))
      ).pipe(
        Effect.provide(runtimeLayer(runtimeOptions.storageDirectory, runtimeOptions.cachePrefix, envelopeContextLayer))
      )

      const resumed = yield* Stream.runCollect(
        Study.resumeFromStorageStream({
          space,
          sampler: Sampler.random({ seed: 64 }),
          direction: "maximize",
          trials: 2,
          objective
        }).pipe(Study.tapTerminalProgress({ sink: runtimeOptions.sink }))
      ).pipe(
        Effect.provide(runtimeLayer(runtimeOptions.storageDirectory, runtimeOptions.cachePrefix, envelopeContextLayer))
      )

      const storage = yield* Study.makeStudyStorage(Study.studyStorageOptions(directory)).pipe(
        Effect.provide(Contracts.fileSystemSink(directory)),
        Effect.provide(envelopeContextLayer)
      )
      const snapshotOption = yield* storage.loadSnapshot()
      const trialLog = yield* storage.loadTrialLog()
      const resumedTags = Chunk.toReadonlyArray(resumed).map((event) => event._tag)
      const calls = yield* Ref.get(mock.calls)

      expect(Chunk.toReadonlyArray(firstLeg).length).toBeGreaterThan(0)
      expect(resumedTags).toContain("StudyCompleted")
      expect(resumedTags[resumedTags.length - 1]).toBe("StudyCompleted")
      expect(Option.isSome(snapshotOption)).toBe(true)
      expect(trialLog.length).toBeGreaterThanOrEqual(5)
      expect(calls.length).toBeGreaterThan(0)
      expect(Arr.some(calls, (call) => call.prompt.includes("What is the capital of Italy?"))).toBe(true)

      if (Option.isSome(snapshotOption)) {
        expect(snapshotOption.value.nextTrialNumber).toBe(5)
        expect(snapshotOption.value.completedCount).toBe(5)
      }
    }).pipe(Effect.provide(BunContext.layer)))
})
