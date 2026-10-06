/**
 * MIPROv2 Phase 1 demo-candidate generation contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { predictors } from "@scenesystems/effect-dsp/ModuleGraph"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Effect, Equal, Layer, Option, Ref, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { generateDemoCandidates, GenerateDemoCandidatesOptions } from "../../src/MIPROv2Candidates.js"

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with concise facts",
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )

const trainingSet = Arr.make(
  new Example({ input: { question: "What is the capital of France?" }, labels: Option.some({ answer: "Paris" }) }),
  new Example({ input: { question: "What is the capital of Japan?" }, labels: Option.some({ answer: "Tokyo" }) }),
  new Example({ input: { question: "What is the capital of Italy?" }, labels: Option.some({ answer: "Rome" }) })
)

const teacher = Layer.effect(
  LanguageModel.LanguageModel,
  MockLanguageModel.make(MockLanguageModel.succeed("[[ ## answer ## ]]\nteacher\n[[ ## completed ## ]]")).pipe(
    Effect.map((mock) => mock.service)
  )
)

describe("MIPROv2 Phase 1", () => {
  it.effect("includes anchors and fills shuffled bootstrap candidates up to labeled capacity", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)

      yield* Module.install(module, {
        qa: new ModuleParameters({
          instructions: "Answer with one factual phrase",
          demos: Arr.empty(),
          outputStrategy: "text"
        })
      })

      const candidateSets = yield* generateDemoCandidates(
        new GenerateDemoCandidatesOptions({
          module,
          trainset: trainingSet,
          numCandidates: 6,
          maxLabeledDemos: 2,
          maxBootstrappedDemos: 2,
          seed: 11
        })
      )

      const root = yield* Option.match(Arr.head(candidateSets), {
        onNone: () => Effect.die("missing root candidate set"),
        onSome: Effect.succeed
      })
      const shuffled = Arr.drop(root.candidates, 3)
      const shuffledDemoCounts = Arr.map(shuffled, (candidate) => Arr.length(candidate.parameters.demos))

      expect(root.candidates).toHaveLength(6)
      expect(Arr.map(Arr.take(root.candidates, 3), (candidate) => candidate.kind)).toEqual(
        Arr.make("zero-shot", "labels-only", "bootstrap-unshuffled")
      )
      expect(shuffled).toHaveLength(3)
      expect(Arr.every(shuffled, (candidate) => Equal.equals(candidate.kind, "bootstrap-shuffled"))).toBe(true)
      expect(shuffledDemoCounts).toEqual([2, 2, 2])
    }).pipe(Effect.provide(teacher)))

  it.effect("is deterministic without changing instructions to force candidate uniqueness", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const baseline = yield* Ref.get(module.parameters)

      const first = yield* generateDemoCandidates(
        new GenerateDemoCandidatesOptions({
          module,
          trainset: trainingSet,
          numCandidates: 5,
          maxLabeledDemos: 2,
          maxBootstrappedDemos: 2,
          seed: 7
        })
      )
      const second = yield* generateDemoCandidates(
        new GenerateDemoCandidatesOptions({
          module,
          trainset: trainingSet,
          numCandidates: 5,
          maxLabeledDemos: 2,
          maxBootstrappedDemos: 2,
          seed: 7
        })
      )
      const firstRoot = yield* Option.match(Arr.head(first), {
        onNone: () => Effect.die("missing root candidate set"),
        onSome: Effect.succeed
      })

      expect(second).toEqual(first)
      expect(Arr.map(firstRoot.candidates, (candidate) => candidate.parameters.instructions)).toEqual(
        Arr.map(firstRoot.candidates, () => baseline.instructions)
      )
    }).pipe(Effect.provide(teacher)))

  it.effect("keeps candidate payloads schema-valid and predictor-compatible", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const refs = Arr.fromIterable(predictors(module))
      const candidateSets = yield* generateDemoCandidates(
        new GenerateDemoCandidatesOptions({
          module,
          trainset: trainingSet,
          numCandidates: 4,
          seed: 19
        })
      )

      expect(candidateSets).toHaveLength(Arr.length(refs))
      expect(Arr.map(candidateSets, (candidateSet) => candidateSet.predictorName)).toEqual(
        Arr.map(refs, (ref) => ref.name)
      )
      expect(
        Arr.every(candidateSets, (candidateSet) =>
          Arr.every(candidateSet.candidates, (candidate) =>
            Schema.is(ModuleParameters)(candidate.parameters)))
      ).toBe(true)
    }).pipe(Effect.provide(teacher)))
})
