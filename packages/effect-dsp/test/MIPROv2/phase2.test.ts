/**
 * MIPROv2 Phase 2 instruction-proposal contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { predictors } from "@scenesystems/effect-dsp/ModuleGraph"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as ParameterSet from "@scenesystems/effect-dsp/ParameterSet"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import {
  Array as Arr,
  Context,
  Effect,
  Equal,
  Layer,
  MutableRef,
  Number,
  Option,
  Record,
  Ref,
  Result,
  Schema,
  SchemaGetter,
  String
} from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import {
  DemoCandidate,
  GenerateDemoCandidatesOptions,
  PredictorDemoCandidates,
  proposeInstructionCandidates,
  ProposeInstructionCandidatesOptions
} from "../../src/MIPROv2Candidates.js"

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

const canonicalTipVocabulary = Arr.make("none", "creative", "simple", "description", "high_stakes", "persona")

class Offset extends Context.Service<Offset, number>()("MIPROv2Phase2Test/Offset") {}

const requireSome = <A>(value: Option.Option<A>, message: string) => Effect.fromOption(value, () => message)

// Proposer unit tests supply fixed candidate evidence, without executing Phase 1.
const generateDemoCandidates = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, E, R>(
  options: GenerateDemoCandidatesOptions<I, O, E, R>
) =>
  Effect.gen(function*() {
    const parameters = yield* ParameterSet.snapshot(options.module)
    const labels = Arr.flatMap(options.trainset, (example) =>
      Option.toArray(Option.map(example.labels, (output) =>
        new Demonstration({ input: example.input, output, augmented: true }))))
    return Arr.map(Arr.fromIterable(predictors(options.module)), (predictor) => {
      const original = Option.getOrThrow(Record.get(parameters, predictor.path))
      return new PredictorDemoCandidates({
        predictorName: predictor.name,
        candidates: Arr.makeBy(options.numCandidates, (index) =>
          new DemoCandidate({
            predictorName: predictor.name,
            kind: Equal.equals(index, 0) ? "zero-shot" : "bootstrap-unshuffled",
            parameters: new ModuleParameters({
              instructions: original.instructions,
              outputStrategy: original.outputStrategy,
              demos: Arr.fromIterable(
                Equal.equals(index, 0) ? [] : Arr.isReadonlyArrayEmpty(original.demos) ? labels : original.demos
              )
            })
          }))
      })
    })
  })

describe("MIPROv2 Phase 2", () => {
  it.effect("keeps baseline instruction at index 0 and enforces canonical tip vocabulary", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)

      yield* Module.install(module, {
        qa: new ModuleParameters({
          instructions: "Original baseline instruction",
          demos: [],
          outputStrategy: "text"
        })
      })

      const demoCandidates = yield* generateDemoCandidates(
        new GenerateDemoCandidatesOptions({
          module,
          trainset: trainingSet,
          numCandidates: 4,
          seed: 17
        })
      )
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed("generated instruction"))
      const layer = Layer.merge(
        Layer.succeed(LanguageModel.LanguageModel, mock.service),
        Layer.succeed(ModelBinder.Current, mock.binder)
      )

      const proposals = yield* proposeInstructionCandidates(
        new ProposeInstructionCandidatesOptions({
          module,
          trainset: trainingSet,
          demoCandidates,
          numInstructions: 5,
          seed: 29
        })
      ).pipe(Effect.provide(layer))
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
      expect(root.candidates).toHaveLength(4)
      expect(Arr.every(calls, (call) => Equal.equals(call.settings.temperature, 1))).toBe(true)
    }))

  it.effect("injects grounded context and uses deterministic rollout partitions instead of cache-marker text", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const demoCandidates = yield* generateDemoCandidates(
        new GenerateDemoCandidatesOptions({
          module,
          trainset: trainingSet,
          numCandidates: 3,
          seed: 3
        })
      )
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed("instruction"))
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const first = yield* proposeInstructionCandidates(
        new ProposeInstructionCandidatesOptions({
          module,
          trainset: trainingSet,
          demoCandidates,
          numInstructions: 4,
          seed: 5
        })
      ).pipe(Effect.provide(layer))
      const second = yield* proposeInstructionCandidates(
        new ProposeInstructionCandidatesOptions({
          module,
          trainset: trainingSet,
          demoCandidates,
          numInstructions: 4,
          seed: 5
        })
      ).pipe(Effect.provide(layer))
      const calls = yield* Ref.get(mock.calls)

      expect(first).toEqual(second)
      expect(
        Arr.every(
          Arr.filter(calls, (call) => String.endsWith("Return only proposed_instruction.")(call.prompt)),
          (call) =>
            Arr.every(
              Arr.make(
                "dataset_description:",
                "program_description:",
                "task_demos:",
                "basic_instruction:"
              ),
              (fragment) => String.includes(fragment)(call.prompt)
            )
        )
      ).toBe(true)
      expect(
        Arr.every(
          Arr.flatMap(first, (proposalSet) => Arr.drop(proposalSet.candidates, 1)),
          (candidate) => Option.isSome(candidate.rolloutId) && !String.includes("miprov2-proposal:")(candidate.prompt)
        )
      ).toBe(true)
    }))

  it.effect("losslessly renders nested wire demos without rerunning domain transforms or requiring their services", () =>
    Effect.gen(function*() {
      const decodes = MutableRef.make(0)
      const counted = Schema.FiniteFromString.pipe(Schema.decodeTo(Schema.Finite, {
        decode: SchemaGetter.transformEffect((value) =>
          Effect.map(Offset, (offset) => Number.sum(value, offset)).pipe(
            Effect.tap(() => Effect.sync(() => MutableRef.increment(decodes)))
          )
        ),
        encode: SchemaGetter.transformEffect((value) => Effect.map(Offset, (offset) => Number.subtract(value, offset)))
      }))
      const signature = yield* Signature.make("Inspect structured evidence", {
        facts: Schema.Struct({
          count: counted,
          values: Schema.Array(Schema.FiniteFromString),
          missing: Schema.Null
        })
      }, {
        answer: Schema.String,
        alternatives: Schema.Array(Schema.String),
        missing: Schema.Null
      })
      const module = yield* Module.predict("structured", signature)
      expect(
        yield* Schema.decodeEffect(counted)("007").pipe(Effect.provideService(Offset, 0))
      ).toBe(7)
      yield* Module.install(module, {
        structured: new ModuleParameters({
          instructions: "Use every value",
          demos: Arr.make(
            new Demonstration({
              input: { facts: { count: "007", values: Arr.make("1", "02"), missing: null } },
              output: { answer: "seven", alternatives: Arr.make("007", "7"), missing: null },
              augmented: true
            })
          ),
          outputStrategy: "text"
        })
      })
      const demoCandidates = yield* generateDemoCandidates(
        new GenerateDemoCandidatesOptions({
          module,
          trainset: Arr.empty(),
          numCandidates: 3,
          seed: 11
        })
      )
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed("preserve structured evidence"))
      const proposalSets = yield* proposeInstructionCandidates(
        new ProposeInstructionCandidatesOptions({
          module,
          trainset: Arr.empty(),
          demoCandidates,
          numInstructions: 4,
          seed: 13
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      const calls = yield* Ref.get(mock.calls)
      const structuredCall = yield* requireSome(
        Arr.findFirst(
          calls,
          (call) =>
            String.includes("\"count\":\"007\"")(call.prompt) &&
            String.endsWith("Return only proposed_instruction.")(call.prompt)
        ),
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
      const generated = yield* generateDemoCandidates(
        new GenerateDemoCandidatesOptions({
          module,
          trainset: trainingSet,
          numCandidates: 1,
          seed: 3
        })
      )
      const demoSet = yield* requireSome(Arr.head(generated), "missing demo set")
      const candidate = yield* requireSome(Arr.head(demoSet.candidates), "missing demo candidate")
      const invalidCandidate = new DemoCandidate({
        predictorName: candidate.predictorName,
        kind: candidate.kind,
        parameters: new ModuleParameters({
          instructions: candidate.parameters.instructions,
          demos: Arr.make(new Demonstration({ input: { question: 17 }, output: { answer: "invalid" } })),
          outputStrategy: candidate.parameters.outputStrategy
        })
      })
      const invalid = Arr.make(
        new PredictorDemoCandidates({
          predictorName: demoSet.predictorName,
          candidates: Arr.make(candidate, invalidCandidate)
        })
      )
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed("must not be called"))
      const failure = yield* proposeInstructionCandidates(
        new ProposeInstructionCandidatesOptions({
          module,
          trainset: trainingSet,
          demoCandidates: invalid,
          numInstructions: 2,
          seed: 5
        })
      ).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )
      const calls = yield* Ref.get(mock.calls)

      expect(failure._tag).toBe("SchemaError")
      expect(Arr.length(calls)).toBe(0)
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
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "pipeline",
          signature: rootSignature,
          subModules: { child },
          forward: ({ input }) =>
            child.forward({ question: input.question, context: "Cities" }).pipe(
              Effect.map(({ analysis }) => ({ answer: analysis }))
            )
        })
      )
      const generated = yield* generateDemoCandidates(
        new GenerateDemoCandidatesOptions({
          module: root,
          trainset: trainingSet,
          numCandidates: 1,
          seed: 3
        })
      )
      const childSet = yield* requireSome(
        Arr.findFirst(generated, (candidateSet) => String.Equivalence(candidateSet.predictorName, "analyzer")),
        "missing child demo candidates"
      )
      const childCandidate = yield* requireSome(Arr.head(childSet.candidates), "missing child demo candidate")
      const invalidChildSet = new PredictorDemoCandidates({
        predictorName: childSet.predictorName,
        candidates: Arr.make(
          new DemoCandidate({
            predictorName: childCandidate.predictorName,
            kind: childCandidate.kind,
            parameters: new ModuleParameters({
              instructions: childCandidate.parameters.instructions,
              demos: Arr.make(
                new Demonstration({ input: { question: "France", context: 17 }, output: { analysis: "Paris" } })
              ),
              outputStrategy: childCandidate.parameters.outputStrategy
            })
          })
        )
      })
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed("must not be called"))

      const failure = yield* proposeInstructionCandidates(
        new ProposeInstructionCandidatesOptions({
          module: root,
          trainset: trainingSet,
          demoCandidates: Arr.make(invalidChildSet),
          numInstructions: 2,
          seed: 5
        })
      ).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )

      expect(failure._tag).toBe("SchemaError")
      expect(Arr.length(yield* Ref.get(mock.calls))).toBe(0)
    }))

  it.effect("rejects misbound, duplicate, and unknown candidate identities before generation or parameter writes", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const child = yield* Module.predict("child", signature)
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "pipeline",
          signature,
          subModules: { child },
          forward: ({ input }) => child.forward(input)
        })
      )
      const rootParameters = yield* Ref.get(root.parameters)
      const childParameters = yield* Ref.get(child.parameters)
      const generated = yield* generateDemoCandidates(
        new GenerateDemoCandidatesOptions({
          module: root,
          trainset: trainingSet,
          numCandidates: 1
        })
      )
      const childSet = yield* requireSome(
        Arr.findFirst(generated, (set) => String.Equivalence(set.predictorName, child.name)),
        "missing child candidates"
      )
      const rootBaseline = yield* requireSome(Arr.head(childSet.candidates), "missing child baseline")
      const rootCandidate = new DemoCandidate({
        predictorName: "wrong-predictor",
        kind: rootBaseline.kind,
        parameters: new ModuleParameters({
          instructions: rootBaseline.parameters.instructions,
          demos: Arr.make(new Demonstration({ input: { question: "France?" }, output: { answer: "Paris" } })),
          outputStrategy: rootBaseline.parameters.outputStrategy
        })
      })
      const misboundChildSet = new PredictorDemoCandidates({
        predictorName: child.name,
        candidates: Arr.append(childSet.candidates, rootCandidate)
      })
      const unknownSet = new PredictorDemoCandidates({
        predictorName: "unknown",
        candidates: Arr.make(
          new DemoCandidate({
            predictorName: "unknown",
            kind: rootCandidate.kind,
            parameters: rootCandidate.parameters
          })
        )
      })
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed("must not be called"))

      yield* Effect.forEach(
        Arr.make(
          Arr.make(misboundChildSet),
          Arr.make(childSet, childSet),
          Arr.make(childSet, unknownSet)
        ),
        (demoCandidates) =>
          Effect.gen(function*() {
            const result = yield* proposeInstructionCandidates(
              new ProposeInstructionCandidatesOptions({
                module: root,
                trainset: trainingSet,
                demoCandidates,
                numInstructions: 2
              })
            ).pipe(
              Effect.provideService(LanguageModel.LanguageModel, mock.service),
              Effect.result
            )

            expect(Result.isFailure(result)).toBe(true)
            if (Result.isFailure(result)) {
              expect(result.failure._tag).toBe("InstructionProposalFailed")
            }
            expect(yield* Ref.get(mock.calls)).toHaveLength(0)
            expect(yield* Ref.get(root.parameters)).toBe(rootParameters)
            expect(yield* Ref.get(child.parameters)).toBe(childParameters)
          })
      )

      const proposals = yield* proposeInstructionCandidates(
        new ProposeInstructionCandidatesOptions({
          module: root,
          trainset: trainingSet,
          demoCandidates: Arr.reverse(generated),
          numInstructions: 2
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))

      expect(Arr.map(proposals, (set) => set.predictorName)).toEqual(Arr.make(child.name))
      expect(yield* Ref.get(mock.calls)).toHaveLength(5)
      expect(yield* Ref.get(root.parameters)).toBe(rootParameters)
      expect(yield* Ref.get(child.parameters)).toBe(childParameters)
    }))
})
