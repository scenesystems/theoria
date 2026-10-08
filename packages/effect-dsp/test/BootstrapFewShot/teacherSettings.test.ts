import { expect, it } from "@effect/vitest"
import * as BootstrapFewShot from "@scenesystems/effect-dsp/BootstrapFewShot"
import type { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import { Example, Id } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import { ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import { Array as Arr, Boolean as Bool, Effect, Option, Record, Ref, Schema, String as Str } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { fixture } from "../kit/Fixtures.js"
import { assertNoMutation } from "../kit/Mutation.js"

const Runtime = Schema.Struct({
  python: Schema.Literal("3.12.14"),
  dspy: Schema.Literal("3.4.0"),
  numpy: Schema.Literal("1.26.4"),
  optuna: Schema.Literal("4.9.0"),
  PYTHONHASHSEED: Schema.Literal("0"),
  NPY_DISABLE_CPU_FEATURES: Schema.Literal("AVX2,FMA3,AVX512F")
})
const Row = Schema.Struct({ id: Schema.String, question: Schema.String, answer: Schema.String })
const Message = Schema.Struct({ role: Schema.String, content: Schema.String })
const Call = Schema.Struct({
  client: Schema.Literals(["teacher-settings", "teacher-original", "student", "copy"]),
  messages: Schema.NonEmptyArray(Message),
  kwargs: Schema.Struct({
    temperature: Schema.Finite,
    max_tokens: Schema.Int,
    rollout_id: Schema.OptionFromNullOr(Schema.Int),
    model: Schema.String
  }),
  response: Schema.NonEmptyArray(Schema.String)
})
const Demo = Schema.Struct({ question: Schema.String, answer: Schema.String, augmented: Schema.Boolean })
const Predictor = Schema.Struct({ demos: Schema.Array(Demo) })
const State = Schema.Struct({ first: Predictor, second: Predictor })
const Settings = Schema.Struct({ temperature: Schema.Finite, max_tokens: Schema.Int })

const examples = (rows: ReadonlyArray<typeof Row.Type>) =>
  Arr.map(rows, (row) =>
    new Example({
      id: Option.some(Id.make(row.id)),
      input: { question: row.question },
      labels: Option.some({ answer: row.answer })
    }))

/** Two chained predictors, as the upstream TwoStage module. */
const twoStage = Effect.gen(function*() {
  const qa = yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
  const build = Effect.gen(function*() {
    const first = yield* Module.predict("first", qa)
    const second = yield* Module.predict("second", qa)
    return yield* Module.compose(
      new Module.ComposeOptions({
        name: "pipeline",
        signature: qa,
        subModules: { first, second },
        forward: ({ input }) =>
          first.forward(input).pipe(Effect.flatMap((output) => second.forward({ question: output.answer })))
      })
    )
  })
  return { student: yield* build, teacher: yield* build }
})

/** Routes teacher-role requests to the teacher LM and every other role to the student LM. */
const routed =
  (teacher: MockLanguageModel.Runtime, student: MockLanguageModel.Runtime) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      ModelBinder.withBinder(
        new ModelBinder.Binder({
          bind: (request) => (bound) =>
            Bool.match(request.role === "teacher", {
              onTrue: () =>
                teacher.binder.bind(request)(
                  bound.pipe(Effect.provideService(LanguageModel.LanguageModel, teacher.service))
                ),
              onFalse: () =>
                student.binder.bind(request)(
                  bound.pipe(Effect.provideService(LanguageModel.LanguageModel, student.service))
                )
            })
        })
      ),
      // Unbound operations (none are expected) fall back to the student, as the caller's context LM.
      Effect.provideService(LanguageModel.LanguageModel, student.service)
    )

/** The upstream user turn's first field, e.g. "[[ ## question ## ]]\na" -> "a". */
const upstreamQuestion = (call: typeof Call.Type) =>
  Effect.fromOption(Arr.head(Str.split(Arr.lastNonEmpty(call.messages).content, "\n\n"))).pipe(
    Effect.flatMap((turn) => Effect.fromOption(Arr.last(Str.split(turn, "\n"))))
  )

const demoRows = (demos: ReadonlyArray<Demonstration>) =>
  Arr.map(demos, (demo) => ({ question: demo.input.question, answer: demo.output.answer, augmented: demo.augmented }))

const assertCalls = (
  calls: ReadonlyArray<MockLanguageModel.Call>,
  history: ReadonlyArray<typeof Call.Type>
) =>
  Effect.gen(function*() {
    expect(Arr.map(calls, (call) => ({
      role: call.role,
      rolloutId: call.rolloutId,
      temperature: call.settings.temperature,
      maxTokens: call.settings.maxTokens
    }))).toEqual(Arr.map(history, (call) => ({
      role: "teacher",
      rolloutId: call.kwargs.rollout_id,
      temperature: call.kwargs.temperature,
      maxTokens: call.kwargs.max_tokens
    })))
    yield* Effect.forEach(Arr.zip(calls, history), ([call, upstream]) =>
      Effect.map(upstreamQuestion(upstream), (question) => expect(call.prompt).toContain(question)))
  })

it.effect("bootstrapfewshot-teacher-settings-001: teacher settings, role and retry rollout reach every teacher call", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Schema.Struct({
      runtime: Runtime,
      splits: Schema.Struct({ train: Schema.Array(Row) }),
      teacherSettings: Settings,
      studentSettings: Settings,
      maxBootstrappedDemos: Schema.Int,
      maxLabeledDemos: Schema.Int,
      maxRounds: Schema.Int,
      metricCalls: Schema.Array(Schema.Struct({ id: Schema.String, attempt: Schema.Int, prediction: Schema.Unknown })),
      history: Schema.NonEmptyArray(Call),
      studentHistory: Schema.Array(Call),
      state: State
    }))((yield* fixture("bootstrapfewshot-teacher-settings-001", "upstream-execution")).payload)
    // Round 0 calls the teacher_settings LM itself; retries call its rollout copy. The student never runs.
    expect(Arr.map(reference.history, (call) => call.client)).toEqual(
      Arr.map(
        reference.history,
        (call) => Option.match(call.kwargs.rollout_id, { onNone: () => "teacher-settings", onSome: () => "copy" })
      )
    )
    expect(reference.studentHistory).toEqual([])
    const { student, teacher } = yield* twoStage
    const teacherLm = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "teacher" }))
    const studentLm = yield* MockLanguageModel.make(
      MockLanguageModel.succeed({ answer: "student" }),
      "student",
      new ModelSettings({
        temperature: reference.studentSettings.temperature,
        maxTokens: reference.studentSettings.max_tokens
      })
    )
    const attempts = yield* Ref.make(
      Arr.empty<{ readonly id: string; readonly attempt: number; readonly prediction: unknown }>()
    )
    const result = yield* assertNoMutation(
      student,
      BootstrapFewShot.run(
        new BootstrapFewShot.Options({
          module: student,
          teacher,
          teacherSettings: new ModelSettings({
            temperature: reference.teacherSettings.temperature,
            maxTokens: reference.teacherSettings.max_tokens
          }),
          trainset: examples(reference.splits.train),
          maxBootstrappedDemos: reference.maxBootstrappedDemos,
          maxLabeledDemos: reference.maxLabeledDemos,
          maxRounds: reference.maxRounds,
          metric: Metric.withFeedback((example, prediction) =>
            Effect.gen(function*() {
              const id = yield* Effect.fromOption(example.id)
              const attempt = Arr.length(Arr.filter(yield* Ref.get(attempts), (call) => call.id === id)) + 1
              yield* Ref.update(attempts, Arr.append({ id, attempt, prediction: prediction.output }))
              return new Metric.Score({
                value: Bool.match(id === "a" && attempt === 1, { onTrue: () => 0, onFalse: () => 1 }),
                feedback: Option.none()
              })
            })
          )
        })
      )
    ).pipe(routed(teacherLm, studentLm))
    expect(yield* Ref.get(attempts)).toEqual(reference.metricCalls)
    yield* assertCalls(yield* Ref.get(teacherLm.calls), reference.history)
    expect(yield* Ref.get(studentLm.calls)).toEqual(reference.studentHistory)
    const first = yield* Effect.fromOption(Record.get(result.parameters, "pipeline.first"))
    const second = yield* Effect.fromOption(Record.get(result.parameters, "pipeline.second"))
    expect(demoRows(first.demos)).toEqual(reference.state.first.demos)
    expect(demoRows(second.demos)).toEqual(reference.state.second.demos)
  }))

