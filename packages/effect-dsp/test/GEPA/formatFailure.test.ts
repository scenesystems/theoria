/**
 * GEPA format-failure reflection for every output strategy, plus the deliberate
 * typed abort contract for feedback, critic and proposer failures.
 */
import { expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Boolean as Bool,
  Chunk,
  Data,
  Effect,
  Option,
  Record,
  Ref,
  Schema,
  String as Str,
  Tuple
} from "effect"
import * as AiError from "effect/ai/AiError"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Response from "effect/ai/Response"
import * as Tool from "effect/ai/Tool"
import * as Toolkit from "effect/ai/Toolkit"
import { Example, Id } from "../../src/Example.js"
import * as GEPA from "../../src/GEPA.js"
import { parseFailureFeedbackPrefix } from "../../src/internal/gepa/reflect.js"
import { promptToTraceText } from "../../src/internal/prompt/trace.js"
import * as Metric from "../../src/Metric.js"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"
import * as Module from "../../src/Module.js"
import { ModuleParameters } from "../../src/ModuleParameters.js"
import { decode } from "../../src/Payload.js"
import * as Signature from "../../src/Signature.js"
import { fixture } from "../kit/Fixtures.js"
import { recordingLm } from "../kit/Lm.js"
import { assertNoMutation } from "../kit/Mutation.js"

const Row = Schema.Struct({ id: Schema.String, question: Schema.String, answer: Schema.String })
const Sample = Schema.Struct({
  Inputs: Schema.Record(Schema.String, Schema.String),
  "Generated Outputs": Schema.String,
  Feedback: Schema.String
})
const Case = Schema.Struct({
  program: Schema.Literals(["predict", "react"]),
  predictors: Schema.Array(Schema.String),
  splits: Schema.Struct({ train: Schema.Array(Row), val: Schema.Array(Row) }),
  proposals: Schema.Array(Schema.Struct({
    components: Schema.Array(Schema.String),
    examples: Schema.Record(Schema.String, Schema.Array(Sample))
  })),
  metricCalls: Schema.Array(Schema.Unknown),
  totalMetricCalls: Schema.Int,
  taskCalls: Schema.Int
})
const Reference = Schema.Struct({
  rawResponse: Schema.String,
  maxMetricCalls: Schema.Int,
  minibatchSize: Schema.Int,
  seed: Schema.Int,
  cases: Schema.Array(Case)
})

const reference = Effect.gen(function*() {
  return yield* Schema.decodeUnknownEffect(Reference)(
    (yield* fixture("gepa-format-failure-001", "upstream-execution")).payload
  )
})

const referenceCase = (program: "predict" | "react") =>
  Effect.gen(function*() {
    const loaded = yield* reference
    return {
      reference: loaded,
      upstream: Option.getOrThrow(Arr.findFirst(loaded.cases, (entry) => entry.program === program))
    }
  })

const signature = Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })

const Lookup = Tool.make("Lookup", {
  description: "Look up a fact",
  parameters: Schema.Struct({ query: Schema.String }),
  success: Schema.String
})

class Proposal extends Data.Class<{
  readonly candidate: GEPA.ProgramCandidate
  readonly components: ReadonlyArray<string>
  readonly examples: Record.ReadonlyRecord<string, ReadonlyArray<GEPA.ReflectiveExample>>
}> {}

/**
 * Runs the upstream configuration against a module whose every model reply is
 * the recorded unparseable completion and compares what the proposer received.
 */
