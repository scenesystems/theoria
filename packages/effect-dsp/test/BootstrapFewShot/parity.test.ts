import { expect, it } from "@effect/vitest"
import * as BootstrapFewShot from "@scenesystems/effect-dsp/BootstrapFewShot"
import { Example, Id } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as TeacherTrace from "@scenesystems/effect-dsp/TeacherTrace"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import { Array as Arr, Chunk, Effect, Number as Num, Option, Record, Ref, Schema, String as Str } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { fixture } from "../kit/Fixtures.js"
import { assertNoMutation } from "../kit/Mutation.js"

const Row = Schema.Struct({ id: Schema.String, question: Schema.String, answer: Schema.String })
const Demo = Schema.Struct({ question: Schema.String, answer: Schema.String })
const Payload = Schema.Struct({
  splits: Schema.Struct({ train: Schema.Array(Row) }),
  maxErrors: Schema.Int,
  metricThreshold: Schema.OptionFromNullOr(Schema.Finite),
  metricCalls: Schema.Array(Schema.Struct({ id: Schema.String })),
  state: Schema.optional(Schema.Record(Schema.String, Schema.Struct({ demos: Schema.Array(Demo) }))),
  error: Schema.optional(Schema.String)
})

it.effect("bootstrap fixtures: retain cross-example duplicates, threshold, teacher provenance, and error budget", () =>
  Effect.forEach([
    "bootstrapfewshot-001",
    "bootstrap-teacher-trace-001",
    "bootstrapfewshot-threshold-001",
    "bootstrapfewshot-errors-001"
  ], (id) =>
    Effect.gen(function*() {
      const reference = yield* Schema.decodeUnknownEffect(Payload)((yield* fixture(id, "upstream-execution")).payload)
      const signature = yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
      const first = yield* Module.predict("first", signature)
      const second = yield* Module.predict("second", signature)
      const module = yield* Module.compose(
        new Module.ComposeOptions({
          name: "pipeline",
          signature,
          subModules: { first, second },
          forward: ({ input }) =>
            first.forward(input).pipe(Effect.flatMap((output) => second.forward({ question: output.answer })))
        })
      )
      const teacher = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "teacher" }))
      const student = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "student" }))
      const calls = yield* Ref.make(Arr.empty<string>())
      const compilation = assertNoMutation(
        module,
        BootstrapFewShot.run(
          new BootstrapFewShot.Options({
            module,
            trainset: Arr.map(reference.splits.train, (row) =>
              new Example({
                id: Option.some(Id.make(row.id)),
                input: { question: row.question },
                labels: Option.some({ answer: row.answer })
              })),
            maxBootstrappedDemos: 2,
            maxLabeledDemos: 0,
            maxRounds: 1,
            maxErrors: Option.some(reference.maxErrors),
            metricThreshold: reference.metricThreshold,
            metric: Metric.withFeedback((example, prediction, context) =>
              Effect.gen(function*() {
                expect(prediction.output).toEqual({ answer: "teacher" })
                expect(context.phase).toBe("bootstrap")
                expect(Chunk.size(Option.getOrThrow(context.trace).selected)).toBe(2)
                yield* Ref.update(calls, Arr.append(Option.getOrThrow(example.id)))
                if (reference.error) return yield* Effect.fail("metric failure")
                return new Metric.Score({
                  value: example.input.question === "train-0" && Option.isSome(reference.metricThreshold) ? 0.4 : 0.8,
                  feedback: Option.none()
                })
              })
            )
          })
        )
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
      if (reference.error) {
        expect(yield* Effect.flip(compilation)).toEqual(
          new TeacherTrace.TooManyErrors({ count: 1, limit: reference.maxErrors })
        )
      } else {
        const result = yield* compilation
        yield* Effect.forEach(Record.toEntries(reference.state ?? {}), ([name, state]) =>
          Effect.sync(() => {
            expect(
              Arr.map(
                Option.getOrThrow(Record.get(result.parameters, `pipeline.${name}`)).demos,
                (demo) => ({ question: demo.input.question, answer: demo.output.answer })
              )
            ).toEqual(state.demos)
          }))
      }
      expect(yield* Ref.get(calls)).toEqual(Arr.map(reference.metricCalls, (call) => call.id))
      expect(yield* Ref.get(student.calls)).toHaveLength(0)
      expect(yield* Ref.get(teacher.calls)).toHaveLength(reference.metricCalls.length * 2)
    })))