it.effect("bootstrap-teacher-trace-calls-001: deep-copied teacher calls back bootstrap-teacher-trace-001", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Schema.Struct({
      runtime: Runtime,
      captures: Schema.Literal("bootstrap-teacher-trace-001"),
      splits: Schema.Struct({ train: Schema.Array(Row) }),
      metricCalls: Schema.Array(Schema.Struct({ id: Schema.String })),
      history: Schema.NonEmptyArray(Call),
      originalTeacherHistory: Schema.Array(Call),
      studentHistory: Schema.Array(Call),
      state: State
    }))((yield* fixture("bootstrap-teacher-trace-calls-001", "upstream-execution")).payload)
    const original = yield* Schema.decodeUnknownEffect(Schema.Struct({
      splits: Schema.Struct({ train: Schema.Array(Row) }),
      metricCalls: Schema.Array(Schema.Struct({ id: Schema.String })),
      history: Schema.Array(Call),
      studentHistory: Schema.Array(Call),
      state: State
    }))((yield* fixture("bootstrap-teacher-trace-001", "upstream-execution")).payload)
    // Same configuration and outcome; the original payload's empty history was the uncopied LM's.
    expect(reference.splits).toEqual(original.splits)
    expect(reference.state).toEqual(original.state)
    expect(Arr.map(reference.metricCalls, (call) => call.id)).toEqual(Arr.map(original.metricCalls, (call) => call.id))
    expect(original.history).toEqual([])
    expect(reference.originalTeacherHistory).toEqual(original.history)
    expect(Arr.every(reference.history, (call) => call.client === "copy")).toBe(true)
    expect(reference.studentHistory).toEqual([])
    const upstream = Arr.headNonEmpty(reference.history).kwargs
    const { student, teacher } = yield* twoStage
    // The copied teacher LM keeps the bound LM's own defaults; no teacher settings are supplied.
    const teacherLm = yield* MockLanguageModel.make(
      MockLanguageModel.succeed({ answer: "teacher" }),
      upstream.model,
      new ModelSettings({ temperature: upstream.temperature, maxTokens: upstream.max_tokens })
    )
    const studentLm = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "student" }))
    const calls = yield* Ref.make(Arr.empty<string>())
    const result = yield* assertNoMutation(
      student,
      BootstrapFewShot.run(
        new BootstrapFewShot.Options({
          module: student,
          teacher,
          trainset: examples(reference.splits.train),
          maxBootstrappedDemos: 2,
          maxLabeledDemos: 0,
          maxRounds: 1,
          maxErrors: Option.some(1),
          metric: Metric.withFeedback((example) =>
            Effect.gen(function*() {
              const id = yield* Effect.fromOption(example.id)
              yield* Ref.update(calls, Arr.append(id))
              return new Metric.Score({
                value: Bool.match(id === "train-0", { onTrue: () => 0.4, onFalse: () => 0.8 }),
                feedback: Option.none()
              })
            })
          )
        })
      )
    ).pipe(routed(teacherLm, studentLm))
    expect(yield* Ref.get(calls)).toEqual(Arr.map(reference.metricCalls, (call) => call.id))
    yield* assertCalls(yield* Ref.get(teacherLm.calls), reference.history)
    expect(yield* Ref.get(studentLm.calls)).toEqual(reference.studentHistory)
    const first = yield* Effect.fromOption(Record.get(result.parameters, "pipeline.first"))
    const second = yield* Effect.fromOption(Record.get(result.parameters, "pipeline.second"))
    expect(demoRows(first.demos)).toEqual(reference.state.first.demos)
    expect(demoRows(second.demos)).toEqual(reference.state.second.demos)
  }))
