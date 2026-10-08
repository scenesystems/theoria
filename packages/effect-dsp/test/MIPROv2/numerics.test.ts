/**
 * MIPROv2 Phase 3 scoring against pinned dspy.Evaluate percentages and the
 * pinned minibatch checkpoint selector.
 */
import { expect, it } from "@effect/vitest"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import {
  Array as Arr,
  Boolean as Bool,
  Effect,
  Equal,
  Number as Num,
  Option,
  Record,
  Ref,
  Schema,
  String as Str,
  Tuple
} from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import type { TrialEvaluation } from "../../src/MIPROv2.js"
import { InstructionCandidate, PredictorInstructionCandidates } from "../../src/MIPROv2Candidates.js"
import { Options, run } from "../../src/MIPROv2Search.js"
import { fixture } from "../kit/Fixtures.js"

const Percentage = Schema.Struct({
  binary: Schema.Struct({
    examples: Schema.Int,
    correct: Schema.Int,
    score: Schema.Finite,
    fraction: Schema.Finite
  }),
  graded: Schema.Struct({
    grades: Schema.NonEmptyArray(Schema.Finite),
    score: Schema.Finite,
    fraction: Schema.Finite
  })
})
const Key = Schema.Literals(["A", "B"])
const Checkpoint = Schema.Struct({
  metricValues: Schema.Struct({ A: Schema.Array(Schema.Finite), B: Schema.Array(Schema.Finite) }),
  scores: Schema.Struct({ A: Schema.Array(Schema.Finite), B: Schema.Array(Schema.Finite) }),
  selected: Schema.Struct({ AB: Schema.Struct({ key: Key, mean: Schema.Finite }) })
})

const Question = Schema.Struct({ question: Schema.String })
const instruction = (text: string, isBaseline: boolean) =>
  new InstructionCandidate({
    predictorName: "qa",
    instruction: text,
    tip: text,
    rolloutId: Option.none(),
    prompt: text,
    isBaseline
  })
const instructions = (texts: ReadonlyArray<string>) => [
  new PredictorInstructionCandidates({
    predictorName: "qa",
    candidates: Arr.map(texts, (text, index) => instruction(text, index === 0))
  })
]
const qa = Effect.gen(function*() {
  const signature = yield* Signature.make("baseline", { question: Schema.String }, { answer: Schema.String })
  return yield* Module.predict("qa", signature)
})

/** Values actually passed to study.tell, in trial order. */
const told = (result: { readonly optimizationResult: { readonly trials: Iterable<unknown> } }) =>
  Effect.forEach(
    Arr.fromIterable(result.optimizationResult.trials),
    (trial) =>
      Schema.decodeUnknownEffect(Schema.Struct({
        trialNumber: Schema.Int,
        state: Schema.TaggedStruct("Completed", { value: Schema.Finite })
      }))(trial).pipe(Effect.map((decoded) => decoded.state.value))
  )

it.effect("mipro-percentage-rounding: 23/160 tells dspy.Evaluate's 100*k/n rounding, not mean*100", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Percentage)(
      (yield* fixture("mipro-percentage-rounding", "upstream-execution")).payload
    )
    const module = yield* qa
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "Paris" }))
    const valset = Arr.makeBy(reference.binary.examples, (index) =>
      new Example({
        input: { question: `q${index}` },
        labels: Option.some({
          answer: Bool.match(Num.isLessThan(index, reference.binary.correct), {
            onFalse: () => "Tokyo",
            onTrue: () => "Paris"
          })
        })
      }))
    const result = yield* run(
      new Options({
        module,
        valset,
        metric: Metric.exactMatch("answer"),
        demoCandidates: [],
        instructionCandidates: instructions(["baseline"]),
        trialBudget: 0,
        minibatch: false
      })
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    expect(yield* told(result)).toEqual([reference.binary.score])
    expect(result.diagnostics.baselineObjective).toBe(reference.binary.fraction)
    expect(result.diagnostics.bestScore).toBe(reference.binary.fraction)
  }))

