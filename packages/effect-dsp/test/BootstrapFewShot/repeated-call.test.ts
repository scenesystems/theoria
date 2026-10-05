import { expect, it } from "@effect/vitest"
import * as BootstrapFewShot from "@scenesystems/effect-dsp/BootstrapFewShot"
import { Example, Id } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as TeacherTrace from "@scenesystems/effect-dsp/TeacherTrace"
import { Array as Arr, Chunk, Effect, Option, Record, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { fixture } from "../kit/Fixtures.js"
import { assertNoMutation } from "../kit/Mutation.js"

it.effect("bootstrap-repeated-call-001: lossless collection and one retained trace member per example", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Schema.Struct({
      examples: Schema.Array(Schema.Struct({
        id: Schema.String,
        demos: Schema.Array(Schema.Struct({ question: Schema.String, answer: Schema.String })),
        retainedCount: Schema.Int,
        retainedFromTrace: Schema.Boolean
      }))
    }))((yield* fixture("bootstrap-repeated-call-001", "upstream-execution")).payload)
    const signature = yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
    const predictor = yield* Module.predict("predictor", signature)
    const module = yield* Module.compose(
      new Module.ComposeOptions({
        name: "root",
        signature,
        subModules: { predictor },
        forward: ({ input }) =>
          predictor.forward({ question: `${input.question}/first` }).pipe(
            Effect.andThen(predictor.forward({ question: `${input.question}/second` }))
          )
      })
    )
    const trainset = Arr.map(reference.examples, (entry) =>
      new Example({
        id: Option.some(Id.make(entry.id)),
        input: { question: entry.id }
      }))
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "teacher" }))
    const collected = yield* assertNoMutation(
      module,
      TeacherTrace.collect(
        new TeacherTrace.Options({
          student: module,
          trainset: Chunk.fromIterable(trainset),
          metric: Metric.fromSync(() => 1)
        })
      )
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    const result = yield* assertNoMutation(
      module,
      BootstrapFewShot.run(
        new BootstrapFewShot.Options({
          module,
          trainset,
          metric: Metric.fromSync(() => 1),
          maxBootstrappedDemos: 2,
          maxLabeledDemos: 0
        })
      )
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    const retained = Option.getOrThrow(Record.get(result.parameters, "root.predictor")).demos
    expect(retained).toHaveLength(reference.examples.length)
    yield* Effect.forEach(reference.examples, (entry) =>
      Effect.sync(() => {
        expect(entry.retainedCount).toBe(1)
        expect(entry.retainedFromTrace).toBe(true)
        const trace = Option.getOrThrow(
          Chunk.findFirst(collected.accepted, (accepted) => accepted.exampleId === entry.id)
        )
        expect(
          Arr.map(
            Arr.fromIterable(Option.getOrThrow(Record.get(trace.demosByPredictor, "root.predictor"))),
            (demo) => ({ question: demo.input.question, answer: demo.output.answer })
          )
        ).toEqual(entry.demos)
        const selected = Arr.filter(retained, (demo) => Option.contains(Id.make(entry.id))(demo.exampleId))
        expect(selected).toHaveLength(entry.retainedCount)
        const demo = Option.getOrThrow(Arr.head(selected))
        expect(entry.demos).toContainEqual({ question: demo.input.question, answer: demo.output.answer })
      }))
  }))
