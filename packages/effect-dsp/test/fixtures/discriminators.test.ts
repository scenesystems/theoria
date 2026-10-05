import { expect, it } from "@effect/vitest"
import * as Evaluate from "@scenesystems/effect-dsp/Evaluate"
import { Example, Id } from "@scenesystems/effect-dsp/Example"
import * as GEPA from "@scenesystems/effect-dsp/GEPA"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import { trialBudget } from "@scenesystems/effect-dsp/MIPROv2Search"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as TeacherTrace from "@scenesystems/effect-dsp/TeacherTrace"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import {
  Array as Arr,
  Boolean as Bool,
  Chunk,
  Effect,
  Match,
  Number as Num,
  Option,
  Record,
  Ref,
  Schema,
  String as Str
} from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { makeTrialRefs } from "../../src/internal/miprov2/phase3State.js"
import {
  evaluateBaseline,
  EvaluateBaselineOptions,
  evaluateTrial,
  EvaluateTrialOptions
} from "../../src/internal/miprov2/runtime/evaluate.js"
import { Phase3Config } from "../../src/internal/miprov2/runtime/model.js"
import { fixture } from "../kit/Fixtures.js"
import { failingOn } from "../kit/Metric.js"

const Row = Schema.Struct({ id: Schema.String, question: Schema.String, answer: Schema.String })
const Splits = Schema.Struct({ train: Schema.Array(Row), val: Schema.Array(Row) })
const examples = (rows: ReadonlyArray<typeof Row.Type>) =>
  Arr.map(
    rows,
    (row) =>
      new Example({
        id: Option.some(Id.make(row.id)),
        input: { question: row.question },
        labels: Option.some({ id: row.id, answer: row.answer })
      })
  )
const signature = Signature.make("specialist", { question: Schema.String }, { answer: Schema.String })
const Eval = Schema.Struct({
  splits: Splits,
  runs: Schema.NonEmptyArray(Schema.Struct({ score: Schema.optional(Schema.Finite) }))
})
const Budget = Schema.Struct({
  trialCount: Schema.Int,
  instructions: Schema.Record(Schema.String, Schema.Array(Schema.String))
})
const Checkpoint = Schema.Struct({
  splits: Splits,
  bestFullValidationScore: Schema.Finite,
  evaluations: Schema.NonEmptyArray(Schema.Struct({
    ids: Schema.Array(Schema.String),
    fullValidation: Schema.Boolean,
    instruction: Schema.String,
    score: Schema.Finite
  }))
})
const Gepa = Schema.Struct({
  seed: Schema.Int,
  splits: Splits,
  state: Schema.Struct({ signature: Schema.Struct({ instructions: Schema.String }) })
})
const Demo = Schema.Struct({ question: Schema.String, answer: Schema.String })
const Bootstrap = Schema.Struct({
  splits: Splits,
  state: Schema.Struct({
    first: Schema.Struct({ demos: Schema.Array(Demo) }),
    second: Schema.Struct({ demos: Schema.Array(Demo) })
  })
})

// Decode outside each expected-failure assertion too: malformed evidence must fail the suite.
it.effect("decodes all discriminator payloads independently of expected failures", () =>
  Effect.gen(function*() {
    yield* Schema.decodeUnknownEffect(Eval)(
      (yield* fixture("eval-failure-inclusive-001", "upstream-execution")).payload
    )
    yield* Schema.decodeUnknownEffect(Budget)((yield* fixture("mipro-trial-budget-001", "upstream-execution")).payload)
    yield* Schema.decodeUnknownEffect(Checkpoint)(
      (yield* fixture("mipro-best-fullval-001", "upstream-execution")).payload
    )
    yield* Schema.decodeUnknownEffect(Gepa)((yield* fixture("gepa-aggregate-best-001", "upstream-execution")).payload)
    yield* Schema.decodeUnknownEffect(Bootstrap)(
      (yield* fixture("bootstrap-teacher-trace-001", "upstream-execution")).payload
    )
  }))

