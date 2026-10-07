import { expect, it } from "@effect/vitest"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import * as Example from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as ModuleParameters from "@scenesystems/effect-dsp/ModuleParameters"
import * as ParameterSet from "@scenesystems/effect-dsp/ParameterSet"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import {
  Array as Arr,
  Boolean as Bool,
  Chunk,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Option,
  Record,
  Ref,
  Schema,
  Struct
} from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as TeacherTrace from "../src/TeacherTrace.js"
import { assertNoMutation } from "./kit/Mutation.js"

it.effect("rejects incompatible encoded field types before teacher execution", () =>
  Effect.gen(function*() {
    const student = yield* Module.predict(
      "qa",
      yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
    )
    const teacher = yield* Module.predict(
      "qa",
      yield* Signature.make("answer", { question: Schema.String }, {
        answer: Schema.String.check(Schema.isMinLength(3))
      })
    )
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "teacher" }))
    const failure = yield* TeacherTrace.collect(
      new TeacherTrace.Options({
        student,
        teacher: Option.some(teacher),
        trainset: Chunk.of(new Example.Example({ input: { question: "q" } })),
        metric: Metric.fromSync(() => 1)
      })
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.flip)
    expect(failure._tag).toBe("IncompatibleTeacher")
    expect(yield* Ref.get(mock.calls)).toHaveLength(0)
  }))

it.effect("retains every invocation of a repeated predictor and supplies bootstrap metric context", () =>
  Effect.gen(function*() {
    const signature = yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
    const leaf = yield* Module.predict("answer", signature)
    const student = yield* Module.compose(
      new Module.ComposeOptions({
        name: "pipeline",
        signature,
        subModules: { leaf },
        forward: ({ input }) =>
          leaf.forward(input).pipe(Effect.flatMap((first) => leaf.forward({ question: first.answer })))
      })
    )
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "teacher" }))
    const collected = yield* assertNoMutation(
      student,
      TeacherTrace.collect(
        new TeacherTrace.Options({
          student,
          trainset: Chunk.of(
            new Example.Example({ input: { question: "start" }, labels: Option.some({ answer: "label" }) })
          ),
          metric: Metric.withFeedback((_example, prediction, context) =>
            Effect.sync(() => {
              expect(context.phase).toBe("bootstrap")
              expect(context.trace).toEqual(Option.some(prediction.trace))
              expect(context.target).toEqual(Option.none())
              return new Metric.Score({ value: 0.01, feedback: Option.none() })
            }), "accept")
        })
      )
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    const accepted = Chunk.toReadonlyArray(collected.accepted)
    expect(accepted).toHaveLength(1)
    const first = Option.getOrThrow(Arr.head(accepted))
    expect(Chunk.toReadonlyArray(Option.getOrThrow(Record.get(first.demosByPredictor, "pipeline.leaf")))).toMatchObject(
      [
        { input: { question: "start" }, output: { answer: "teacher" }, augmented: true },
        { input: { question: "teacher" }, output: { answer: "teacher" }, augmented: true }
      ]
    )
    expect(
      Chunk.size(Option.getOrThrow(Record.get(TeacherTrace.firstPerPredictor(first).demosByPredictor, "pipeline.leaf")))
    ).toBe(1)
    expect(yield* Ref.get(mock.calls)).toHaveLength(2)
  }))

it.effect("rejects the identical teacher executable but accepts an immutable bound copy", () =>
  Effect.gen(function*() {
    const student = yield* Module.predict(
      "qa",
      yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
    )
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "teacher" }))
    const options = new TeacherTrace.Options({
      student,
      teacher: Option.some(student),
      trainset: Chunk.of(new Example.Example({ input: { question: "q" } })),
      metric: Metric.fromSync(() => 1)
    })
    const failure = yield* TeacherTrace.collect(options).pipe(
      Effect.provideService(LanguageModel.LanguageModel, mock.service),
      Effect.flip
    )
    expect(failure._tag).toBe("IncompatibleTeacher")
    expect(yield* Ref.get(mock.calls)).toHaveLength(0)
    const copy = Module.bound(student, yield* ParameterSet.snapshot(student))
    const result = yield* TeacherTrace.collect(
      new TeacherTrace.Options(Struct.assign(options, { teacher: Option.some(copy) }))
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    expect(Chunk.size(result.accepted)).toBe(1)
  }))

it.effect("compares effective instructions and field metadata under each bound parameter set", () =>
  Effect.gen(function*() {
    const student = yield* Module.predict(
      "qa",
      yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
    )
    const before = yield* ParameterSet.snapshot(student)
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "teacher" }))
    yield* Effect.forEach([
      Record.map(before, (parameters) => ModuleParameters.withInstructions(parameters, "different instructions")),
      Record.map(
        before,
        (parameters) =>
          new ModuleParameters.ModuleParameters(
            Struct.assign(parameters, {
              fields: { answer: { prefix: Option.some("Different:"), description: Option.none() } }
            })
          )
      )
    ], (parameters) =>
      Effect.gen(function*() {
        const failure = yield* TeacherTrace.collect(
          new TeacherTrace.Options({
            student,
            teacher: Option.some(Module.bound(student, parameters)),
            trainset: Chunk.of(new Example.Example({ input: { question: "q" } })),
            metric: Metric.fromSync(() => 1)
          })
        ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.flip)
        expect(failure._tag).toBe("IncompatibleTeacher")
      }))
    expect(yield* Ref.get(mock.calls)).toHaveLength(0)
  }))

