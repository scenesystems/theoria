import { expect, it } from "@effect/vitest"
import * as BootstrapRS from "@scenesystems/effect-dsp/BootstrapRS"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import { Example, Id } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Chunk, Effect, Number as Num, Option, Record, Ref, Schema, String as Str } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { fixture } from "../kit/Fixtures.js"
import { assertNoMutation } from "../kit/Mutation.js"

const Row = Schema.Struct({ id: Schema.String, question: Schema.String, answer: Schema.String })

it.effect("bootstraprs-001: exact candidate catalog, fraction scores, reset and earliest winner", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Schema.Struct({
      splits: Schema.Struct({ train: Schema.Array(Row), val: Schema.Array(Row) }),
      candidates: Schema.Array(Schema.Struct({
        seed: Schema.Int,
        score: Schema.Finite,
        state: Schema.Struct({ demos: Schema.Array(Schema.Struct({ question: Schema.String, answer: Schema.String })) })
      })),
      winnerSeed: Schema.Int
    }))((yield* fixture("bootstraprs-001", "upstream-execution")).payload)
    const module = yield* Module.predict(
      "qa",
      yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
    )
    yield* Module.install(module, {
      qa: new ModuleParameters({
        instructions: "answer",
        outputStrategy: "structured",
        demos: [new Demonstration({ input: { question: "stale" }, output: { answer: "stale" } })]
      })
    })
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "teacher" }))
    const rows = (rows: ReadonlyArray<typeof Row.Type>) =>
      Arr.map(rows, (row) =>
        new Example({
          id: Option.some(Id.make(row.id)),
          input: { question: row.question },
          labels: Option.some({ answer: row.answer })
        }))
    const result = yield* assertNoMutation(
      module,
      BootstrapRS.run(
        new BootstrapRS.Options({
          module,
          trainset: rows(reference.splits.train),
          valset: rows(reference.splits.val),
          metric: Metric.fromSync((_labels, prediction) => prediction.answer === "teacher" ? 1 : 0),
          numCandidatePrograms: 2,
          maxBootstrappedDemos: 2,
          maxLabeledDemos: 1,
          maxRounds: 1
        })
      )
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    expect(Arr.map(result.report.candidates, ({ seed, score }) => ({ seed, score })))
      .toEqual(Arr.map(reference.candidates, ({ seed, score }) => ({ seed, score })))
    expect(
      Arr.map(
        result.report.candidates,
        (candidate) =>
          Arr.map(Option.getOrThrow(Record.get(candidate.parameters, "qa")).demos, (demo) => ({
            question: demo.input.question,
            answer: demo.output.answer
          }))
      )
    )
      .toEqual(Arr.map(reference.candidates, (candidate) => candidate.state.demos))
    expect(result.report.winnerSeed).toBe(reference.winnerSeed)
    expect(Option.getOrThrow(Record.get(result.parameters, "qa")).demos).toEqual([])
    yield* Effect.forEach(result.report.candidates, (candidate) =>
      Effect.sync(() => {
        expect(candidate.evaluation.totalExamples).toBe(2)
        expect(candidate.evaluation.units).toBe("fraction")
      }))
    expect(yield* Ref.get(mock.calls)).not.toHaveLength(0)
  }))

it.effect("stopAtScore evaluates full validation before stopping and never constructs later candidates", () =>
  Effect.gen(function*() {
    const module = yield* Module.predict(
      "qa",
      yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
    )
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "teacher" }))
    const phases = yield* Ref.make(Arr.empty<string>())
    const result = yield* assertNoMutation(
      module,
      BootstrapRS.run(
        new BootstrapRS.Options({
          module,
          trainset: [
            new Example({ input: { invalid: "must not be decoded" }, labels: Option.some({ answer: "bad" }) })
          ],
          valset: [new Example({ input: { question: "one" } }), new Example({ input: { question: "two" } })],
          metric: Metric.withFeedback((_row, _prediction, context) =>
            Ref.update(phases, Arr.append(context.phase)).pipe(
              Effect.as(new Metric.Score({ value: 0.75, feedback: Option.none() }))
            )
          ),
          numCandidatePrograms: 4,
          stopAtScore: Option.some(0.75)
        })
      )
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    expect(result.report.winnerSeed).toBe(-3)
    expect(result.report.candidates).toHaveLength(1)
    expect(Arr.map(result.report.candidates, (candidate) => candidate.score)).toEqual([0.75])
    expect(yield* Ref.get(phases)).toEqual(["evaluate", "evaluate"])
    expect(yield* Ref.get(mock.calls)).toHaveLength(2)
  }))

