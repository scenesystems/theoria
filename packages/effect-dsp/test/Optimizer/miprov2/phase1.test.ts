/**
 * MIPROv2 Phase 1 demo-candidate generation contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Data, Effect, Option, Ref, Schema } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
import { Example } from "effect-dsp/Example"
import * as Module from "effect-dsp/Module"
import { collectModuleParamRefs } from "../../../src/internal/module-params.js"
import { generateDemoCandidates } from "../../../src/optimizers/MIPROv2/bootstrap.js"
import { conciseFactsQaSignature } from "../../helpers/qa-signatures.js"

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

const uniqueParams = (params: ReadonlyArray<ModuleParams>): ReadonlyArray<ModuleParams> =>
  Arr.reduce(params, Arr.empty<ModuleParams>(), (unique, candidate) =>
    Arr.some(
        unique,
        (existing) =>
          Data.struct(existing).instructions === Data.struct(candidate).instructions &&
          Data.struct(existing).demos.length === Data.struct(candidate).demos.length &&
          Data.struct(existing).outputStrategy === Data.struct(candidate).outputStrategy
      )
      ? unique
      : Arr.append(unique, candidate))

const uniqueNumbers = (numbers: ReadonlyArray<number>): ReadonlyArray<number> =>
  Arr.reduce(
    numbers,
    Arr.empty<number>(),
    (unique, numberValue) =>
      Arr.some(unique, (existing) => existing === numberValue)
        ? unique
        : Arr.append(unique, numberValue)
  )

describe("MIPROv2 Phase 1", () => {
  it.effect("includes anchor candidates, then N-3 shuffled bootstrap variants with bounded random demo counts", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const module = yield* Module.predict("qa", signature)

      yield* Ref.set(
        module.params,
        new ModuleParams({
          instructions: "Answer with one factual phrase",
          demos: [],
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

      const rootOption = Arr.head(candidateSets)

      expect(Option.isSome(rootOption)).toBe(true)

      if (Option.isNone(rootOption)) {
        return
      }

      const root = rootOption.value
      const shuffled = Arr.drop(root.candidates, 3)
      const shuffledDemoCounts = Arr.map(shuffled, (candidate) => candidate.params.demos.length)

      expect(root.candidates).toHaveLength(6)
      expect(Arr.map(Arr.take(root.candidates, 3), (candidate) => candidate.kind)).toEqual(
        Arr.make("zero-shot", "labels-only", "bootstrap-unshuffled")
      )
      expect(shuffled).toHaveLength(3)
      expect(Arr.every(shuffled, (candidate) => candidate.kind === "bootstrap-shuffled")).toBe(true)
      expect(Arr.every(shuffledDemoCounts, (count) => count >= 1 && count <= 2)).toBe(true)
      expect(uniqueNumbers(shuffledDemoCounts).length).toBeGreaterThan(1)
    }))

  it.effect("is unique and deterministic for a fixed seed", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
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
      const firstRootOption = Arr.head(first)

      expect(Option.isSome(firstRootOption)).toBe(true)

      if (Option.isNone(firstRootOption)) {
        return
      }

      const firstRoot = firstRootOption.value

      expect(second).toEqual(first)
      expect(uniqueParams(Arr.map(firstRoot.candidates, (candidate) => candidate.params))).toHaveLength(
        firstRoot.candidates.length
      )
    }))

  it.effect("keeps candidate payloads schema-valid and predictor-compatible", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const module = yield* Module.predict("qa", signature)
      const refs = collectModuleParamRefs(module)
      const candidateSets = yield* generateDemoCandidates({
        module,
        trainset: trainingSet,
        numCandidates: 4,
        seed: 19
      })

      expect(candidateSets).toHaveLength(refs.length)
      expect(Arr.map(candidateSets, (candidateSet) => candidateSet.predictorName)).toEqual(
        Arr.map(refs, (ref) => ref.name)
      )
      expect(
        Arr.every(candidateSets, (candidateSet) =>
          Arr.every(candidateSet.candidates, (candidate) => Schema.is(ModuleParams)(candidate.params)))
      ).toBe(true)
    }))
})
