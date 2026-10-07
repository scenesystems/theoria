import { expect, it } from "@effect/vitest"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import {
  Array as Arr,
  BigDecimal,
  Boolean as Bool,
  Data,
  Effect,
  Match,
  Number as Num,
  Option,
  Order,
  Record,
  Ref,
  Result,
  Schema,
  String as Str
} from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { constVoid } from "effect/Function"
import { MIPROv2Error } from "../../src/DspError.js"
import { Example, Id } from "../../src/Example.js"
import * as Metric from "../../src/Metric.js"
import * as MIPROv2 from "../../src/MIPROv2.js"
import { TrialEvaluation } from "../../src/MIPROv2.js"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"
import * as Module from "../../src/Module.js"
import { ModuleParameters } from "../../src/ModuleParameters.js"
import * as Signature from "../../src/Signature.js"
import { fixture } from "../kit/Fixtures.js"
import { assertNoMutation } from "../kit/Mutation.js"
import { toldPercent } from "../kit/Percent.js"

const Row = Schema.Struct({ id: Schema.String, question: Schema.String, answer: Schema.String })
const State = Schema.Struct({
  signature: Schema.Struct({ instructions: Schema.String }),
  demos: Schema.Array(Schema.Struct({ question: Schema.String }))
})
const Reference = Schema.Struct({
  auto: Schema.optionalKey(Schema.OptionFromNullOr(Schema.Literals(["light", "medium", "heavy"]))),
  seed: Schema.Int,
  numTrials: Schema.Int,
  minibatch: Schema.Boolean,
  minibatchSize: Schema.Int,
  minibatchFullEvalSteps: Schema.Int,
  maxBootstrappedDemos: Schema.Int,
  maxLabeledDemos: Schema.Int,
  strictThroughTrial: Schema.Int,
  splits: Schema.Struct({ train: Schema.Array(Row), val: Schema.Array(Row) }),
  trialTable: Schema.Array(
    Schema.Struct({
      number: Schema.Int,
      params: Schema.Record(Schema.String, Schema.Int),
      value: Schema.OptionFromNullOr(Schema.Finite),
      state: Schema.String,
      fullValidation: Schema.Boolean
    })
  ),
  evaluations: Schema.Array(
    Schema.Struct({ ids: Schema.Array(Schema.String), instruction: Schema.String, state: State })
  ),
  state: Schema.optionalKey(State),
  bestFullValidationScore: Schema.optionalKey(Schema.Finite),
  error: Schema.optionalKey(Schema.String)
})
const Observed = Schema.Struct({
  ...TrialEvaluation.fields,
  ids: Schema.Array(Schema.String),
  instruction: Schema.String,
  demoIds: Schema.Array(Schema.String)
})
const examples = (rows: ReadonlyArray<typeof Row.Type>) =>
  Arr.map(rows, (row) =>
    new Example({
      id: Option.some(Id.make(row.id)),
      input: { question: row.question },
      labels: Option.some({ answer: row.answer })
    }))