const expectUpstreamFormatFeedback = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, E, R>(
  module: Module.Module<I, O, E, R>,
  program: "predict" | "react",
  path: string
) =>
  Effect.gen(function*() {
    const { reference, upstream } = yield* referenceCase(program)
    const initialInstruction = (yield* Ref.get(module.parameters)).instructions
    const lm = yield* recordingLm(() =>
      Effect.succeed([Response.TextPart.make({ text: reference.rawResponse, metadata: {} })])
    )
    const proposals = yield* Ref.make(Arr.empty<Proposal>())
    const scorerCalls = yield* Ref.make(0)
    const trainset = Arr.map(upstream.splits.train, (row) =>
      new Example({
        id: Option.some(Id.make(row.id)),
        input: { question: row.question },
        labels: Option.some({ answer: row.answer })
      }))
    const result = yield* assertNoMutation(
      module,
      GEPA.run(
        new GEPA.Options({
          module,
          trainset,
          valset: trainset,
          maxMetricCalls: reference.maxMetricCalls,
          reflectionMinibatchSize: reference.minibatchSize,
          seed: reference.seed,
          useMerge: false,
          addFormatFailureAsFeedback: true,
          componentSelector: "all",
          metric: Metric.withFeedback(() =>
            Ref.update(scorerCalls, (count) => count + 1).pipe(
              Effect.as(new Metric.Score({ value: 0, feedback: Option.some("metric feedback") }))
            )
          ),
          instructionProposer: (candidate, components, examples) =>
            Ref.update(
              proposals,
              Arr.append(new Proposal({ candidate, components: Chunk.toReadonlyArray(components), examples }))
            ).pipe(
              Effect.as(
                Record.fromEntries(Arr.map(Chunk.toReadonlyArray(components), (path) => Tuple.make(path, "improved")))
              )
            )
        })
      )
    ).pipe(Effect.provide(lm.layer))
    const prompts = yield* Effect.forEach(
      Chunk.toReadonlyArray(yield* Ref.get(lm.requests)),
      (request) => promptToTraceText(request.prompt)
    )
    const observed = {
      upstream,
      result,
      proposals: yield* Ref.get(proposals),
      scorerCalls: yield* Ref.get(scorerCalls),
      prompts
    }
    // Exact upstream inputs and generated-output text, upstream's feedback prefix,
    // and Theoria's bounded structure: the native prompt the target received for that row.
    const upstreamProposal = Option.getOrThrow(Arr.head(observed.upstream.proposals))
    const upstreamSamples = Option.getOrThrow(Arr.head(Record.values(upstreamProposal.examples)))
    expect(observed.proposals).toHaveLength(observed.upstream.proposals.length)
    const proposal = Option.getOrThrow(Arr.head(observed.proposals))
    expect(proposal.components).toEqual([path])
    // Theoria's native proposer input is the parent candidate keyed by predictor path
    // (upstream passes {name: instruction}); each row's inputs/outputs are Payload JSON.
    expect(Arr.map(proposal.candidate.predictorInstructions, ({ predictorName, instruction }) => ({
      predictorName,
      instruction
    }))).toEqual([{ predictorName: path, instruction: initialInstruction }])
    const samples = Option.getOrThrow(Record.get(proposal.examples, path))
    expect(samples).toHaveLength(upstreamSamples.length)
    yield* Effect.forEach(Arr.zip(samples, upstreamSamples), ([sample, upstream]) =>
      Effect.gen(function*() {
        const inputs = yield* decode(Schema.Record(Schema.String, Schema.String), sample.inputs)
        expect(inputs).toEqual(upstream.Inputs)
        expect(yield* decode(Schema.String, sample.generatedOutputs)).toBe(upstream["Generated Outputs"])
        expect(Str.startsWith(parseFailureFeedbackPrefix)(upstream.Feedback)).toBe(true)
        const nativePrompt = Option.getOrThrow(
          Arr.findFirst(observed.prompts, Str.includes(`[[ ## question ## ]]\n${inputs.question}`))
        )
        expect(sample.feedback).toBe(`${parseFailureFeedbackPrefix}${nativePrompt}`)
        expect(sample.evidenceScope).toBe("predictor-execution")
        expect(sample.score).toBe(0)
      }))
    expect(observed.scorerCalls).toBe(observed.upstream.metricCalls.length)
    expect(observed.result.report.metricCalls).toBe(observed.upstream.totalMetricCalls)
    expect(observed.result.report.feedbackMetricCalls).toBe(0)
  })

const predictWith = (outputStrategy: Option.Option<"structured" | "text">) =>
  Effect.gen(function*() {
    const module = yield* Module.predict(
      "qa",
      yield* signature,
      new Module.PredictOptions({
        policy: new Module.PredictPolicyOverrides({ parse: new Module.ParsePolicyOverrides({ maxRetries: 0 }) })
      })
    )
    yield* Option.match(outputStrategy, {
      onNone: () => Effect.void,
      onSome: (strategy) =>
        Module.install(module, {
          qa: new ModuleParameters({ instructions: module.signature.instructions, demos: [], outputStrategy: strategy })
        })
    })
    return module
  })

it.effect("gepa-format-failure-001: default auto Predict resolves structured and still reflects on its failures", () =>
  Effect.gen(function*() {
    const module = yield* predictWith(Option.none())
    expect((yield* Ref.get(module.parameters)).outputStrategy).toBe("auto")
    yield* expectUpstreamFormatFeedback(module, "predict", "qa")
  }))

it.effect("gepa-format-failure-001: explicit structured and text Predict give the same failed-parse samples", () =>
  Effect.gen(function*() {
    yield* expectUpstreamFormatFeedback(yield* predictWith(Option.some("structured")), "predict", "qa")
    yield* expectUpstreamFormatFeedback(yield* predictWith(Option.some("text")), "predict", "qa")
  }))

it.effect("gepa-format-failure-001: an exhausted ReAct agent reflects on its terminal raw response", () =>
  Effect.gen(function*() {
    const tools = Toolkit.make(Lookup)
    const toolkit = yield* tools.pipe(Effect.provide(tools.toLayer({ Lookup: () => Effect.succeed("fact") })))
    const module = yield* Module.react(
      new Module.ReactOptions({ name: "agent", signature: yield* signature, toolkit, maxIterations: 2 })
    )
    yield* expectUpstreamFormatFeedback(module, "react", "agent")
  }))

