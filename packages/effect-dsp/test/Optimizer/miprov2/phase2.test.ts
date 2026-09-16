/**
 * MIPROv2 Phase 2 instruction-proposal contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { ModuleParams } from "@scenesystems/effect-dsp/contracts"
import { Demo, Example } from "@scenesystems/effect-dsp/Example"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Optimizer from "@scenesystems/effect-dsp/Optimizer"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import {
  Array as Arr,
  Boolean,
  Context,
  Effect,
  Equal,
  Layer,
  MutableRef,
  Number,
  Option,
  ParseResult,
  Ref,
  Schema,
  String
} from "effect"
import {
  DemoCandidate,
  generateDemoCandidates,
  PredictorDemoCandidates
} from "../../../src/optimizers/MIPROv2/bootstrap.js"
import { proposeInstructionCandidates } from "../../../src/optimizers/MIPROv2/propose.js"

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

const canonicalTipVocabulary = Arr.make("none", "creative", "simple", "description", "high_stakes", "persona")

class Offset extends Context.Tag("MIPROv2Phase2Test/Offset")<Offset, number>() {}

const requireSome = <A>(value: Option.Option<A>, message: string) =>
  Option.match(value, {
    onNone: () => Effect.fail(message),
    onSome: Effect.succeed
  })

describe("MIPROv2 Phase 2", () => {
  it.effect("keeps baseline instruction at index 0 and enforces canonical tip vocabulary", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)

      yield* Ref.set(
        module.params,
        new ModuleParams({
          instructions: "Original baseline instruction",
          demos: [],
          outputStrategy: "text"
        })
      )

      const demoCandidates = yield* generateDemoCandidates({
        module,
        trainset: trainingSet,
        numCandidates: 4,
        seed: 17
      })
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed("generated instruction"))
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const proposals = yield* proposeInstructionCandidates({
        module,
        trainset: trainingSet,
        demoCandidates,
        numInstructions: 5,
        seed: 29
      }).pipe(Effect.provide(layer))
      const calls = yield* Ref.get(mock.calls)

      const root = yield* requireSome(Arr.head(proposals), "missing root proposals")
      const baseline = yield* requireSome(Arr.head(root.candidates), "missing baseline proposal")

      expect(baseline.isBaseline).toBe(true)
      expect(baseline.instruction).toBe("Original baseline instruction")
      expect(
        Arr.every(
          Arr.drop(root.candidates, 1),
          (candidate) => Arr.containsWith(Equal.equals)(canonicalTipVocabulary, candidate.tip)
        )
      ).toBe(true)
      expect(Arr.every(calls, (call) => String.includes("Diversity Temperature: 1")(call.prompt))).toBe(true)
    }))

  it.effect("injects grounded context signals and deterministic cache-busting markers", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const demoCandidates = yield* generateDemoCandidates({
        module,
        trainset: trainingSet,
        numCandidates: 3,
        seed: 3
      })
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed("instruction"))
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const first = yield* proposeInstructionCandidates({
        module,
        trainset: trainingSet,
        demoCandidates,
        numInstructions: 4,
        seed: 5
      }).pipe(Effect.provide(layer))
      const second = yield* proposeInstructionCandidates({
        module,
        trainset: trainingSet,
        demoCandidates,
        numInstructions: 4,
        seed: 5
      }).pipe(Effect.provide(layer))
      const calls = yield* Ref.get(mock.calls)

      expect(first).toEqual(second)
      expect(
        Arr.every(calls, (call) =>
          Arr.every(
            Arr.make(
              "Dataset Summary:",
              "Program Description:",
              "Bootstrapped Demos:",
              "Tip:",
              "[miprov2-proposal:"
            ),
            (fragment) => String.includes(fragment)(call.prompt)
          ))
      ).toBe(true)
      expect(
        Arr.every(
          Arr.flatMap(first, (proposalSet) => Arr.drop(proposalSet.candidates, 1)),
          (candidate) => String.includes("[miprov2-proposal:")(candidate.cacheBustMarker)
        )
      ).toBe(true)
    }))

  it.effect("losslessly renders nested wire demos without rerunning domain transforms or requiring their services", () =>
    Effect.gen(function*() {
      const decodes = MutableRef.make(0)
      const counted = Schema.transformOrFail(Schema.NumberFromString, Schema.Number, {
        strict: true,
        decode: (value) =>
          Effect.map(Offset, (offset) => Number.sum(value, offset)).pipe(
            Effect.tap(() => Effect.sync(() => MutableRef.increment(decodes)))
          ),
        encode: (value) => Effect.map(Offset, (offset) => Number.subtract(value, offset))
      })
      const signature = yield* Signature.make("Inspect structured evidence", {
        facts: Schema.Struct({
          count: counted,
          values: Schema.Array(Schema.NumberFromString),
          missing: Schema.Null
        })
      }, {
        answer: Schema.String,
        alternatives: Schema.Array(Schema.String),
        missing: Schema.Null
      })
      const module = yield* Module.predict("structured", signature)
      expect(
        yield* Schema.decodeUnknown(counted)("007").pipe(Effect.provideService(Offset, 0))
      ).toBe(7)
      yield* Ref.set(
        module.params,
        new ModuleParams({
          instructions: "Use every value",
          demos: Arr.make(
            new Demo({
              input: { facts: { count: "007", values: Arr.make("1", "02"), missing: null } },
              output: { answer: "seven", alternatives: Arr.make("007", "7"), missing: null }
            })
          ),
          outputStrategy: "text"
        })
      )
      const demoCandidates = yield* generateDemoCandidates({
        module,
        trainset: Arr.empty(),
        numCandidates: 3,
        seed: 11
      })
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed("preserve structured evidence"))
      const proposalSets = yield* proposeInstructionCandidates({
        module,
        trainset: Arr.empty(),
        demoCandidates,
        numInstructions: 4,
        seed: 13
      }).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      const calls = yield* Ref.get(mock.calls)
      const structuredCall = yield* requireSome(
        Arr.findFirst(calls, (call) => String.includes("\"count\":\"007\"")(call.prompt)),
        "missing structured prompt"
      )
      const structuredCandidate = yield* requireSome(
        Arr.findFirst(
          Arr.flatMap(proposalSets, (proposalSet) => proposalSet.candidates),
          (candidate) => String.includes("\"count\":\"007\"")(candidate.prompt)
        ),
        "missing structured candidate prompt"
      )

      expect(MutableRef.get(decodes)).toBe(1)
      expect(structuredCandidate.prompt).toBe(structuredCall.prompt)
      expect(
        String.includes(
          "{\"facts\":{\"count\":\"007\",\"values\":[\"1\",\"02\"],\"missing\":null}}"
        )(structuredCall.prompt)
      ).toBe(true)
      expect(
        String.includes(
          "{\"answer\":\"seven\",\"alternatives\":[\"007\",\"7\"],\"missing\":null}"
        )(structuredCall.prompt)
      ).toBe(true)
    }))

  it.effect("rejects an invalid candidate demo before calling the model", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const generated = yield* generateDemoCandidates({
        module,
        trainset: trainingSet,
        numCandidates: 1,
        seed: 3
      })
      const demoSet = yield* requireSome(Arr.head(generated), "missing demo set")
      const candidate = yield* requireSome(Arr.head(demoSet.candidates), "missing demo candidate")
      const invalidCandidate = new DemoCandidate({
        predictorName: candidate.predictorName,
        kind: candidate.kind,
        params: new ModuleParams({
          instructions: candidate.params.instructions,
          demos: Arr.make(new Demo({ input: { question: 17 }, output: { answer: "invalid" } })),
          outputStrategy: candidate.params.outputStrategy
        })
      })
      const invalid = Arr.make(
        new PredictorDemoCandidates({
          predictorName: demoSet.predictorName,
          candidates: Arr.make(candidate, invalidCandidate)
        })
      )
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed("must not be called"))
      const failure = yield* proposeInstructionCandidates({
        module,
        trainset: trainingSet,
        demoCandidates: invalid,
        numInstructions: 2,
        seed: 5
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )
      const calls = yield* Ref.get(mock.calls)

      expect(failure._tag).toBe("ParseError")
      expect(Boolean.not(Arr.isNonEmptyReadonlyArray(calls))).toBe(true)
    }))

  it.effect("preflights every composed destination before any public instruction-proposal model call", () =>
    Effect.gen(function*() {
      const rootSignature = yield* Signature.make(
        "Answer from analysis",
        { question: Schema.String },
        { answer: Schema.String }
      )
      const childSignature = yield* Signature.make(
        "Analyze context",
        { question: Schema.String, context: Schema.String },
        { analysis: Schema.String }
      )
      const child = yield* Module.predict("analyzer", childSignature)
      const root = yield* Module.compose({
        name: "pipeline",
        signature: rootSignature,
        subModules: { child },
        forward: ({ input }) =>
          child.forward({ question: input.question, context: "Cities" }).pipe(
            Effect.map(({ analysis }) => ({ answer: analysis }))
          )
      })
      const generated = yield* Optimizer.generateDemoCandidates({
        module: root,
        trainset: trainingSet,
        numCandidates: 1,
        seed: 3
      })
      const rootSet = yield* requireSome(
        Arr.findFirst(generated, (candidateSet) => String.Equivalence(candidateSet.predictorName, "pipeline")),
        "missing root demo candidates"
      )
      const childSet = yield* requireSome(
        Arr.findFirst(generated, (candidateSet) => String.Equivalence(candidateSet.predictorName, "analyzer")),
        "missing child demo candidates"
      )
      const childCandidate = yield* requireSome(Arr.head(childSet.candidates), "missing child demo candidate")
      const invalidChildSet = new Optimizer.PredictorDemoCandidates({
        predictorName: childSet.predictorName,
        candidates: Arr.make(
          new Optimizer.DemoCandidate({
            predictorName: childCandidate.predictorName,
            kind: childCandidate.kind,
            params: new ModuleParams({
              instructions: childCandidate.params.instructions,
              demos: Arr.make(
                new Demo({ input: { question: "France", context: 17 }, output: { analysis: "Paris" } })
              ),
              outputStrategy: childCandidate.params.outputStrategy
            })
          })
        )
      })
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed("must not be called"))

      const failure = yield* Optimizer.proposeInstructionCandidates({
        module: root,
        trainset: trainingSet,
        demoCandidates: Arr.make(rootSet, invalidChildSet),
        numInstructions: 2,
        seed: 5
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )

      expect(failure).toBeInstanceOf(ParseResult.ParseError)
      expect(Arr.length(yield* Ref.get(mock.calls))).toBe(0)
    }))

  it.effect("rejects misbound, duplicate, and unknown candidate identities before generation or parameter writes", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const child = yield* Module.predict("child", signature)
      const root = yield* Module.compose({
        name: "pipeline",
        signature,
        subModules: { child },
        forward: ({ input }) => child.forward(input)
      })
      const rootParams = yield* Ref.get(root.params)
      const childParams = yield* Ref.get(child.params)
      const generated = yield* Optimizer.generateDemoCandidates({
        module: root,
        trainset: trainingSet,
        numCandidates: 1
      })
      const rootSet = yield* requireSome(
        Arr.findFirst(generated, (set) => String.Equivalence(set.predictorName, root.name)),
        "missing root candidates"
      )
      const childSet = yield* requireSome(
        Arr.findFirst(generated, (set) => String.Equivalence(set.predictorName, child.name)),
        "missing child candidates"
      )
      const rootBaseline = yield* Arr.head(rootSet.candidates)
      const rootCandidate = new Optimizer.DemoCandidate({
        ...rootBaseline,
        params: new ModuleParams({
          ...rootBaseline.params,
          demos: Arr.make(new Demo({ input: { question: "France?" }, output: { answer: "Paris" } }))
        })
      })
      const misboundChildSet = new Optimizer.PredictorDemoCandidates({
        predictorName: child.name,
        candidates: Arr.append(childSet.candidates, rootCandidate)
      })
      const unknownSet = new Optimizer.PredictorDemoCandidates({
        predictorName: "unknown",
        candidates: Arr.make(
          new Optimizer.DemoCandidate({
            ...rootCandidate,
            predictorName: "unknown"
          })
        )
      })
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed("must not be called"))

      yield* Effect.forEach(
        Arr.make(
          Arr.make(rootSet, misboundChildSet),
          Arr.make(rootSet, childSet, rootSet),
          Arr.make(rootSet, childSet, unknownSet)
        ),
        (demoCandidates) =>
          Effect.gen(function*() {
            const result = yield* Optimizer.proposeInstructionCandidates({
              module: root,
              trainset: trainingSet,
              demoCandidates,
              numInstructions: 2
            }).pipe(
              Effect.provideService(LanguageModel.LanguageModel, mock.service),
              Effect.either
            )

            expect(result).toMatchObject({ left: { _tag: "InstructionProposalFailed" } })
            expect(yield* Ref.get(mock.calls)).toHaveLength(0)
            expect(yield* Ref.get(root.params)).toBe(rootParams)
            expect(yield* Ref.get(child.params)).toBe(childParams)
          })
      )

      const proposals = yield* Optimizer.proposeInstructionCandidates({
        module: root,
        trainset: trainingSet,
        demoCandidates: Arr.reverse(generated),
        numInstructions: 2
      }).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))

      expect(Arr.map(proposals, (set) => set.predictorName)).toEqual(Arr.make(root.name, child.name))
      expect(yield* Ref.get(mock.calls)).toHaveLength(2)
      expect(yield* Ref.get(root.params)).toBe(rootParams)
      expect(yield* Ref.get(child.params)).toBe(childParams)
    }))
})
