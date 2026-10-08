import { expect, it } from "@effect/vitest"
import * as BootstrapFewShot from "@scenesystems/effect-dsp/BootstrapFewShot"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import { Example, Id } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as ModuleParameters from "@scenesystems/effect-dsp/ModuleParameters"
import * as ParameterSet from "@scenesystems/effect-dsp/ParameterSet"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as TeacherTrace from "@scenesystems/effect-dsp/TeacherTrace"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import { ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import { Array as Arr, Boolean as Bool, Effect, Option, Record, Ref, Schema, String as Str } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { fixture } from "../kit/Fixtures.js"
import { assertNoMutation } from "../kit/Mutation.js"

const Runtime = Schema.Struct({
  python: Schema.Literal("3.12.14"),
  dspy: Schema.Literal("3.4.0"),
  PYTHONHASHSEED: Schema.Literal("0"),
  NPY_DISABLE_CPU_FEATURES: Schema.Literal("AVX2,FMA3,AVX512F")
})
const Row = Schema.Struct({ id: Schema.String, question: Schema.String, answer: Schema.String })
const Message = Schema.Struct({ role: Schema.String, content: Schema.String })
const Call = Schema.Struct({
  messages: Schema.Array(Message),
  kwargs: Schema.Struct({
    temperature: Schema.Finite,
    max_tokens: Schema.Int,
    rollout_id: Schema.OptionFromNullOr(Schema.Int),
    model: Schema.String
  })
})
const StateDemo = Schema.Struct({
  question: Schema.String,
  answer: Schema.String,
  augmented: Schema.OptionFromOptionalKey(Schema.Boolean)
})
const Common = {
  runtime: Runtime,
  splits: Schema.Struct({ train: Schema.Array(Row) }),
  metricCalls: Schema.Array(Schema.Struct({ id: Schema.String })),
  history: Schema.Array(Call)
}
const State = Schema.Struct({ demos: Schema.Array(StateDemo) })

const trainset = (rows: ReadonlyArray<typeof Row.Type>) =>
  Arr.map(rows, (row) =>
    new Example({
      id: Option.some(Id.make(row.id)),
      input: { question: row.question },
      labels: Option.some({ answer: row.answer })
    }))

/** Structured responses serve demo-free predictors; demonstrations select text mode. */
const structured = { answer: "teacher" }
const text = "[[ ## answer ## ]]\nteacher\n[[ ## completed ## ]]"

const setup = (history: ReadonlyArray<typeof Call.Type>, response: unknown = structured) =>
  Effect.gen(function*() {
    const first = yield* Effect.fromOption(Arr.head(history))
    const module = yield* Module.predict(
      "qa",
      yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
    )
    const mock = yield* MockLanguageModel.make(
      MockLanguageModel.succeed(response),
      first.kwargs.model,
      new ModelSettings({ temperature: first.kwargs.temperature, maxTokens: first.kwargs.max_tokens })
    )
    return { module, mock }
  })

const provide = (mock: MockLanguageModel.Runtime) => <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(ModelBinder.withBinder(mock.binder), Effect.provideService(LanguageModel.LanguageModel, mock.service))

const demoRows = (demos: ReadonlyArray<Demonstration>) =>
  Arr.map(demos, (demo) => ({ question: demo.input.question, answer: demo.output.answer, augmented: demo.augmented }))

const referenceDemoRows = (demos: ReadonlyArray<typeof StateDemo.Type>) =>
  Arr.map(demos, (demo) => ({
    question: demo.question,
    answer: demo.answer,
    augmented: Option.getOrElse(demo.augmented, () => false)
  }))

/** The current upstream user turn, e.g. "[[ ## question ## ]]\na". */
const upstreamQuestion = (call: typeof Call.Type) =>
  Effect.fromOption(Arr.last(call.messages)).pipe(
    Effect.flatMap((message) => Effect.fromOption(Arr.head(Str.split(message.content, "\n\n"))))
  )

const recordedId = (calls: Ref.Ref<Array<string>>) => (example: Example) =>
  Effect.fromOption(example.id).pipe(Effect.tap((id) => Ref.update(calls, Arr.append(id))))

it.effect("bootstrapfewshot-rounds: exhausts each example's rounds before visiting the next example", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Schema.Struct({
      ...Common,
      metricCalls: Schema.Array(Schema.Struct({ id: Schema.String, attempt: Schema.Int })),
      maxBootstrappedDemos: Schema.Int,
      maxLabeledDemos: Schema.Int,
      maxRounds: Schema.Int,
      state: State
    }))((yield* fixture("bootstrapfewshot-rounds", "upstream-execution")).payload)
    const { module, mock } = yield* setup(reference.history)
    const calls = yield* Ref.make(Arr.empty<{ readonly id: string; readonly attempt: number }>())
    const result = yield* assertNoMutation(
      module,
      BootstrapFewShot.run(
        new BootstrapFewShot.Options({
          module,
          trainset: trainset(reference.splits.train),
          maxBootstrappedDemos: reference.maxBootstrappedDemos,
          maxLabeledDemos: reference.maxLabeledDemos,
          maxRounds: reference.maxRounds,
          metric: Metric.withFeedback((example) =>
            Effect.gen(function*() {
              const id = yield* Effect.fromOption(example.id)
              const attempt = Arr.length(Arr.filter(yield* Ref.get(calls), (call) => call.id === id)) + 1
              yield* Ref.update(calls, Arr.append({ id, attempt }))
              return new Metric.Score({
                value: Bool.match(id === "a" && attempt === 1, { onTrue: () => 0, onFalse: () => 1 }),
                feedback: Option.none()
              })
            })
          )
        })
      )
    ).pipe(provide(mock))
    expect(yield* Ref.get(calls)).toEqual(reference.metricCalls)
    const history = yield* Ref.get(mock.calls)
    expect(Arr.map(history, (call) => ({
      role: call.role,
      rolloutId: call.rolloutId,
      temperature: call.settings.temperature,
      maxTokens: call.settings.maxTokens
    }))).toEqual(Arr.map(reference.history, (call) => ({
      role: "teacher",
      rolloutId: call.kwargs.rollout_id,
      temperature: call.kwargs.temperature,
      maxTokens: call.kwargs.max_tokens
    })))
    expect(Arr.length(history)).toBe(Arr.length(reference.history))
    yield* Effect.forEach(
      Arr.zip(history, reference.history),
      ([call, upstream]) =>
        upstreamQuestion(upstream).pipe(Effect.map((question) => expect(call.prompt).toContain(question)))
    )
    const demos = yield* Effect.fromOption(Record.get(result.parameters, "qa"))
    expect(demoRows(demos.demos)).toEqual(referenceDemoRows(reference.state.demos))
    expect(result.report.acceptedCount).toBe(2)
    expect(result.report.rejectedCount).toBe(1)
    expect(result.report.demoSources).toEqual({ qa: { bootstrapped: ["a", "b"], labeled: [] } })
  }))