it.effect("truthy scores accept without a threshold; an explicit threshold rejects lower scores", () =>
  Effect.gen(function*() {
    const signature = yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
    const student = yield* Module.predict("qa", signature)
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "teacher" }))
    yield* Effect.forEach([
      { value: 0, threshold: Option.none<number>(), count: 0 },
      { value: 0.01, threshold: Option.none<number>(), count: 1 },
      { value: 0.4, threshold: Option.some(0.5), count: 0 }
    ], ({ value, threshold, count }) =>
      Effect.gen(function*() {
        const result = yield* TeacherTrace.collect(
          new TeacherTrace.Options({
            student,
            trainset: Chunk.of(new Example.Example({ input: { question: "q" } })),
            metric: Metric.withFeedback(
              () => Effect.succeed(new Metric.Score({ value, feedback: Option.none() })),
              "score"
            ),
            threshold
          })
        ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
        expect(Chunk.size(result.accepted)).toBe(count)
        expect(Chunk.size(result.rejected)).toBe(1 - count)
      }))
  }))

it.effect("leaves the current labeled row out of teacher prompts without changing either caller", () =>
  Effect.gen(function*() {
    const signature = yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
    const student = yield* Module.predict("qa", signature)
    const parameters = yield* ParameterSet.snapshot(student)
    const current = new Example.Example({
      id: Option.some(Example.Id.make("current")),
      input: { question: "q" },
      labels: Option.some({ answer: "secret-current" })
    })
    const teacher = Module.bound(student, {
      qa: ModuleParameters.withDemos(Option.getOrThrow(Record.get(parameters, "qa")), [
        new Demonstration({ input: current.input, output: Option.getOrThrow(current.labels), exampleId: current.id }),
        new Demonstration({
          input: { question: "other" },
          output: { answer: "keep-other" },
          exampleId: Option.some(Example.Id.make("other"))
        })
      ])
    })
    const mock = yield* MockLanguageModel.make(
      MockLanguageModel.succeed("[[ ## answer ## ]]\nteacher\n[[ ## completed ## ]]")
    )
    const result = yield* assertNoMutation(
      student,
      assertNoMutation(
        teacher,
        TeacherTrace.collect(
          new TeacherTrace.Options({
            student,
            teacher: Option.some(teacher),
            trainset: Chunk.of(current),
            metric: Metric.fromSync(() => 1)
          })
        )
      )
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    expect(Chunk.toReadonlyArray(result.rejected)).toEqual([])
    const calls = yield* Ref.get(mock.calls)
    expect(calls).toHaveLength(1)
    const call = Option.getOrThrow(Arr.head(calls))
    expect(call.prompt).not.toContain("secret-current")
    expect(call.prompt).toContain("keep-other")
  }))

it.effect("maxErrors reaches its limit on the first failure and interruption preserves both callers", () =>
  Effect.gen(function*() {
    const signature = yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
    const student = yield* Module.predict("qa", signature)
    const teacher = Module.bound(student, yield* ParameterSet.snapshot(student))
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "teacher" }))
    const trainset = Chunk.of(new Example.Example({ input: { question: "q" } }))
    const failure = yield* assertNoMutation(
      student,
      TeacherTrace.collect(
        new TeacherTrace.Options({
          student,
          trainset,
          maxErrors: Option.some(1),
          metric: Metric.withFeedback(() => Effect.fail("rejected"))
        })
      )
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.flip)
    expect(failure).toEqual(new TeacherTrace.TooManyErrors({ count: 1, limit: 1 }))
    const started = yield* Deferred.make<void>()
    const fiber = yield* assertNoMutation(
      student,
      assertNoMutation(
        teacher,
        TeacherTrace.collect(
          new TeacherTrace.Options({
            student,
            teacher: Option.some(teacher),
            trainset,
            metric: Metric.withFeedback(() => Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.never)))
          })
        )
      )
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.forkChild)
    yield* Deferred.await(started)
    yield* Fiber.interrupt(fiber)
    expect(Exit.hasInterrupts(yield* Fiber.await(fiber))).toBe(true)
  }))

it.effect("emits teacher events in execution order and excludes observer errors from the error budget", () =>
  Effect.gen(function*() {
    const student = yield* Module.predict(
      "qa",
      yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
    )
    const history = yield* Ref.make(Arr.empty<string>())
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "teacher" }))
    const options = new TeacherTrace.Options({
      student,
      trainset: Chunk.fromIterable(
        Arr.map(["a", "b", "c"], (question) => new Example.Example({ input: { question } }))
      ),
      maxErrors: Option.some(1),
      metric: Metric.withFeedback((example) =>
        Ref.update(history, Arr.append(`metric:${Schema.decodeUnknownSync(Schema.String)(example.input.question)}`))
          .pipe(
            Effect.as(
              new Metric.Score({
                value: Bool.match(example.input.question === "b", { onFalse: () => 1, onTrue: () => 0 }),
                feedback: Option.none()
              })
            )
          )
      )
    })
    const error = yield* TeacherTrace.collect(options, (event) =>
      Ref.update(history, Arr.append(event._tag)).pipe(
        Effect.andThen(
          Bool.match(event._tag === "ExampleRejected", {
            onFalse: () => Effect.void,
            onTrue: () => Effect.fail("observer failed")
          })
        )
      )).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.flip)
    expect(error).toBe("observer failed")
    expect(yield* Ref.get(history)).toEqual([
      "RoundStarted",
      "metric:a",
      "ExampleAccepted",
      "metric:b",
      "ExampleRejected"
    ])
    expect(yield* Ref.get(mock.calls)).toHaveLength(2)
  }))
