/**
 * Demonstration projection and filtering at the provider boundary, against a
 * real DSPy LabeledFewShot + ChatAdapter execution over raw dataset rows.
 */
import { expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Option, Order, Record, Ref, Schema, String as Str } from "effect"
import * as Prompt from "effect/ai/Prompt"
import * as Response from "effect/ai/Response"
import { Demonstration } from "../../src/Demonstration.js"
import { Example } from "../../src/Example.js"
import { promptToTraceText } from "../../src/internal/prompt/trace.js"
import * as LabeledFewShot from "../../src/LabeledFewShot.js"
import * as Module from "../../src/Module.js"
import { ModuleParameters } from "../../src/ModuleParameters.js"
import * as Signature from "../../src/Signature.js"
import { fixture } from "../kit/Fixtures.js"
import { recordingLm } from "../kit/Lm.js"

const Turn = Schema.Struct({ role: Schema.String, content: Schema.String })
type Turn = typeof Turn.Type
const Raw = Schema.Record(Schema.String, Schema.String)
const Message = Schema.Struct({ role: Schema.Literals(["system", "user", "assistant"]), content: Schema.String })
const Reference = Schema.Struct({
  signature: Schema.Struct({ inputs: Schema.Array(Schema.String), outputs: Schema.Array(Schema.String) }),
  trainset: Schema.NonEmptyArray(Schema.Struct({ row: Raw, inputKeys: Schema.Array(Schema.String) })),
  state: Schema.Struct({ demos: Schema.Array(Raw) }),
  prediction: Raw,
  history: Schema.NonEmptyArray(Schema.Struct({ messages: Schema.NonEmptyArray(Message) }))
})

const reference = Effect.gen(function*() {
  return yield* Schema.decodeUnknownEffect(Reference)(
    (yield* fixture("chat-adapter-demo-projection-001", "upstream-execution")).payload
  )
})

const signature = Signature.make("reason", { question: Schema.String }, {
  reasoning: Schema.String,
  answer: Schema.String
})

const split = (row: Record.ReadonlyRecord<string, string>, inputKeys: ReadonlyArray<string>) => ({
  input: Record.filter(row, (_, key) => Arr.contains(inputKeys, key)),
  output: Record.filter(row, (_, key) => !Arr.contains(inputKeys, key))
})

const completion = "[[ ## reasoning ## ]]\nwhy\n\n[[ ## answer ## ]]\nnew"

/** Calls the program once and returns the provider-boundary messages it sent. */
const capturedMessages = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, E, R>(
  module: Module.Module<I, O, E, R>,
  input: Schema.Schema.Type<Schema.Struct<I>>
) =>
  Effect.gen(function*() {
    const lm = yield* recordingLm(() => Effect.succeed([Response.TextPart.make({ text: completion, metadata: {} })]))
    const output = yield* module.forward(input).pipe(Effect.provide(lm.layer))
    const request = Option.getOrThrow(Chunk.head(yield* Ref.get(lm.requests)))
    const messages = yield* Effect.forEach(Prompt.make(request.prompt).content, (message) =>
      promptToTraceText(Prompt.fromMessages([message])).pipe(
        Effect.map((content) => ({ role: message.role, content }))
      ))
    return { output, messages }
  })

/** User/assistant demonstration pairs between the system message and the final request. */
const demoTurns = (messages: ReadonlyArray<Turn>) => Arr.dropRight(Arr.drop(messages, 1), 1)

const questions = (turns: ReadonlyArray<Turn>, values: ReadonlyArray<string>) =>
  Arr.sort(
    Arr.filter(values, (value) => Arr.some(turns, (turn) => turn.role === "user" && Str.includes(value)(turn.content))),
    Order.String
  )

/** Raw values in dataset keys outside the destination signature; row ids are substrings of questions. */
const unknownValues = (rows: ReadonlyArray<Record.ReadonlyRecord<string, string>>, fields: ReadonlyArray<string>) =>
  Arr.flatMap(rows, (row) => Record.values(Record.filter(row, (_, key) => key !== "id" && !Arr.contains(fields, key))))