const compile = (reference: typeof Reference.Type, specialist: boolean) =>
  Effect.gen(function*() {
    const module = yield* Module.predict(
      "qa",
      yield* Signature.make("baseline", { question: Schema.String }, { answer: Schema.String })
    )
    yield* Module.install(module, {
      qa: new ModuleParameters({ instructions: "baseline", demos: [], outputStrategy: "text" })
    })
    const proposal = yield* Ref.make(0)
    const mock = yield* MockLanguageModel.make(MockLanguageModel.fromFunction((prompt) =>
      Bool.match(Str.includes("Return only proposed_instruction.")(prompt), {
        onFalse: () => Effect.succeed("[[ ## answer ## ]]\nteacher\n[[ ## completed ## ]]"),
        onTrue: () => Ref.getAndUpdate(proposal, Num.increment).pipe(Effect.map((index) => `candidate-${index}`))
      })
    ))
    const observed = yield* Ref.make(Arr.empty<typeof Observed.Type>())
    const ids = yield* Ref.make(Arr.empty<string>())
    const metric = Metric.withFeedback((example, _prediction, context) =>
      Bool.match(context.phase !== "evaluate", {
        onFalse: () =>
          Effect.gen(function*() {
            yield* Ref.update(ids, Arr.append(Option.getOrThrow(example.id)))
            const prompt = Option.getOrThrow(Arr.last(yield* Ref.get(mock.calls))).prompt
            const score = Bool.match(specialist && Str.includes("candidate-")(prompt), {
              onFalse: () =>
                0.8,
              onTrue: () =>
                Bool.match(Arr.contains(["val-0", "val-1", "val-2"], Option.getOrThrow(example.id)), {
                  onFalse: () => 0,
                  onTrue: () => 1
                })
            })
            return new Metric.Score({ value: score, feedback: Option.none() })
          }),
        onTrue: () => Effect.sync(() => new Metric.Score({ value: 0.8, feedback: Option.none() }))
      })
    )
    const outcome = yield* assertNoMutation(
      module,
      MIPROv2.runWithEvents(
        new MIPROv2.Options({
          module,
          trainset: examples(reference.splits.train),
          valset: examples(reference.splits.val),
          metric,
          auto: Option.getOrElse(Option.fromUndefinedOr(reference.auto), () => Option.none()),
          ...Option.match(Option.getOrElse(Option.fromUndefinedOr(reference.auto), () => Option.none()), {
            onNone: () => ({ numCandidates: 3, numTrials: reference.numTrials }),
            onSome: () => ({})
          }),
          seed: reference.seed,
          maxLabeledDemos: reference.maxLabeledDemos,
          maxBootstrappedDemos: reference.maxBootstrappedDemos,
          minibatch: reference.minibatch,
          minibatchSize: reference.minibatchSize,
          minibatchFullEvalSteps: reference.minibatchFullEvalSteps,
          programAwareProposer: false,
          dataAwareProposer: false,
          tipAwareProposer: false,
          fewshotAwareProposer: false
        }),
        (event) =>
          Match.value(event).pipe(
            Match.tag("TrialEvaluated", (event) =>
              Effect.gen(function*() {
                const calls = yield* Ref.get(mock.calls)
                const prompt = Option.getOrThrow(Arr.last(calls)).prompt
                yield* Ref.update(
                  observed,
                  Arr.append({
                    ...event,
                    ids: yield* Ref.getAndSet(ids, []),
                    instruction: Option.getOrElse(
                      Str.match(/candidate-\d+/)(prompt).pipe(Option.flatMap(Arr.head)),
                      () => "baseline"
                    ),
                    demoIds: Arr.map(
                      Arr.fromIterable(Str.matchAll(/train-\d+/g)(prompt)),
                      (match) => Option.getOrThrow(Arr.head(match))
                    )
                  })
                )
              })),
            Match.orElse(() => Effect.void)
          )
      )
    ).pipe(
      Effect.provideService(LanguageModel.LanguageModel, mock.service),
      ModelBinder.withBinder(mock.binder),
      Effect.result
    )
    return { outcome, observed: yield* Ref.get(observed) }
  })

const sameConfig = Schema.toEquivalence(TrialEvaluation.fields.config)
// Real-valued means compared by cross multiplication: equal means tie exactly, so the stable sort
// keeps the first-observed combination as upstream's sorted(..., reverse=True) does.
class MeanSummary
  extends Data.Class<{ readonly total: BigDecimal.BigDecimal; readonly count: BigDecimal.BigDecimal }>
{}
const meanSummary = (rows: ReadonlyArray<typeof Observed.Type>) =>
  new MeanSummary({
    total: BigDecimal.sumAll(Arr.map(rows, (row) => toldPercent(row.score))),
    count: Option.getOrThrow(BigDecimal.fromNumber(rows.length))
  })
const descendingMean: Order.Order<MeanSummary> = (self, that) =>
  BigDecimal.Order(BigDecimal.multiply(that.total, self.count), BigDecimal.multiply(self.total, that.count))

const assertPolicy = (reference: typeof Reference.Type, rows: ReadonlyArray<typeof Observed.Type>) => {
  expect(rows).toHaveLength(reference.trialTable.length)
  expect(Arr.filter(rows, (row) => row.sampled)).toHaveLength(reference.numTrials)
  const expectedCheckpoints = Bool.match(reference.minibatch, {
    onFalse: () => Arr.empty<number>(),
    onTrue: () =>
      Arr.map(
        Arr.filter(
          Arr.range(1, reference.numTrials),
          (n) => Num.remainder(n, reference.minibatchFullEvalSteps) === 0 || n === reference.numTrials
        ),
        (n, index) => n + index + 1
      )
  })
  expect(Arr.map(Arr.filter(rows, (row) => !row.sampled && row.trial > 0), (row) => row.trial)).toEqual(
    expectedCheckpoints
  )
  Arr.forEach(rows, (row) => {
    expect(row.fullValidation).toBe(!row.sampled || !reference.minibatch)
    Bool.match(row.sampled || row.trial === 0, {
      onFalse: () => {
        const history = Arr.filter(rows, (previous) => previous.trial < row.trial)
        const minibatches = Arr.filter(history, (previous) => previous.sampled && !previous.fullValidation)
        const candidates = Arr.dedupeWith(Arr.map(minibatches, (previous) => previous.config), sameConfig)
        const remaining = Arr.filter(
          candidates,
          (config) =>
            !Arr.some(
              history,
              (previous) => previous.trial > 0 && !previous.sampled && sameConfig(config, previous.config)
            )
        )
        const ranked = Arr.sort(
          remaining,
          Order.mapInput(
            descendingMean,
            (config: TrialEvaluation["config"]) =>
              meanSummary(Arr.filter(minibatches, (previous) => sameConfig(config, previous.config)))
          )
        )
        expect(row.config, `checkpoint ${row.trial}`).toEqual(Option.getOrThrow(Arr.head(ranked)))
      },
      onTrue: constVoid
    })
  })
}

