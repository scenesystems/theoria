/**
 * MIPROv2 Phase 1 demo-candidate generation contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Effect, Equal, Number as Num, Ref, Schema } from "effect"
import { collectModuleParamRefs } from "../../src/internal/moduleParameters.js"
import { generateDemoCandidates } from "../../src/MIPROv2Candidates.js"

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
  new Example({
    input: { question: "What is the capital of France?" },
    output: { answer: "Paris" }
  }),
  new Example({
    input: { question: "What is the capital of Japan?" },
    output: { answer: "Tokyo" }
  }),
  new Example({
    input: { question: "What is the capital of Italy?" },
    output: { answer: "Rome" }
  })
)

const uniqueParams = (params: ReadonlyArray<ModuleParameters>) =>
  Arr.dedupeWith(Arr.fromIterable(params), Schema.equivalence(ModuleParameters))

const uniqueNumbers = (numbers: ReadonlyArray<number>) => Arr.dedupeWith(Arr.fromIterable(numbers), Num.Equivalence)

describe("MIPROv2 Phase 1", () => {
  it.effect("includes anchor candidates, then N-3 shuffled bootstrap variants with bounded random demo counts", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)

      yield* Ref.set(
        module.params,
        new ModuleParameters({
          instructions: "Answer with one factual phrase",
          demos: Arr.empty(),
          outputStrategy: "text"
        })
      )

      const candidateSets = yield* generateDemoCandidates({
        module,
        trainset: trainingSet,
        numCandidates: 6,
        maxLabeledDemos: 2,
        maxBootstrappedDemos: 2,
        seed: 11
      })

      const root = yield* Arr.head(candidateSets)
      const shuffled = Arr.drop(root.candidates, 3)
      const shuffledDemoCounts = Arr.map(shuffled, (candidate) => Arr.length(candidate.params.demos))

      expect(root.candidates).toHaveLength(6)
      expect(Arr.map(Arr.take(root.candidates, 3), (candidate) => candidate.kind)).toEqual(
        Arr.make("zero-shot", "labels-only", "bootstrap-unshuffled")
      )
      expect(shuffled).toHaveLength(3)
      expect(Arr.every(shuffled, (candidate) => Equal.equals(candidate.kind, "bootstrap-shuffled"))).toBe(true)
      expect(Arr.every(shuffledDemoCounts, Num.between({ minimum: 1, maximum: 2 }))).toBe(true)
      expect(Arr.length(uniqueNumbers(shuffledDemoCounts))).toBeGreaterThan(1)
    }))

  it.effect("is unique and deterministic for a fixed seed", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)

      const first = yield* generateDemoCandidates({
        module,
        trainset: trainingSet,
        numCandidates: 5,
        maxLabeledDemos: 2,
        maxBootstrappedDemos: 2,
        seed: 7
      })
      const second = yield* generateDemoCandidates({
        module,
        trainset: trainingSet,
        numCandidates: 5,
        maxLabeledDemos: 2,
        maxBootstrappedDemos: 2,
        seed: 7
      })
      const firstRoot = yield* Arr.head(first)

      expect(second).toEqual(first)
      expect(uniqueParams(Arr.map(firstRoot.candidates, (candidate) => candidate.params))).toHaveLength(
        Arr.length(firstRoot.candidates)
      )
    }))

  it.effect("keeps candidate payloads schema-valid and predictor-compatible", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const refs = collectModuleParamRefs(module)
      const candidateSets = yield* generateDemoCandidates({
        module,
        trainset: trainingSet,
        numCandidates: 4,
        seed: 19
      })

      expect(candidateSets).toHaveLength(Arr.length(refs))
      expect(Arr.map(candidateSets, (candidateSet) => candidateSet.predictorName)).toEqual(
        Arr.map(refs, (ref) => ref.name)
      )
      expect(
        Arr.every(candidateSets, (candidateSet) =>
          Arr.every(candidateSet.candidates, (candidate) =>
            Schema.is(ModuleParameters)(candidate.params)))
      ).toBe(true)
    }))
})
