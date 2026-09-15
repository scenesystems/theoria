/**
 * Marker text replays the signature's encoded fields before domain decoding.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import * as Toolkit from "@effect/ai/Toolkit"
import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import { ModuleParams } from "@scenesystems/effect-dsp/contracts"
import { ParseOutputError } from "@scenesystems/effect-dsp/Errors"
import { Demo, Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
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
  Match,
  Number,
  Option,
  Ref,
  Schedule,
  Schema,
  String
} from "effect"

const Input = Schema.Struct({ question: Schema.String })
const Counter = Schema.Struct({ count: Schema.NumberFromString })
const noRetries = new Module.PredictOptions({ policy: { parse: { maxRetries: 0 } } })

const renamedSignature = Signature.make("Count the supplied question", {
  question: Schema.propertySignature(Schema.String).pipe(Schema.fromKey("prompt")).annotations({
    [Signature.FieldDescriptionId]: "Input text"
  })
}, {
  optional: Schema.optionalWith(Schema.NumberFromString, { default: () => 11 }),
  result: Schema.propertySignature(Counter).pipe(Schema.fromKey("wire")).annotations({
    [Signature.FieldDescriptionId]: "Measured count"
  })
})

class Offset extends Context.Tag("text-wire-replay/Offset")<Offset, number>() {}

const makeTextPredict = <O extends Schema.Struct.Fields>(output: Schema.Struct<O>, name = "text-wire") =>
  Effect.gen(function*() {
    const signature = yield* Signature.make("Replay encoded fields", Input.fields, output.fields)
    const module = yield* Module.predict(name, signature, noRetries)
    yield* Ref.update(module.params, (params) => new ModuleParams({ ...params, outputStrategy: "text" }))
    return module
  })

describe("Module marker wire replay", () => {
  it.effect("decodes responses following the emitted renamed template in auto prediction and ReAct", () =>
    Effect.forEach(Schema.Literal("predict", "react").literals, (kind) =>
      Effect.gen(function*() {
        const signature = yield* renamedSignature
        const toolkit = yield* Toolkit.empty.pipe(Effect.provide(Toolkit.empty.toLayer({})))
        const module = yield* Match.value(kind).pipe(
          Match.when("predict", () => Module.predict("renamed-predict", signature, noRetries)),
          Match.when("react", () => Module.react({ name: "renamed-react", signature, toolkit, maxIterations: 1 })),
          Match.exhaustive
        )
        yield* Ref.update(module.params, (params) =>
          new ModuleParams({
            ...params,
            demos: Arr.make(new Demo({ input: { prompt: "training" }, output: { wire: { count: "03" } } }))
          }))
        const mock = yield* MockLanguageModel.make(MockLanguageModel.fromFunction((prompt) =>
          Effect.gen(function*() {
            expect(prompt).toContain("Input fields:\n- prompt: Input text")
            expect(prompt).toContain("- wire: Measured count")
            expect(prompt).toContain("[[ ## prompt ## ]]\ntraining")
            expect(prompt).toContain("[[ ## wire ## ]]\n{\"count\":\"03\"}")
            const template = yield* String.match(/Output template:\n([\s\S]*?)\[\[ ## completed ## \]\]/)(prompt)
            const body = yield* Arr.get(template, 1)
            const markers = String.matchAll(/\[\[ ## ([^#]+) ## \]\]/g)(body)
            const marker = yield* Arr.last(Arr.fromIterable(markers))
            const name = yield* Arr.get(marker, 1)
            return Arr.join(Arr.make("[[ ## ", name, " ## ]]\n{\"count\":\"7\"}"), "")
          })
        ))
        expect(
          yield* module.forward({ question: "count" }).pipe(
            Effect.provideService(LanguageModel.LanguageModel, mock.service)
          )
        ).toEqual({ optional: 11, result: { count: 7 } })
      })))

  it.effect("reports missing encoded fields rather than missing decoded names", () =>
    Effect.gen(function*() {
      const signature = yield* renamedSignature
      const module = yield* Module.predict("renamed-errors", signature, noRetries)
      yield* Ref.update(module.params, (params) => new ModuleParams({ ...params, outputStrategy: "text" }))
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed("[[ ## result ## ]]\n{}"))
      const failure = yield* module.forward({ question: "count" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip,
        Effect.flatMap(Schema.decodeUnknown(ParseOutputError))
      )
      expect(Arr.some(failure.fieldDiagnostics, (diagnostic) =>
        Boolean.and(Equal.equals(diagnostic.field, "wire"), Equal.equals(diagnostic.issue, "missing-field"))))
        .toBe(true)
      expect(Arr.some(failure.fieldDiagnostics, (diagnostic) =>
        Boolean.and(Equal.equals(diagnostic.field, "result"), Equal.equals(diagnostic.issue, "missing-field"))))
        .toBe(false)
    }))

  it.effect("replays a bootstrapped nested NumberFromString demo after default auto switches to text", () =>
    Effect.gen(function*() {
      const output = Schema.Struct({ result: Counter })
      const signature = yield* Signature.make("Count", Input.fields, output.fields)
      const module = yield* Module.predict("bootstrap-replay", signature, noRetries)
      const teacher = yield* MockLanguageModel.make(MockLanguageModel.fixed({ result: { count: "7" } }))
      const metric = Metric.make("exact-count", (prediction: typeof output.Type, expected) =>
        new Metric.Result({
          score: Boolean.match(Equal.equals(prediction.result.count, expected.result.count), {
            onTrue: () => 1,
            onFalse: () => 0
          })
        }))
      yield* Optimizer.bootstrapFewShot({
        module,
        trainset: Arr.make(new Example({ input: { question: "training" }, output: { result: { count: "7" } } })),
        metric,
        maxRounds: 1,
        maxBootstrappedDemos: 1,
        threshold: 1,
        fallbackToLabeledFewShot: false
      }).pipe(Effect.provideService(LanguageModel.LanguageModel, teacher.service))
      const params = yield* Ref.get(module.params)
      const demo = yield* Arr.head(params.demos)
      expect(params.outputStrategy).toBe("auto")
      expect(demo.output).toEqual({ result: { count: "7" } })
      const replay = yield* MockLanguageModel.make(MockLanguageModel.fixed("[[ ## result ## ]]\n{\"count\":\"7\"}"))
      const result = yield* module.forward({ question: "replay" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, replay.service)
      )
      const teacherCall = yield* Ref.get(teacher.calls).pipe(Effect.flatMap(Arr.head))
      const replayCall = yield* Ref.get(replay.calls).pipe(Effect.flatMap(Arr.head))
      expect(result).toEqual({ result: { count: 7 } })
      expect(teacherCall.method).toBe("generateObject")
      expect(replayCall.method).toBe("generateText")
      expect(replayCall.prompt).toContain("[[ ## result ## ]]\n{\"count\":\"7\"}")
    }))

  it.effect("decodes structured and primitive wires while retaining literal string text", () =>
    Effect.gen(function*() {
      const output = Schema.Struct({
        result: Schema.Struct({ count: Schema.NumberFromString, values: Schema.Array(Schema.NumberFromString) }),
        rows: Schema.Array(Counter),
        literal: Schema.String,
        quoted: Schema.String,
        booleanText: Schema.String,
        wireString: Schema.NumberFromString,
        numeric: Schema.Number,
        enabled: Schema.Boolean,
        empty: Schema.Null
      })
      const module = yield* makeTextPredict(output)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed(Arr.join(
        Arr.make(
          "[[ ## result ## ]]\n{\"count\":\"7\",\"values\":[\"03\",\"11\"]}",
          "[[ ## rows ## ]]\n[{\"count\":\"2\"},{\"count\":\"13\"}]",
          "[[ ## literal ## ]]\n{\"count\":\"007\"}",
          "[[ ## quoted ## ]]\n\"kept quoted\"",
          "[[ ## booleanText ## ]]\nfalse",
          "[[ ## wireString ## ]]\n007",
          "[[ ## numeric ## ]]\n17",
          "[[ ## enabled ## ]]\nfalse",
          "[[ ## empty ## ]]\nnull"
        ),
        "\n\n"
      )))
      const result = yield* module.forward({ question: "mixed wires" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )
      expect(result).toEqual({
        result: { count: 7, values: Arr.make(3, 11) },
        rows: Arr.make({ count: 2 }, { count: 13 }),
        literal: "{\"count\":\"007\"}",
        quoted: "\"kept quoted\"",
        booleanText: "false",
        wireString: 7,
        numeric: 17,
        enabled: false,
        empty: null
      })
      expect(Arr.length(yield* Ref.get(mock.calls))).toBe(1)
    }))

  it.effect("preserves absent, empty, defaulted, nullable and Option output properties", () =>
    Effect.gen(function*() {
      const output = Schema.Struct({
        answer: Schema.String,
        text: Schema.optional(Schema.String),
        result: Schema.optional(Counter),
        defaultCount: Schema.optionalWith(Schema.NumberFromString, { default: () => 11 }),
        maybe: Schema.optionalWith(Counter, { as: "Option", nullable: true })
      })
      const module = yield* makeTextPredict(output)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.sequence(Arr.make(
        "[[ ## answer ## ]]\nabsent",
        Arr.join(
          Arr.make(
            "[[ ## answer ## ]]\npresent",
            "[[ ## text ## ]]\n",
            "[[ ## result ## ]]\n{\"count\":\"7\"}",
            "[[ ## defaultCount ## ]]\n03",
            "[[ ## maybe ## ]]\n{\"count\":\"13\"}"
          ),
          "\n\n"
        ),
        "[[ ## answer ## ]]\nnullable\n[[ ## maybe ## ]]\nnull"
      )))
      const absent = yield* module.forward({ question: "absent" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )
      const present = yield* module.forward({ question: "present" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )
      const nullable = yield* module.forward({ question: "nullable" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )
      expect(absent).toEqual({ answer: "absent", defaultCount: 11, maybe: Option.none() })
      expect(present).toEqual({
        answer: "present",
        text: "",
        result: { count: 7 },
        defaultCount: 3,
        maybe: Option.some({ count: 13 })
      })
      expect(nullable).toEqual({ answer: "nullable", defaultCount: 11, maybe: Option.none() })
    }))

  it.effect("keeps schema services and runs each domain transform once in predict and ReAct", () =>
    Effect.gen(function*() {
      const decodes = yield* Ref.make(0)
      const counted = Schema.transformOrFail(Schema.NumberFromString, Schema.Number, {
        strict: true,
        decode: (value) =>
          Effect.map(Offset, (offset) => Number.sum(value, offset)).pipe(
            Effect.tap(() => Ref.update(decodes, Number.increment))
          ),
        encode: (value) => Effect.map(Offset, (offset) => Number.subtract(value, offset))
      })
      const output = Schema.Struct({ result: Schema.Struct({ count: counted }), direct: counted })
      const signature = yield* Signature.make("Transform with services", Input.fields, output.fields)
      const predict = yield* makeTextPredict(output)
      const tools = Toolkit.make()
      const toolkit = yield* tools.pipe(Effect.provide(tools.toLayer({})))
      const react = yield* Module.react({ name: "react-wire", signature, toolkit, maxIterations: 1 })
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed(
        "[[ ## result ## ]]\n{\"count\":\"7\"}\n[[ ## direct ## ]]\n03"
      ))
      const prediction = predict.forward({ question: "predict" })
      const reaction = react.forward({ question: "react" })
      expectTypeOf<Effect.Effect.Context<typeof prediction>>().toEqualTypeOf<LanguageModel.LanguageModel | Offset>()
      expectTypeOf<Effect.Effect.Context<typeof reaction>>().toEqualTypeOf<LanguageModel.LanguageModel | Offset>()
      expect(yield* Ref.get(decodes)).toBe(0)
      expect(
        yield* prediction.pipe(
          Effect.provideService(LanguageModel.LanguageModel, mock.service),
          Effect.provideService(Offset, 100)
        )
      ).toEqual({ result: { count: 107 }, direct: 103 })
      expect(yield* Ref.get(decodes)).toBe(2)
      expect(
        yield* reaction.pipe(
          Effect.provideService(LanguageModel.LanguageModel, mock.service),
          Effect.provideService(Offset, 200)
        )
      ).toEqual({ result: { count: 207 }, direct: 203 })
      expect(yield* Ref.get(decodes)).toBe(4)
      expect(Arr.map(yield* Ref.get(mock.calls), (call) => call.method)).toEqual(
        Arr.make("generateText", "generateText")
      )
    }))

  it.effect("prefers accepted raw strings in unions and honors encoded string refinements before JSON fallback", () =>
    Effect.gen(function*() {
      const module = yield* makeTextPredict(Schema.Struct({
        stringFirst: Schema.Union(Schema.String, Counter),
        objectFirst: Schema.Union(Counter, Schema.String),
        stringOrNumber: Schema.Union(Schema.Number, Schema.String),
        refined: Schema.Union(Schema.String.pipe(Schema.startsWith("id:")), Schema.Number),
        accepted: Schema.Union(Schema.String.pipe(Schema.startsWith("id:")), Schema.Number)
      }))
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed(Arr.join(
        Arr.make(
          "[[ ## stringFirst ## ]]\n{\"count\":\"7\"}",
          "[[ ## objectFirst ## ]]\n{\"count\":\"7\"}",
          "[[ ## stringOrNumber ## ]]\n17",
          "[[ ## refined ## ]]\n17",
          "[[ ## accepted ## ]]\nid:17"
        ),
        "\n\n"
      )))
      expect(
        yield* module.forward({ question: "ambiguous" }).pipe(
          Effect.provideService(LanguageModel.LanguageModel, mock.service)
        )
      ).toEqual({
        stringFirst: "{\"count\":\"7\"}",
        objectFirst: "{\"count\":\"7\"}",
        stringOrNumber: "17",
        refined: 17,
        accepted: "id:17"
      })
    }))

  it.effect("does not unquote rejected literal strings or use JSON fallback after a domain failure", () =>
    Effect.gen(function*() {
      const literal = yield* makeTextPredict(Schema.Struct({ answer: Schema.Literal("accepted") }))
      const quoted = yield* MockLanguageModel.make(MockLanguageModel.fixed("[[ ## answer ## ]]\n\"accepted\""))
      const literalFailure = yield* literal.forward({ question: "quoted" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, quoted.service),
        Effect.flip
      )
      expect(literalFailure).toBeInstanceOf(ParseOutputError)
      const decodes = yield* Ref.make(0)
      const guarded = Schema.String.pipe(
        Schema.filterEffect((value) =>
          Effect.map(Offset, (minimum) => Number.greaterThan(String.length(value), minimum)).pipe(
            Effect.tap(() => Ref.update(decodes, Number.increment))
          )
        )
      )
      const module = yield* makeTextPredict(
        Schema.Struct({ result: Schema.Union(guarded, Schema.Number) }),
        "guarded-wire"
      )
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed("[[ ## result ## ]]\n7"))
      const operation = module.forward({ question: "domain failure" })
      expectTypeOf<Effect.Effect.Context<typeof operation>>().toEqualTypeOf<LanguageModel.LanguageModel | Offset>()
      const failure = yield* operation.pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.provideService(Offset, 10),
        Effect.flip,
        Effect.flatMap(Schema.decodeUnknown(ParseOutputError))
      )
      expect(yield* Ref.get(decodes)).toBe(1)
      expect(failure.retryCount).toEqual(Option.some(0))
      expect(
        Arr.some(
          failure.fieldDiagnostics,
          (diagnostic) =>
            Boolean.and(Equal.equals(diagnostic.field, "result"), Equal.equals(diagnostic.issue, "decode-error"))
        )
      )
        .toBe(true)
    }))

  it.effect("retries invalid nested JSON with field diagnostics and decodes the corrected wire", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Retry nested wires", Input.fields, { result: Counter })
      const module = yield* Module.predict("wire-retry", signature, {
        policy: { parse: { maxRetries: 1, retrySchedule: Schedule.recurs } }
      })
      yield* Ref.update(module.params, (params) => new ModuleParams({ ...params, outputStrategy: "text" }))
      const invalid = "[[ ## result ## ]]\n{\"count\":"
      const mock = yield* MockLanguageModel.make(MockLanguageModel.sequence(Arr.make(
        invalid,
        "[[ ## result ## ]]\n{\"count\":\"13\"}"
      )))
      expect(
        yield* module.forward({ question: "correct the JSON" }).pipe(
          Effect.provideService(LanguageModel.LanguageModel, mock.service)
        )
      ).toEqual({ result: { count: 13 } })
      const calls = yield* Ref.get(mock.calls)
      const retry = yield* Arr.get(calls, 1)
      expect(Arr.length(calls)).toBe(2)
      expect(retry.prompt).toContain("Parse error (0): Unable to decode text output against module schema")
      expect(retry.prompt).toContain("result (decode-error)")
    }))
})