const evaluation = Effect.gen(function*() {
  const reference = yield* Schema.decodeUnknownEffect(Eval)(
    (yield* fixture("eval-failure-inclusive-001", "upstream-execution")).payload
  )
  const qa = yield* Signature.make("answer", { question: Schema.String }, { id: Schema.String, answer: Schema.String })
  const module = yield* Module.predict("qa", qa)
  const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ id: "val-0", answer: "label-0" }))
  const report = yield* Evaluate.run(
    new Evaluate.Options({
      module,
      examples: examples(reference.splits.val),
      metrics: { exact: failingOn(["val-1"]) },
      concurrency: 1
    })
  ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
  return { report, expected: Arr.headNonEmpty(reference.runs).score }
})
it.effect("evaluation discriminator executes one success and one metric failure", () =>
  Effect.gen(function*() {
    const { report } = yield* evaluation
    expect(report.successCount).toBe(1)
    expect(report.failureCount).toBe(1)
  }))
it.effect("eval-failure-inclusive-001: failures remain in the denominator (Wave 1)", () =>
  Effect.gen(function*() {
    const { report, expected } = yield* evaluation
    expect(report.overallScores.exact).toBe(expected)
  }))

it.effect.fails("mipro-trial-budget-001: auto light uses upstream trial count (Wave 3)", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Budget)(
      (yield* fixture("mipro-trial-budget-001", "upstream-execution")).payload
    )
    const counts = Record.values(reference.instructions)
    const instructions = yield* Effect.fromOption(Arr.head(counts))
    expect(
      trialBudget({
        predictorCount: Arr.length(counts),
        demoCandidateCount: 6,
        instructionCandidateCount: Arr.length(instructions)
      })
    )
      .toBe(reference.trialCount)
  }))

const checkpoint = Effect.gen(function*() {
  const reference = yield* Schema.decodeUnknownEffect(Checkpoint)(
    (yield* fixture("mipro-best-fullval-001", "upstream-execution")).payload
  )
  const baseline = Arr.headNonEmpty(reference.evaluations)
  const minibatch = yield* Effect.fromOption(
    Arr.findFirst(
      reference.evaluations,
      (e) => Bool.and(Bool.not(e.fullValidation), Num.isGreaterThan(e.score, baseline.score))
    )
  )
  const full = yield* Effect.fromOption(
    Arr.findFirst(
      reference.evaluations,
      (e) => Bool.and(e.fullValidation, Str.Equivalence(e.instruction, minibatch.instruction))
    )
  )
  const refs = yield* makeTrialRefs
  const baselineConfig = Phase3Config.make({ qa__instruction: 0, qa__demo: 0 })
  const candidateConfig = Phase3Config.make({ qa__instruction: 1, qa__demo: 0 })
  const valset = examples(reference.splits.val)
  yield* evaluateBaseline(
    new EvaluateBaselineOptions({ baselineConfig, valset, refs, evaluateOn: () => Effect.succeed(baseline.score) })
  )
  yield* evaluateTrial(
    new EvaluateTrialOptions({
      config: candidateConfig,
      refs,
      valset,
      minibatchExamples: Arr.take(valset, 1),
      fullEvalEvery: 1,
      emit: () => Effect.void,
      evaluateOn: (_config, rows) =>
        Effect.succeed(Bool.match(Num.Equivalence(Arr.length(rows), Arr.length(valset)), {
          onTrue: () => full.score,
          onFalse: () => minibatch.score
        }))
    })
  )
  return {
    expected: reference.bestFullValidationScore,
    actual: yield* Ref.get(refs.bestScoreRef),
    fullTrials: yield* Ref.get(refs.fullEvalTrialsRef)
  }
})
it.effect("checkpoint discriminator reaches full validation", () =>
  Effect.gen(function*() {
    expect((yield* checkpoint).fullTrials).toEqual([0])
  }))
it.effect.fails("mipro-best-fullval-001: minibatch best cannot replace full-val best (Wave 3)", () =>
  Effect.gen(function*() {
    const result = yield* checkpoint
    expect(result.actual).toEqual(Option.some(result.expected))
  }))