it.effect("bootstrapfewshot-teacher-demos: the default teacher keeps student demos without labeled prewarming", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Schema.Struct({
      ...Common,
      studentDemos: Schema.Array(Schema.Struct({ question: Schema.String, answer: Schema.String })),
      state: State
    }))((yield* fixture("bootstrapfewshot-teacher-demos", "upstream-execution")).payload)
    const { module, mock } = yield* setup(reference.history, text)
    const before = yield* Effect.fromOption(Record.get(yield* ParameterSet.snapshot(module), "qa"))
    yield* Module.install(module, {
      qa: ModuleParameters.withDemos(
        before,
        Arr.map(
          reference.studentDemos,
          (demo) => new Demonstration({ input: { question: demo.question }, output: { answer: demo.answer } })
        )
      )
    })
    const calls = yield* Ref.make(Arr.empty<string>())
    const result = yield* assertNoMutation(
      module,
      BootstrapFewShot.run(
        new BootstrapFewShot.Options({
          module,
          trainset: trainset(reference.splits.train),
          maxBootstrappedDemos: 1,
          maxLabeledDemos: 0,
          maxRounds: 1,
          metric: Metric.withFeedback((example) =>
            recordedId(calls)(example).pipe(Effect.as(new Metric.Score({ value: 1, feedback: Option.none() })))
          )
        })
      )
    ).pipe(provide(mock))
    expect(yield* Ref.get(calls)).toEqual(Arr.map(reference.metricCalls, (call) => call.id))
    const history = yield* Ref.get(mock.calls)
    expect(Arr.length(history)).toBe(Arr.length(reference.history))
    yield* Effect.forEach(
      Arr.zip(history, reference.history),
      ([call, upstream]) =>
        Effect.forEach(reference.studentDemos, (demo) =>
          Effect.sync(() => {
            const upstreamText = Arr.join(Arr.map(upstream.messages, (message) => message.content), "\n")
            expect(Str.includes(demo.answer)(upstreamText)).toBe(true)
            expect(call.prompt).toContain(demo.question)
            expect(call.prompt).toContain(demo.answer)
          }))
    )
    const demos = yield* Effect.fromOption(Record.get(result.parameters, "qa"))
    expect(demoRows(demos.demos)).toEqual(referenceDemoRows(reference.state.demos))
  }))