it.effect("chat-adapter-demo-projection-001: raw recorded demos render only signature fields and skip no-output rows", () =>
  Effect.gen(function*() {
    const upstream = yield* reference
    const module = yield* Module.predict("qa", yield* signature)
    const outputs = upstream.signature.outputs
    const demos = Arr.map(upstream.state.demos, (row) => {
      const inputKeys = Option.getOrThrow(
        Arr.findFirst(upstream.trainset, (entry) => entry.row.id === row.id)
      ).inputKeys
      const { input, output } = split(row, inputKeys)
      return new Demonstration({
        input,
        output,
        incomplete: !Arr.every(outputs, (field) => Record.has(output, field))
      })
    })
    yield* Module.install(module, {
      qa: new ModuleParameters({ instructions: module.signature.instructions, demos, outputStrategy: "auto" })
    })
    const { output, messages } = yield* capturedMessages(module, { question: "q-next" })
    expect(output).toEqual(upstream.prediction)

    const upstreamTurns = demoTurns(Arr.headNonEmpty(upstream.history).messages)
    const turns = demoTurns(messages)
    const allQuestions = Arr.map(upstream.trainset, (entry) => Option.getOrThrow(Record.get(entry.row, "question")))
    expect(turns).toHaveLength(upstreamTurns.length)
    expect(questions(turns, allQuestions)).toEqual(questions(upstreamTurns, allQuestions))
    expect(Arr.every(turns, (turn) => Str.isNonEmpty(Str.trim(turn.content)))).toBe(true)
    expect(Arr.map(turns, (turn) => turn.role)).toEqual(Arr.map(upstreamTurns, (turn) => turn.role))

    const fields = Arr.appendAll(upstream.signature.inputs, outputs)
    const hidden = unknownValues(upstream.state.demos, fields)
    expect(hidden).not.toHaveLength(0)
    Arr.forEach(hidden, (value) => {
      expect(Arr.some(upstreamTurns, (turn) => Str.includes(value)(turn.content))).toBe(false)
      expect(Arr.some(messages, (message) => Str.includes(value)(message.content))).toBe(false)
    })
    const partialAnswer = (turnsOf: ReadonlyArray<Turn>) =>
      Arr.some(turnsOf, (turn) => turn.role === "assistant" && Str.includes("a-partial")(turn.content))
    expect(partialAnswer(turns)).toBe(true)
    expect(partialAnswer(upstreamTurns)).toBe(true)

    const restored = yield* Module.predict("qa", yield* signature)
    yield* Module.load(restored, yield* Module.save(module))
    expect((yield* capturedMessages(restored, { question: "q-next" })).messages).toEqual(messages)
  }))

it.effect("chat-adapter-demo-projection-001: LabeledFewShot keeps every sampled row, the provider sees only renderable demos", () =>
  Effect.gen(function*() {
    const upstream = yield* reference
    const module = yield* Module.predict("qa", yield* signature)
    const trainset = Arr.map(upstream.trainset, ({ row, inputKeys }) => {
      const { input, output } = split(row, inputKeys)
      return new Example({ input, labels: Option.some(output) })
    })
    const result = yield* LabeledFewShot.run(
      new LabeledFewShot.Options({ module, trainset, k: upstream.state.demos.length, sample: false })
    )
    const demos = Option.getOrThrow(Record.get(result.parameters, "qa")).demos
    expect(demos).toHaveLength(upstream.state.demos.length)
    expect(Arr.map(demos, (demo) => demo.output)).toEqual([
      { reasoning: "r-complete", answer: "a-complete" },
      { answer: "a-partial" },
      {}
    ])
    const { messages } = yield* capturedMessages(result.program, { question: "q-next" })
    const upstreamTurns = demoTurns(Arr.headNonEmpty(upstream.history).messages)
    const turns = demoTurns(messages)
    const allQuestions = Arr.map(upstream.trainset, (entry) => Option.getOrThrow(Record.get(entry.row, "question")))
    expect(questions(turns, allQuestions)).toEqual(questions(upstreamTurns, allQuestions))
    expect(Arr.every(turns, (turn) => Str.isNonEmpty(Str.trim(turn.content)))).toBe(true)
  }))

it.effect("raw demo projection ignores unknown top-level fields only; values and required fields stay strict", () =>
  Effect.gen(function*() {
    const nested = yield* Signature.make("Nested values", {
      facts: Schema.Struct({ count: Schema.FiniteFromString })
    }, { answer: Schema.Struct({ label: Schema.String }) })
    const codec = nested.demonstrationCodec
    const raw = new Demonstration({
      input: { facts: { count: "7" }, provenance: "source-A" },
      output: { answer: { label: "yes" }, confidence: 0.9 }
    })
    const projected = new Demonstration({ input: { facts: { count: "7" } }, output: { answer: { label: "yes" } } })
    expect(yield* codec.decode(raw)).toEqual(projected)
    expect(yield* codec.encode(raw)).toEqual(yield* codec.encode(projected))
    const failures = yield* Effect.forEach([
      new Demonstration({ input: { facts: { count: "7", provenance: "nested" } }, output: projected.output }),
      new Demonstration({ input: { provenance: "source-A" }, output: projected.output }),
      new Demonstration({ input: projected.input, output: { confidence: 0.9 } })
    ], (demo) => codec.decode(demo).pipe(Effect.flip))
    expect(Arr.map(failures, (failure) => failure._tag)).toEqual(["SchemaError", "SchemaError", "SchemaError"])
    expect(
      yield* codec.decode(new Demonstration({ input: projected.input, output: { confidence: 0.9 }, incomplete: true }))
    ).toEqual(new Demonstration({ input: projected.input, output: {}, incomplete: true }))
  }))
