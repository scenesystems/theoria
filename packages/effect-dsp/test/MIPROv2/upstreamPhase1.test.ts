import { expect, it } from "@effect/vitest"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import * as PseudoRandom from "@scenesystems/effect-math/PseudoRandom"
import { Array as Arr, Chunk, Effect, Option, Record, Ref, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { Example, Id } from "../../src/Example.js"
import * as MiproSampling from "../../src/internal/miprov2/sampling.js"
import * as Metric from "../../src/Metric.js"
import * as Candidates from "../../src/MIPROv2Candidates.js"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"
import * as Module from "../../src/Module.js"
import { ModuleParameters } from "../../src/ModuleParameters.js"
import * as Signature from "../../src/Signature.js"
import { fixture } from "../kit/Fixtures.js"
import { assertNoMutation } from "../kit/Mutation.js"

const Demo = Schema.Struct({ question: Schema.String, answer: Schema.String })
const Reference = Schema.Struct({
  seed: Schema.Int,
  auto: Schema.OptionFromNullOr(Schema.String),
  maxBootstrappedDemos: Schema.Int,
  maxLabeledDemos: Schema.Int,
  bootstrapCalls: Schema.Int,
  bootstrapMetricIds: Schema.Array(Schema.String),
  splits: Schema.Struct({
    train: Schema.Array(Schema.Struct({ id: Schema.String, ...Demo.fields })),
    val: Schema.Array(Demo)
  }),
  demoSets: Schema.Record(Schema.String, Schema.Array(Schema.Array(Demo))),
  instructions: Schema.Record(Schema.String, Schema.Array(Schema.String)),
  proposerHistory: Schema.Array(Schema.Struct({ kwargs: Schema.Struct({ rollout_id: Schema.Int }) }))
})

it.effect("matches pinned MIPRO demo identities, order and teacher cost for labeled, no-label and zero-shot catalogs", () =>
  Effect.forEach(
    ["mipro-trial-budget", "miprov2-explicit", "miprov2-no-labels", "miprov2-zero-shot"],
    (id) =>
      Effect.gen(function*() {
        const reference = yield* Schema.decodeUnknownEffect(Reference)(
          (yield* fixture(id, "upstream-execution")).payload
        )
        const expected = Option.getOrThrow(Record.get(reference.demoSets, "0"))
        const module = yield* Module.predict(
          "qa",
          yield* Signature.make("baseline", { question: Schema.String }, { answer: Schema.String })
        )
        yield* Module.install(module, {
          qa: new ModuleParameters({ instructions: "baseline", demos: [], outputStrategy: "text" })
        })
        const mock = yield* MockLanguageModel.make(
          MockLanguageModel.succeed("[[ ## answer ## ]]\nteacher\n[[ ## completed ## ]]")
        )
        const metricIds = yield* Ref.make(Arr.empty<string>())
        const sampling = yield* PseudoRandom.makeCPython(reference.seed)
        // Auto light samples the whole six-row validation set before Phase 1.
        yield* Option.match(reference.auto, {
          onNone: () => Effect.void,
          onSome: () => sampling.sample(Chunk.fromIterable(reference.splits.val), Arr.length(reference.splits.val))
        })
        const actual = yield* assertNoMutation(
          module,
          Candidates.generateDemoCandidates(
            new Candidates.GenerateDemoCandidatesOptions({
              module,
              trainset: Arr.map(reference.splits.train, (row) =>
                new Example({
                  id: Option.some(Id.make(row.id)),
                  input: { question: row.question },
                  labels: Option.some({ answer: row.answer })
                })),
              metric: Metric.withFeedback((example) =>
                Ref.update(metricIds, Arr.append(Option.getOrThrow(example.id))).pipe(
                  Effect.as(new Metric.Score({ value: 0.8, feedback: Option.none() }))
                )
              ),
              numCandidates: Arr.length(expected),
              seed: reference.seed,
              maxBootstrappedDemos: reference.maxBootstrappedDemos,
              maxLabeledDemos: reference.maxLabeledDemos
            })
          )
        ).pipe(
          Effect.provideService(MiproSampling.Current, Option.some(sampling)),
          Effect.provideService(LanguageModel.LanguageModel, mock.service)
        )
        const candidates = Option.getOrThrow(Arr.head(actual)).candidates
        expect(yield* Ref.get(metricIds), id).toEqual(reference.bootstrapMetricIds)
        expect(Arr.map(candidates, (candidate) =>
          Arr.map(candidate.parameters.demos, (demo) => ({
            question: demo.input.question,
            answer: demo.output.answer
          })))).toEqual(expected)
        expect(Arr.map(candidates, (candidate) => candidate.parameters.instructions)).toEqual(
          Arr.map(expected, () => "baseline")
        )
        expect(yield* Ref.get(mock.calls)).toHaveLength(reference.bootstrapCalls)
        const proposer = yield* MockLanguageModel.make(
          MockLanguageModel.sequence(Arr.map(reference.proposerHistory, (_call, index) => `candidate-${index}`))
        )
        const proposals = yield* Candidates.proposeInstructionCandidates(
          new Candidates.ProposeInstructionCandidatesOptions({
            module,
            trainset: [],
            demoCandidates: actual,
            numInstructions: Arr.length(Option.getOrThrow(Record.get(reference.instructions, "0"))),
            programAwareProposer: false,
            dataAwareProposer: false,
            tipAwareProposer: false,
            fewshotAwareProposer: false
          })
        ).pipe(
          Effect.provideService(MiproSampling.Current, Option.some(sampling)),
          Effect.provideService(LanguageModel.LanguageModel, proposer.service),
          ModelBinder.withBinder(proposer.binder)
        )
        expect(Arr.map(yield* Ref.get(proposer.calls), (call) => Option.getOrThrow(call.rolloutId))).toEqual(
          Arr.map(reference.proposerHistory, (call) => call.kwargs.rollout_id)
        )
        expect(Arr.map(Option.getOrThrow(Arr.head(proposals)).candidates, (candidate) => candidate.instruction))
          .toEqual(Option.getOrThrow(Record.get(reference.instructions, "0")))
      })
  ))
