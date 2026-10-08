import { expect, it } from "@effect/vitest"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import { ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import { Array as Arr, Boolean as Bool, Effect, Match, Option, Record, Ref, Schema, String as Str } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { constVoid } from "effect/Function"
import { Example, Id } from "../../src/Example.js"
import * as Metric from "../../src/Metric.js"
import * as MIPROv2 from "../../src/MIPROv2.js"
import { TrialEvaluation } from "../../src/MIPROv2.js"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"
import * as Module from "../../src/Module.js"
import { ModuleParameters } from "../../src/ModuleParameters.js"
import * as Signature from "../../src/Signature.js"
import * as Fixtures from "../kit/Fixtures.js"
import { assertNoMutation } from "../kit/Mutation.js"

const id = "miprov2-default-grounded-001"
const Row = Schema.Struct({ id: Schema.String, question: Schema.String, answer: Schema.String })
const StateDemo = Schema.Struct({ question: Schema.String, answer: Schema.String })
const PredictorState = Schema.Struct({
  signature: Schema.Struct({ instructions: Schema.String }),
  demos: Schema.Array(StateDemo)
})
const Reference = Schema.Struct({
  runtime: Schema.Struct({
    numpy: Schema.Literal("1.26.4"),
    optuna: Schema.Literal("4.9.0"),
    PYTHONHASHSEED: Schema.Literal("0"),
    NPY_DISABLE_CPU_FEATURES: Schema.Literal("AVX2,FMA3,AVX512F")
  }),
  seed: Schema.Literal(9),
  auto: Schema.Literal("light"),
  nonDefaultOptions: Schema.Struct({ num_threads: Schema.Literal(1) }),
  defaults: Schema.Struct({
    maxBootstrappedDemos: Schema.Literal(4),
    maxLabeledDemos: Schema.Literal(4),
    initTemperature: Schema.Literal(1),
    minibatchSize: Schema.Literal(35),
    minibatchFullEvalSteps: Schema.Literal(5),
    viewDataBatchSize: Schema.Literal(10),
    programAwareProposer: Schema.Literal(true),
    dataAwareProposer: Schema.Literal(true),
    tipAwareProposer: Schema.Literal(true),
    fewshotAwareProposer: Schema.Literal(true)
  }),
  splits: Schema.Struct({ train: Schema.Array(Row), val: Schema.Array(Row) }),
  taskSettings: Schema.Struct({ temperature: Schema.Finite, max_tokens: Schema.Int }),
  numCandidates: Schema.Int,
  numInstructions: Schema.Int,
  numTrials: Schema.Int,
  minibatch: Schema.Literal(false),
  bootstrapCalls: Schema.Int,
  instructions: Schema.Record(Schema.String, Schema.Array(Schema.String)),
  proposerCalls: Schema.NonEmptyArray(Schema.Struct({
    field: Schema.String,
    role: Schema.Literal("proposer"),
    rolloutId: Schema.OptionFromNullOr(Schema.Int),
    temperature: Schema.Finite,
    response: Schema.String,
    demoQuestions: Schema.Array(Schema.String),
    dataIds: Schema.Array(Schema.String),
    tip: Schema.OptionFromNullOr(Schema.String)
  })),
  strictThroughTrial: Schema.Int,
  trialTable: Schema.NonEmptyArray(Schema.Struct({
    number: Schema.Int,
    params: Schema.Record(Schema.String, Schema.Int),
    value: Schema.Finite,
    state: Schema.Literal("COMPLETE"),
    fullValidation: Schema.Boolean
  })),
  evaluations: Schema.NonEmptyArray(Schema.Struct({
    ids: Schema.Array(Schema.String),
    instruction: Schema.String,
    score: Schema.Finite,
    state: Schema.Struct({ qa: PredictorState })
  })),
  bestFullValidationScore: Schema.Finite,
  state: Schema.Struct({ qa: PredictorState })
})
const Observed = Schema.Struct({
  ...TrialEvaluation.fields,
  ids: Schema.Array(Schema.String),
  instruction: Schema.String,
  demoQuestions: Schema.Array(Schema.String)
})

const examples = (rows: ReadonlyArray<typeof Row.Type>) =>
  Arr.map(rows, (row) =>
    new Example({
      id: Option.some(Id.make(row.id)),
      input: { question: row.question },
      labels: Option.some({ answer: row.answer })
    }))
const matches = (pattern: RegExp, text: string) =>
  Arr.map(Arr.fromIterable(Str.matchAll(pattern)(text)), (match) => Option.getOrThrow(Arr.get(match, 1)))
const Answer = Schema.Struct({ answer: Schema.String })

it.effect(
  `${id}: one default compile joins seeded bootstrap, grounded proposals and TPE trials`,
  () =>
    Effect.gen(function*() {
      const entry = yield* Fixtures.entry(id)
      const trajectory = yield* Effect.fromOption(entry.trajectory)
      const reference = yield* Schema.decodeUnknownEffect(Reference)(
        (yield* Fixtures.fixture(id, "upstream-execution")).payload
      )
      expect(trajectory.strictThroughTrial).toBe(reference.strictThroughTrial)
      expect(trajectory.totalStudyRows).toBe(Arr.length(reference.trialTable))
      const module = yield* Module.predict(
        "qa",
        yield* Signature.make("baseline", { question: Schema.String }, { answer: Schema.String })
      )
      yield* Module.install(module, {
        qa: new ModuleParameters({ instructions: "baseline", demos: [], outputStrategy: "text" })
      })
      // The pinned task LM answers "best" exactly when a proposed instruction is in its prompt.
      const task = yield* MockLanguageModel.make(
        MockLanguageModel.fromFunction((prompt) =>
          Effect.succeed(`[[ ## answer ## ]]\n${
            Bool.match(Str.includes("instruction-")(prompt), {
              onTrue: () => "best",
              onFalse: () => "teacher"
            })
          }\n[[ ## completed ## ]]`)
        ),
        "dummy",
        new ModelSettings({
          temperature: reference.taskSettings.temperature,
          maxTokens: reference.taskSettings.max_tokens
        })
      )
      const proposer = yield* MockLanguageModel.make(
        MockLanguageModel.sequence(Arr.map(reference.proposerCalls, (call) => call.response))
      )
      const observed = yield* Ref.make(Arr.empty<typeof Observed.Type>())
      const proposed = yield* Ref.make(Arr.empty<string>())
      const counts = yield* Ref.make(Record.empty<string, number>())
      const ids = yield* Ref.make(Arr.empty<string>())
      // The upstream metric: 1.0 for "best", otherwise 0.5 (truthy, so bootstrap accepts every trace).
      const metric = Metric.withFeedback((example, prediction, context) =>
        Effect.gen(function*() {
          yield* Ref.update(ids, Arr.append(Option.getOrThrow(example.id))).pipe(
            Effect.when(Effect.succeed(context.phase === "evaluate"))
          )
          const { answer } = yield* Schema.decodeUnknownEffect(Answer)(prediction.output)
          return new Metric.Score({
            value: Bool.match(answer === "best", { onTrue: () => 1, onFalse: () => 0.5 }),
            feedback: Option.none()
          })
        })
      )
      const result = yield* assertNoMutation(
        module,
        MIPROv2.runWithEvents(
          new MIPROv2.Options({
            module,
            trainset: examples(reference.splits.train),
            valset: examples(reference.splits.val),
            metric
          }),
          (event) =>
            Match.value(event).pipe(
              Match.tag(
                "Phase1Started",
                ({ numCandidates }) => Ref.update(counts, Record.set("candidates", numCandidates))
              ),
              Match.tag(
                "Phase2Started",
                ({ numInstructions }) => Ref.update(counts, Record.set("instructions", numInstructions))
              ),
              Match.tag("Phase3Started", ({ numTrials }) => Ref.update(counts, Record.set("trials", numTrials))),
              Match.tag("InstructionProposed", ({ instruction }) => Ref.update(proposed, Arr.append(instruction))),
              Match.tag("TrialEvaluated", (event) =>
                Effect.gen(function*() {
                  const prompt = Option.getOrThrow(Arr.last(yield* Ref.get(task.calls))).prompt
                  yield* Ref.update(
                    observed,
                    Arr.append({
                      ...event,
                      ids: yield* Ref.getAndSet(ids, []),
                      instruction: Option.getOrElse(
                        Option.flatMap(Str.match(/instruction-\d+/)(prompt), Arr.head),
                        () => "baseline"
                      ),
                      demoQuestions: Arr.map(
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
        Effect.provideService(LanguageModel.LanguageModel, task.service),
        ModelBinder.withBinder(
          new ModelBinder.Binder({
            bind: (request) => (effect) =>
              Bool.match(request.role === "proposer", {
                onTrue: () =>
                  proposer.binder.bind(request)(
                    effect.pipe(Effect.provideService(LanguageModel.LanguageModel, proposer.service))
                  ),
                onFalse: () => task.binder.bind(request)(effect)
              })
          })
        )
      )

      // Resolved auto-light budget.
      expect(yield* Ref.get(counts)).toEqual({
        candidates: reference.numCandidates,
        instructions: reference.numInstructions,
        trials: reference.numTrials
      })

      // Phase 1: teacher bootstrap calls on the task LM, at its own settings.
      const teacherCalls = Arr.filter(yield* Ref.get(task.calls), (call) => call.role === "teacher")
      expect(teacherCalls).toHaveLength(reference.bootstrapCalls)

      // Phase 2: every grounded proposer call in order, with role, rollout, temperature and grounding.
      const proposerCalls = yield* Ref.get(proposer.calls)
      expect(proposerCalls).toHaveLength(Arr.length(reference.proposerCalls))
      expect(Arr.map(proposerCalls, (call) => ({
        field: Option.getOrThrow(Arr.get(Option.getOrThrow(Str.match(/Return only (\w+)\.$/)(call.prompt)), 1)),
        role: call.role,
        rolloutId: call.rolloutId,
        temperature: call.settings.temperature
      }))).toEqual(Arr.map(reference.proposerCalls, (call) => ({
        field: call.field,
        role: call.role,
        rolloutId: call.rolloutId,
        temperature: call.temperature
      })))
      yield* Effect.forEach(Arr.zip(proposerCalls, reference.proposerCalls), ([call, upstream]) =>
        Effect.sync(() =>
          Match.value(upstream.field).pipe(
            Match.when("observations", () =>
              expect(matches(/"question":\s*"(train-\d+)"/g, call.prompt)).toEqual(upstream.dataIds)),
            Match.when("proposed_instruction", () => {
              expect(matches(/"question":"(train-\d+)"/g, call.prompt)).toEqual(upstream.demoQuestions)
              expect(Str.includes("tip:")(call.prompt)).toBe(Option.isSome(upstream.tip))
              Option.match(upstream.tip, {
                onNone: constVoid,
                onSome: (tip) =>
                  expect(call.prompt).toContain(tip)
              })
              // The dataset summary from the data-aware calls grounds every proposal.
              expect(call.prompt).toContain(
                Option.getOrThrow(Arr.findFirst(reference.proposerCalls, (c) =>
                  c.field === "summary")).response
              )
            }),
            Match.orElse(constVoid)
          )
        ))
      expect(yield* Ref.get(proposed)).toEqual(Option.getOrThrow(Record.get(reference.instructions, "0")))

      // Phase 3: baseline plus sampled trials, compared through the manifest's strict prefix.
      const rows = yield* Ref.get(observed)
      expect(rows).toHaveLength(trajectory.totalStudyRows)
      yield* Effect.forEach(
        Arr.filter(rows, (row) =>
          row.trial <= trajectory.strictThroughTrial),
        (row) =>
          Effect.sync(() => {
            const upstream = Option.getOrThrow(Arr.get(reference.trialTable, row.trial))
            const evaluation = Option.getOrThrow(Arr.get(reference.evaluations, row.trial))
            expect(row.config, `trial ${row.trial}`).toEqual(upstream.params)
            expect(row.score).toBe(upstream.value)
            expect(row.fullValidation).toBe(upstream.fullValidation)
            expect(row.ids).toEqual(evaluation.ids)
            expect(row.instruction).toBe(evaluation.instruction)
            expect(row.demoQuestions).toEqual(Arr.map(evaluation.state.qa.demos, (demo) => demo.question))
          })
      )
      const selected = yield* Effect.fromOption(Record.get(result.parameters, "qa"))
      expect(selected.instructions).toBe(reference.state.qa.signature.instructions)
      expect(Arr.map(selected.demos, (demo) => ({ question: demo.input.question, answer: demo.output.answer })))
        .toEqual(reference.state.qa.demos)
      expect(result.report.phase3BestScore).toBe(reference.bestFullValidationScore)
    }),
  { timeout: 30000 }
)