// Pinned GEPA isolates proposal-time exceptions (reflective_mutation.py catches dataset
// and proposer failures; _propose_texts_batch_safe returns None) and continues. Theoria
// deliberately keeps them typed: the run fails once, without retry, and caller refs are unchanged.
class FeedbackFailure extends Data.TaggedError("FeedbackFailure") {}
class ProposerFailure extends Data.TaggedError("ProposerFailure") {}

const abortFixture = Effect.gen(function*() {
  const module = yield* predictWith(Option.some("text"))
  const trainset = Arr.map(Arr.range(0, 2), (index) =>
    new Example({
      id: Option.some(Id.make(`train-${index}`)),
      input: { question: `train-${index}` },
      labels: Option.some({ answer: `label-${index}` })
    }))
  return { module, trainset }
})

const criticPrompt = "I provided an assistant with the following instructions"
const criticOffline = AiError.make({
  module: "test",
  method: "critic",
  reason: new AiError.UnknownError({ description: "critic offline" })
})

it.effect("a failing feedback metric aborts GEPA with its typed error after one reflect call", () =>
  Effect.gen(function*() {
    const { module, trainset } = yield* abortFixture
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed("[[ ## answer ## ]]\nwrong"))
    const reflectCalls = yield* Ref.make(0)
    const proposerCalls = yield* Ref.make(0)
    const failure = yield* assertNoMutation(
      module,
      GEPA.run(
        new GEPA.Options({
          module,
          trainset,
          maxMetricCalls: 20,
          useMerge: false,
          metric: Metric.withFeedback((_, __, context) =>
            Effect.gen(function*() {
              yield* Effect.when(
                Ref.update(reflectCalls, (count) => count + 1).pipe(Effect.andThen(Effect.fail(new FeedbackFailure()))),
                Effect.succeed(context.phase === "reflect")
              )
              return new Metric.Score({ value: 0, feedback: Option.none() })
            })
          ),
          instructionProposer: () =>
            Ref.update(proposerCalls, (count) => count + 1).pipe(Effect.as(Record.empty<string, string>()))
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.flip)
    )
    expect(failure).toBeInstanceOf(FeedbackFailure)
    expect(yield* Ref.get(reflectCalls)).toBe(1)
    expect(yield* Ref.get(proposerCalls)).toBe(0)
  }))

it.effect("a failing critic model aborts GEPA with its AiError after one reflection call", () =>
  Effect.gen(function*() {
    const { module, trainset } = yield* abortFixture
    const criticCalls = yield* Ref.make(0)
    const mock = yield* MockLanguageModel.make(
      MockLanguageModel.fromFunction((prompt) =>
        Bool.match(Str.includes(criticPrompt)(prompt), {
          onTrue: () => Ref.update(criticCalls, (count) => count + 1).pipe(Effect.andThen(Effect.fail(criticOffline))),
          onFalse: () => Effect.succeed("[[ ## answer ## ]]\nwrong")
        })
      )
    )
    const failure = yield* assertNoMutation(
      module,
      GEPA.run(
        new GEPA.Options({
          module,
          trainset,
          maxMetricCalls: 20,
          useMerge: false,
          metric: Metric.withFeedback(() => Effect.succeed(new Metric.Score({ value: 0, feedback: Option.none() })))
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.flip)
    )
    expect(failure._tag).toBe("AiError")
    expect(yield* Ref.get(criticCalls)).toBe(1)
    const calls = yield* Ref.get(mock.calls)
    expect(Arr.some(calls, (call) => Str.includes(criticPrompt)(call.prompt))).toBe(false)
  }))

it.effect("a failing custom instructionProposer aborts GEPA with its typed error after one call", () =>
  Effect.gen(function*() {
    const { module, trainset } = yield* abortFixture
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed("[[ ## answer ## ]]\nwrong"))
    const proposerCalls = yield* Ref.make(0)
    const events = yield* Ref.make(Arr.empty<string>())
    const failure = yield* assertNoMutation(
      module,
      GEPA.runWithEvents(
        new GEPA.Options({
          module,
          trainset,
          maxMetricCalls: 20,
          useMerge: false,
          metric: Metric.withFeedback(() => Effect.succeed(new Metric.Score({ value: 0, feedback: Option.none() }))),
          instructionProposer: () =>
            Ref.update(proposerCalls, (count) => count + 1).pipe(Effect.andThen(Effect.fail(new ProposerFailure())))
        }),
        (event) => Ref.update(events, Arr.append(event._tag))
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.flip)
    )
    expect(failure).toBeInstanceOf(ProposerFailure)
    expect(yield* Ref.get(proposerCalls)).toBe(1)
    const observed = yield* Ref.get(events)
    expect(Arr.contains(observed, "MutationProposed")).toBe(false)
    expect(Arr.contains(observed, "OptimizationCompleted")).toBe(false)
  }))