it.effect("bootstrapfewshot-threshold-zero: an explicit zero threshold rejects a zero score", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Schema.Struct({
      ...Common,
      metricThreshold: Schema.Finite,
      state: State
    }))((yield* fixture("bootstrapfewshot-threshold-zero", "upstream-execution")).payload)
    const { module, mock } = yield* setup(reference.history)
    const calls = yield* Ref.make(Arr.empty<string>())
    const result = yield* assertNoMutation(
      module,
      BootstrapFewShot.run(
        new BootstrapFewShot.Options({
          module,
          trainset: trainset(reference.splits.train),
          maxBootstrappedDemos: 2,
          maxLabeledDemos: 0,
          maxRounds: 1,
          metricThreshold: Option.some(reference.metricThreshold),
          metric: Metric.withFeedback((example) =>
            recordedId(calls)(example).pipe(Effect.map((id) =>
              new Metric.Score({
                value: Bool.match(id === "a", { onTrue: () => 0, onFalse: () => 0.5 }),
                feedback: Option.none()
              })
            ))
          )
        })
      )
    ).pipe(provide(mock))
    expect(reference.metricThreshold).toBe(0)
    expect(yield* Ref.get(calls)).toEqual(Arr.map(reference.metricCalls, (call) => call.id))
    const demos = yield* Effect.fromOption(Record.get(result.parameters, "qa"))
    expect(demoRows(demos.demos)).toEqual(referenceDemoRows(reference.state.demos))
    expect(result.report.rejectedCount).toBe(1)
  }))

it.effect("bootstrapfewshot-max-errors-default: absent maxErrors uses DSPy's settings default", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Schema.Struct({
      ...Common,
      settingsMaxErrors: Schema.Int,
      error: Schema.Literal("ValueError")
    }))((yield* fixture("bootstrapfewshot-max-errors-default", "upstream-execution")).payload)
    const { module, mock } = yield* setup(reference.history)
    const calls = yield* Ref.make(Arr.empty<string>())
    const failure = yield* assertNoMutation(
      module,
      BootstrapFewShot.run(
        new BootstrapFewShot.Options({
          module,
          trainset: trainset(reference.splits.train),
          maxBootstrappedDemos: 2,
          maxLabeledDemos: 0,
          maxRounds: 1,
          metric: Metric.withFeedback((example) =>
            recordedId(calls)(example).pipe(Effect.andThen(Effect.fail("scripted bootstrap failure")))
          )
        })
      )
    ).pipe(provide(mock), Effect.flip)
    expect(failure).toEqual(
      new TeacherTrace.TooManyErrors({ count: reference.settingsMaxErrors, limit: reference.settingsMaxErrors })
    )
    expect(yield* Ref.get(calls)).toEqual(Arr.map(reference.metricCalls, (call) => call.id))
    expect(yield* Ref.get(mock.calls)).toHaveLength(Arr.length(reference.history))
  }))

// Specified boundary, not DSPy parity: DSPy stops once max_bootstrapped_demos examples are
// accepted (here after [a]); Theoria stops only when every trainable predictor reaches the cap,
// so a conditionally skipped predictor keeps collection running.
it.effect("every-predictor stop continues past DSPy's accepted-example count for conditional programs", () =>
  Effect.gen(function*() {
    const signature = yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
    const route = yield* Module.predict("route", signature)
    const detail = yield* Module.predict("detail", signature)
    const module = yield* Module.compose(
      new Module.ComposeOptions({
        name: "pipeline",
        signature,
        subModules: { route, detail },
        forward: ({ input }) =>
          route.forward(input).pipe(Effect.flatMap((routed) =>
            Bool.match(Str.startsWith("x")(input.question), {
              onTrue: () => detail.forward(input),
              onFalse: () => Effect.succeed(routed)
            })
          ))
      })
    )
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "teacher" }))
    const calls = yield* Ref.make(Arr.empty<string>())
    const result = yield* assertNoMutation(
      module,
      BootstrapFewShot.run(
        new BootstrapFewShot.Options({
          module,
          trainset: trainset([
            { id: "a", question: "a", answer: "label-a" },
            { id: "xb", question: "xb", answer: "label-xb" },
            { id: "c", question: "c", answer: "label-c" }
          ]),
          maxBootstrappedDemos: 1,
          maxLabeledDemos: 0,
          metric: Metric.withFeedback((example) =>
            recordedId(calls)(example).pipe(Effect.as(new Metric.Score({ value: 1, feedback: Option.none() })))
          )
        })
      )
    ).pipe(provide(mock))
    expect(yield* Ref.get(calls)).toEqual(["a", "xb"])
    expect(result.report.demoSources).toEqual({
      "pipeline.route": { bootstrapped: ["a"], labeled: [] },
      "pipeline.detail": { bootstrapped: ["xb"], labeled: [] }
    })
  }))