it.effect("bootstrapfewshot-labeled-001: prewarms the default teacher and excludes each traced label", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Schema.Struct({
      splits: Schema.Struct({ train: Schema.Array(Row) }),
      metricCalls: Schema.Array(Schema.Struct({ id: Schema.String })),
      history: Schema.Array(Schema.Struct({
        messages: Schema.Array(Schema.Struct({ role: Schema.String, content: Schema.String }))
      })),
      state: Schema.Struct({ demos: Schema.Array(Demo) })
    }))((yield* fixture("bootstrapfewshot-labeled-001", "upstream-execution")).payload)
    const signature = yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
    const module = yield* Module.predict("qa", signature)
    const mock = yield* MockLanguageModel.make(
      MockLanguageModel.succeed("[[ ## answer ## ]]\nteacher\n[[ ## completed ## ]]")
    )
    const calls = yield* Ref.make(Arr.empty<string>())
    const result = yield* assertNoMutation(
      module,
      BootstrapFewShot.run(
        new BootstrapFewShot.Options({
          module,
          trainset: Arr.map(reference.splits.train, (row) =>
            new Example({
              id: Option.some(Id.make(row.id)),
              input: { question: row.question },
              labels: Option.some({ answer: row.answer })
            })),
          maxBootstrappedDemos: 1,
          maxLabeledDemos: 2,
          maxRounds: 1,
          metric: Metric.withFeedback((example) =>
            Ref.update(calls, Arr.append(Option.getOrThrow(example.id))).pipe(
              Effect.as(
                new Metric.Score({ value: example.input.question === "train-3" ? 1 : 0, feedback: Option.none() })
              )
            )
          )
        })
      )
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    const history = yield* Ref.get(mock.calls)
    expect(yield* Ref.get(calls)).toEqual(Arr.map(reference.metricCalls, (call) => call.id))
    const upstreamCounts = Arr.map(
      reference.history,
      (call) => Arr.length(Arr.filter(call.messages, (message) => message.role === "assistant"))
    )
    expect(Arr.sort(upstreamCounts, Num.Order)).toEqual([1, 1, 2, 2])
    expect(
      Arr.sort(
        Arr.map(
          history,
          (call) => Arr.length(Arr.filter(reference.splits.train, (row) => Str.includes(row.answer)(call.prompt)))
        ),
        Num.Order
      )
    )
      .toEqual(Arr.sort(upstreamCounts, Num.Order))
    yield* Effect.forEach(Arr.zip(history, reference.splits.train), ([call, row]) =>
      Effect.sync(() => {
        expect(call.prompt).not.toContain(row.answer)
      }))
    yield* Effect.forEach(Arr.zip(reference.history, reference.splits.train), ([call, row]) =>
      Effect.sync(() => {
        expect(Arr.join(Arr.map(call.messages, (message) => message.content), "\n")).not.toContain(row.answer)
      }))
    const demos = Option.getOrThrow(Record.get(result.parameters, "qa")).demos
    expect(demos).toHaveLength(reference.state.demos.length)
    expect(Arr.map(Arr.filter(demos, (demo) => demo.output.answer === "teacher"), (demo) => demo.input))
      .toEqual([{ question: "train-3" }])
    expect(Arr.filter(demos, (demo) => demo.output.answer !== "teacher")).toHaveLength(1)
    expect(Arr.some(demos, (demo) => demo.output.answer === "label-3")).toBe(false)
    expect(result.report.acceptedCount).toBe(1)
    expect(result.report.rejectedCount).toBe(3)
  }))