it.effect("ranks failure-inclusive averages, not the mean of successful rows", () =>
  Effect.gen(function*() {
    const module = yield* Module.predict(
      "qa",
      yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
    )
    yield* Module.install(module, {
      qa: new ModuleParameters({ instructions: "answer", demos: [], outputStrategy: "structured" })
    })
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "teacher" }))
    const result = yield* assertNoMutation(
      module,
      BootstrapRS.run(
        new BootstrapRS.Options({
          module,
          trainset: [new Example({ input: { question: "train" }, labels: Option.some({ answer: "label-marker" }) })],
          valset: [new Example({ input: { question: "good" } }), new Example({ input: { question: "bad" } })],
          metric: Metric.withFeedback((row, prediction, context) =>
            Effect.gen(function*() {
              if (context.phase === "bootstrap") return new Metric.Score({ value: 1, feedback: Option.none() })
              const labeled = Str.includes("label-marker")(
                Option.getOrThrow(Chunk.head(prediction.trace.selected)).prompt
              )
              if (!labeled && row.input.question === "bad") return yield* Effect.fail("scripted metric failure")
              return new Metric.Score({ value: labeled ? 0.6 : 1, feedback: Option.none() })
            })
          ),
          numCandidatePrograms: 0,
          maxBootstrappedDemos: 1,
          maxLabeledDemos: 1,
          maxErrors: Option.some(2)
        })
      )
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    expect(Arr.map(result.report.candidates, (candidate) => candidate.score)).toEqual([0.5, 0.6, 0.5])
    expect(result.report.winnerSeed).toBe(-2)
    expect(Option.getOrThrow(Record.get(result.parameters, "qa")).demos[0]?.output.answer).toBe("label-marker")
  }))

it.effect("random candidates vary their caps and shuffle rather than rotate", () =>
  Effect.gen(function*() {
    const module = yield* Module.predict(
      "qa",
      yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
    )
    yield* Module.install(module, {
      qa: new ModuleParameters({ instructions: "answer", demos: [], outputStrategy: "structured" })
    })
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "teacher" }))
    const result = yield* assertNoMutation(
      module,
      BootstrapRS.run(
        new BootstrapRS.Options({
          module,
          trainset: Arr.makeBy(6, (index) => new Example({ input: { question: `${index}` } })),
          valset: [new Example({ input: { question: "validation" } })],
          metric: Metric.fromSync(() => 1),
          numCandidatePrograms: 24,
          maxBootstrappedDemos: 4,
          maxLabeledDemos: 0
        })
      )
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    const demos = Arr.map(
      result.report.candidates,
      (candidate) => Option.getOrThrow(Record.get(candidate.parameters, "qa")).demos
    )
    expect(Arr.map(Option.getOrThrow(Arr.get(demos, 2)), (demo) => demo.input.question)).toEqual(["0", "1", "2", "3"])
    const shuffled = Arr.drop(demos, 3)
    expect(Arr.sort(Arr.dedupe(Arr.map(shuffled, (entries) => entries.length)), Num.Order)).toEqual([1, 2, 3, 4])
    expect(Arr.some(shuffled, (entries) =>
      entries.length >= 2 &&
      entries[1]?.input.question !==
        `${
          (Num.parse(Schema.decodeUnknownSync(Schema.String)(entries[0]?.input.question)).pipe(Option.getOrThrow) + 1) %
          6
        }`))
      .toBe(true)
    yield* Effect.forEach(shuffled, (entries) =>
      Effect.sync(() => {
        expect(Arr.dedupe(Arr.map(entries, (demo) => demo.input.question))).toHaveLength(entries.length)
      }))
  }))

it.effect("rejects the same teacher executable and invalid fraction thresholds before model calls", () =>
  Effect.gen(function*() {
    const module = yield* Module.predict(
      "qa",
      yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
    )
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "teacher" }))
    yield* Effect.forEach([
      { teacher: module, stopAtScore: Option.none<number>(), tag: "IncompatibleTeacher" },
      { stopAtScore: Option.some(-0.01), tag: "SchemaError" },
      { stopAtScore: Option.some(1.01), tag: "SchemaError" }
    ], (invalid) =>
      Effect.gen(function*() {
        const failure = yield* assertNoMutation(
          module,
          BootstrapRS.run(
            new BootstrapRS.Options({
              module,
              trainset: [new Example({ input: { question: "q" } })],
              metric: Metric.fromSync(() => 1),
              numCandidatePrograms: 0,
              maxLabeledDemos: 0,
              ...invalid
            })
          )
        ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.flip)
        expect(failure._tag).toBe(invalid.tag)
      }))
    expect(yield* Ref.get(mock.calls)).toHaveLength(0)
  }))