it.effect("mipro-percentage-rounding: graded metrics use builtin float sum before 100*sum/n", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Percentage)(
      (yield* fixture("mipro-percentage-rounding", "upstream-execution")).payload
    )
    const module = yield* qa
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "Paris" }))
    const grades: Record.ReadonlyRecord<string, number> = Record.fromEntries(
      Arr.map(reference.graded.grades, (grade, index) => Tuple.make(`g${index}`, grade))
    )
    const result = yield* run(
      new Options({
        module,
        valset: Arr.map(
          reference.graded.grades,
          (_, index) => new Example({ input: { question: `g${index}` }, labels: Option.some({ answer: "Paris" }) })
        ),
        metric: Metric.withFeedback((example) =>
          Schema.decodeUnknownEffect(Question)(example.input).pipe(
            Effect.flatMap((input) => Effect.fromOption(Record.get(grades, input.question))),
            Effect.map((value) => new Metric.Score({ value, feedback: Option.none() }))
          )
        ),
        demoCandidates: [],
        instructionCandidates: instructions(["baseline"]),
        trialBudget: 0,
        minibatch: false
      })
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    expect(result.diagnostics.evaluations).toHaveLength(1)
    expect(yield* told(result)).toEqual([reference.graded.score])
    expect(result.diagnostics.baselineObjective).toBe(reference.graded.fraction)
  }))

it.effect("mipro-checkpoint-tie: minibatch means [50, 60] and [55] tie and checkpoint the first combination", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Checkpoint)(
      (yield* fixture("mipro-checkpoint-tie", "upstream-kernel")).payload
    )
    const module = yield* qa
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "Paris" }))
    // Sequential calls: two baseline rows, three single-example minibatches, then the checkpoint.
    // Full-validation rows score zero. The first sampled combination receives A's values in order;
    // the other combination receives B's single value.
    const calls = yield* Ref.make(0)
    const seen = yield* Ref.make(Arr.empty<string>())
    const keyOf = (text: string, history: ReadonlyArray<string>): typeof Key.Type =>
      Bool.match(Arr.head(history).pipe(Option.contains(text)) || Arr.isReadonlyArrayEmpty(history), {
        onFalse: () => "B",
        onTrue: () => "A"
      })
    const minibatchValue = Effect.gen(function*() {
      const prompt = Option.getOrThrow(Arr.last(yield* Ref.get(mock.calls))).prompt
      const text = Bool.match(Str.includes("Instructions: alternative")(prompt), {
        onFalse: () => "baseline",
        onTrue: () => "alternative"
      })
      const history = yield* Ref.getAndUpdate(seen, Arr.append(text))
      const key = keyOf(text, history)
      const index = Arr.filter(history, (previous) => keyOf(previous, history) === key).length
      return yield* Effect.fromOption(Arr.get(reference.metricValues[key], index))
    })
    const metric = Metric.withFeedback(() =>
      Effect.gen(function*() {
        const call = yield* Ref.getAndUpdate(calls, Num.increment)
        const value = yield* Bool.match(Num.between(call, { minimum: 2, maximum: 4 }), {
          onFalse: () => Effect.succeed(0),
          onTrue: () => minibatchValue
        })
        return new Metric.Score({ value, feedback: Option.none() })
      })
    )
    const result = yield* run(
      new Options({
        module,
        valset: Arr.makeBy(
          2,
          (index) => new Example({ input: { question: `q${index}` }, labels: Option.some({ answer: "Paris" }) })
        ),
        metric,
        demoCandidates: [],
        instructionCandidates: instructions(["baseline", "alternative"]),
        trialBudget: 3,
        minibatchSize: 1,
        fullEvalEvery: 3,
        seed: 0
      })
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    const rows: ReadonlyArray<TrialEvaluation> = result.diagnostics.evaluations
    const sampled = Arr.filter(rows, (row) => row.sampled)
    const configA = Option.getOrThrow(Arr.head(sampled)).config
    const keys = Arr.map(sampled, (row): typeof Key.Type =>
      Bool.match(Equal.equals(row.config, configA), {
        onFalse: () => "B",
        onTrue: () => "A"
      }))
    // Scenario precondition: A is observed twice and B once before the first checkpoint.
    expect(Arr.filter(keys, (key) => key === "A")).toHaveLength(reference.metricValues.A.length)
    expect(Arr.filter(keys, (key) => key === "B")).toHaveLength(reference.metricValues.B.length)
    const values = yield* told(result)
    expect(Arr.map(sampled, (row) => Option.getOrThrow(Arr.get(values, row.trial)))).toEqual(
      Arr.map(keys, (key, index) =>
        Option.getOrThrow(
          Arr.get(reference.scores[key], Arr.filter(Arr.take(keys, index), (previous) => previous === key).length)
        ))
    )
    const checkpoint = Option.getOrThrow(Arr.findFirst(rows, (row) => !row.sampled && row.trial > 0))
    expect(checkpoint.config).toEqual(
      Option.getOrThrow(
        Arr.findFirst(sampled, (_, index) => Arr.get(keys, index).pipe(Option.contains(reference.selected.AB.key)))
      ).config
    )
  }))