const gepa = Effect.gen(function*() {
  const reference = yield* Schema.decodeUnknownEffect(Gepa)(
    (yield* fixture("gepa-aggregate-best-001", "upstream-execution")).payload
  )
  const module = yield* Module.predict("qa", yield* signature)
  const mock = yield* MockLanguageModel.make(
    MockLanguageModel.map((prompt) =>
      Match.value(prompt).pipe(
        Match.when(Str.includes("Your task is to write a new instruction"), () => "```generalist```"),
        Match.orElse(() => ({
          answer: Bool.match(Str.includes("generalist")(prompt), {
            onTrue: () => "generalist",
            onFalse: () => "specialist"
          })
        }))
      )
    )
  )
  const accepted = yield* Ref.make(false)
  const optimized = yield* GEPA.runWithEvents(
    new GEPA.Options({
      module,
      trainset: examples(reference.splits.val),
      maxIterations: 1,
      seed: reference.seed,
      metric: Metric.fromSync((expected, prediction) =>
        Match.value(prediction.answer).pipe(
          Match.when("generalist", () => 0.8),
          Match.orElse(() =>
            Bool.match(expected.answer === "label-0", {
              onTrue: () => 1,
              onFalse: () => 0
            })
          )
        ), "score")
    }),
    (event) =>
      Match.value(event).pipe(
        Match.tag("AcceptanceEvaluated", (acceptedEvent) => Ref.set(accepted, acceptedEvent.accepted)),
        Match.orElse(() => Effect.void)
      )
  )
    .pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
  return {
    actual: Option.getOrThrow(Record.get(optimized.parameters, module.name)).instructions,
    expected: reference.state.signature.instructions,
    accepted: yield* Ref.get(accepted)
  }
})
it.effect("GEPA discriminator admits the generalist candidate", () =>
  Effect.gen(function*() {
    expect((yield* gepa).accepted).toBe(true)
  }))
it.effect.fails("gepa-aggregate-best-001: return aggregate best, not first frontier entry (Wave 3)", () =>
  Effect.gen(function*() {
    const result = yield* gepa
    expect(result.actual).toBe(result.expected)
  }))

const bootstrap = Effect.gen(function*() {
  const reference = yield* Schema.decodeUnknownEffect(Bootstrap)(
    (yield* fixture("bootstrap-teacher-trace-001", "upstream-execution")).payload
  )
  const qa = yield* signature
  const first = yield* Module.predict("first", qa)
  const second = yield* Module.predict("second", qa)
  const module = yield* Module.compose(
    new Module.ComposeOptions({
      name: "pipeline",
      signature: qa,
      subModules: { first, second },
      forward: ({ input }) =>
        first.forward(input).pipe(Effect.flatMap((output) => second.forward({ question: output.answer })))
    })
  )
  const teacher = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "teacher" }))
  const student = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "student" }))
  const compiled = yield* TeacherTrace.collect(
    new TeacherTrace.Options({
      student: module,
      trainset: Chunk.fromIterable(examples(reference.splits.train)),
      maxRounds: 1,
      stopWhen: (accepted) => Chunk.size(accepted) >= 2,
      metric: Metric.withFeedback(
        () => Effect.succeed(new Metric.Score({ value: 0.8, feedback: Option.none() })),
        "accept"
      )
    })
  ).pipe(
    ModelBinder.withBinder(
      new ModelBinder.Binder({
        bind: (request) => (effect) =>
          effect.pipe(
            Effect.provideService(
              LanguageModel.LanguageModel,
              request.role === "teacher" ? teacher.service : student.service
            )
          )
      })
    ),
    Effect.provideService(LanguageModel.LanguageModel, student.service)
  )
  return {
    actual: Arr.map(
      Arr.flatMap(
        Arr.fromIterable(compiled.accepted),
        (entry) => Arr.fromIterable(Option.getOrThrow(Record.get(entry.demosByPredictor, "pipeline.second")))
      ),
      (demo) => ({ question: demo.input.question, answer: demo.output.answer })
    ),
    expected: reference.state.second.demos,
    studentCalls: yield* Ref.get(student.calls)
  }
})
it.effect("bootstrap discriminator uses teacher outputs rather than labels", () =>
  Effect.gen(function*() {
    const result = yield* bootstrap
    expect(result.actual).toContainEqual({ question: "teacher", answer: "teacher" })
    expect(result.studentCalls).toHaveLength(0)
  }))
it.effect("bootstrap-teacher-trace-001: retain repeated teacher trace demos (Wave 2)", () =>
  Effect.gen(function*() {
    const result = yield* bootstrap
    expect(result.actual).toEqual(result.expected)
  }))