Arr.forEach([
  "mipro-trial-budget-001",
  "miprov2-medium-001",
  "miprov2-heavy-001",
  "miprov2-explicit-001",
  "mipro-best-fullval-001",
  "miprov2-no-labels-001",
  "miprov2-zero-shot-001",
  "miprov2-auto-minibatch-001"
], (id) => {
  it.effect(`${id}: strict upstream prefix and full-run checkpoint policy`, () =>
    Effect.gen(function*() {
      const reference = yield* Schema.decodeUnknownEffect(Reference)((yield* fixture(id, "upstream-execution")).payload)
      const { outcome, observed } = yield* compile(
        reference,
        id === "miprov2-explicit-001" || id === "mipro-best-fullval-001"
      )
      const result = yield* Effect.fromResult(outcome)
      assertPolicy(reference, observed)
      yield* Effect.forEach(Arr.filter(observed, (row) => row.trial <= reference.strictThroughTrial), (row) =>
        Effect.sync(() => {
          const upstream = Option.getOrThrow(Arr.get(reference.trialTable, row.trial))
          const evaluation = Option.getOrThrow(Arr.get(reference.evaluations, row.trial))
          expect(row.config, `trial ${row.trial}`).toEqual(upstream.params)
          expect(row.score).toBe(Option.getOrThrow(upstream.value))
          expect(row.ids).toEqual(evaluation.ids)
          expect(row.instruction).toBe(evaluation.instruction)
          expect(row.demoIds).toEqual(Arr.map(evaluation.state.demos, (demo) =>
            demo.question))
        }))
      const full = Arr.filter(observed, (row) =>
        row.fullValidation)
      const best = Arr.reduce(Arr.drop(full, 1), Option.getOrThrow(Arr.head(full)), (best, row) =>
        Bool.match(row.score > best.score, {
          onFalse: () =>
            best,
          onTrue: () =>
            row
        }))
      expect(result.report.phase3BestScore).toBe(best.score)
      expect(result.report.phase3ConfiguredTrials).toBe(reference.numTrials)
      expect(result.report.phase3CompletedTrials).toBe(observed.length)
      expect(result.report.trials).toHaveLength(observed.length)
      const selected = Option.getOrThrow(Record.get(result.parameters, "qa"))
      expect(selected.instructions).toBe(best.instruction)
      expect(Arr.map(selected.demos, (demo) =>
        demo.input.question)).toEqual(best.demoIds)
      yield* Effect.sync(() => {
        const state = Option.getOrThrow(Option.fromUndefinedOr(reference.state))
        expect(selected.instructions).toBe(state.signature.instructions)
        expect(Arr.map(selected.demos, (demo) =>
          demo.input.question)).toEqual(Arr.map(state.demos, (demo) =>
            demo.question))
        expect(result.report.phase3BestScore).toBe(reference.bestFullValidationScore)
      }).pipe(Effect.when(Effect.succeed(reference.strictThroughTrial === reference.trialTable.length - 1)))
      const encoded = yield* Schema.encodeEffect(Schema.fromJsonString(MIPROv2.Report))(result.report)
      expect(yield* Schema.decodeEffect(Schema.fromJsonString(MIPROv2.Report))(encoded)).toEqual(result.report)
    }), { timeout: 30000 })
})

it.effect(
  "exhausted combinations fail at the upstream selector, after eight sampled trials",
  () =>
    Effect.gen(function*() {
      const reference = yield* Schema.decodeUnknownEffect(Reference)(
        (yield* fixture("miprov2-exhausted-full-eval-001", "upstream-execution")).payload
      )
      const { outcome, observed } = yield* compile(reference, false)
      expect(Result.isFailure(outcome)).toBe(true)
      const error = yield* Schema.decodeUnknownEffect(MIPROv2Error)(Result.getFailure(outcome).pipe(Option.getOrThrow))
      expect(error.reason).toBe("exhausted-candidates")
      expect(error.message).toBe(reference.error)
      expect(Arr.map(observed, (row) => row.trial)).toEqual(Arr.range(0, 11))
      expect(Arr.filter(observed, (row) => row.sampled)).toHaveLength(8)
      expect(Arr.filter(observed, (row) => !row.sampled && row.trial > 0)).toHaveLength(3)
      yield* Effect.forEach(Arr.filter(observed, (row) => row.trial <= reference.strictThroughTrial), (row) =>
        Effect.sync(() => {
          expect(row.config).toEqual(Option.getOrThrow(Arr.get(reference.trialTable, row.trial)).params)
        }))
    }),
  { timeout: 30000 }
)
