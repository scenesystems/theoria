/**
 * Generates Phase 2 instruction candidates from dataset and demonstration context.
 *
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al., "Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs", 2024}
 * @since 0.1.0
 */
import * as Settings from "@scenesystems/effect-lm/ModelSettings"
import {
  Array as Arr,
  Boolean as Bool,
  Chunk,
  Data,
  Effect,
  HashMap,
  Number as Num,
  Option,
  Schema,
  String as Str
} from "effect"
import { Record, Struct } from "effect"
import { Documents as DemoDocuments } from "../../Demonstration.js"
import { InstructionProposalFailed } from "../../DspError.js"
import {
  InstructionCandidate,
  type PredictorDemoCandidates,
  type PredictorDemoCandidateSets,
  PredictorInstructionCandidates,
  type ProposeInstructionCandidatesOptions
} from "../../MIPROv2Candidates.js"
import { predictors } from "../../ModuleGraph.js"
import * as Payload from "../../Payload.js"
import type * as Predictor from "../../Predictor.js"
import { Text } from "../../Signature.js"
import { RolloutRef } from "../cache/rollout.js"
import * as Binding from "../parameterBinding.js"
import { stripPrefix, tips } from "./runtime/policy.js"
import { datasetSummary, generate, prompt } from "./runtime/prompt.js"
import * as Sampling from "./sampling.js"

const indexDemoCandidateSets = (
  refs: ReadonlyArray<Predictor.Predictor>,
  candidateSets: PredictorDemoCandidateSets
) =>
  Effect.reduce(
    candidateSets,
    () => HashMap.empty<string, PredictorDemoCandidates>(),
    (setsByName, candidateSet) =>
      Effect.gen(function*() {
        const predictorIndex = yield* Effect.fromOption(
          Arr.findFirstIndex(refs, (ref) => Str.Equivalence(ref.name, candidateSet.predictorName)),
          () =>
            new InstructionProposalFailed({
              message: Str.concat(
                Str.concat("Unknown demo candidates for predictor '", candidateSet.predictorName),
                "'"
              ),
              predictorIndex: -1
            })
        )
        yield* Bool.match(HashMap.has(setsByName, candidateSet.predictorName), {
          onTrue: () =>
            Effect.fail(
              new InstructionProposalFailed({
                message: Str.concat(
                  Str.concat("Duplicate demo candidates for predictor '", candidateSet.predictorName),
                  "'"
                ),
                predictorIndex
              })
            ),
          onFalse: () => Effect.void
        })
        yield* Effect.forEach(candidateSet.candidates, (candidate) =>
          Bool.match(Str.Equivalence(candidate.predictorName, candidateSet.predictorName), {
            onTrue: () => Effect.void,
            onFalse: () =>
              Effect.fail(
                new InstructionProposalFailed({
                  message: Arr.join(
                    Arr.make(
                      "Demo candidate for predictor '",
                      candidateSet.predictorName,
                      "' identifies predictor '",
                      candidate.predictorName,
                      "'"
                    ),
                    ""
                  ),
                  predictorIndex
                })
              )
          }), { discard: true })
        return HashMap.set(setsByName, candidateSet.predictorName, candidateSet)
      })
  )

const RenderedDemos = Schema.Array(DemoDocuments)
const RenderedDemoCandidates = Schema.Array(RenderedDemos)
const ProgramCode = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  predictors: Schema.Array(Schema.Struct({ path: Schema.String, signature: Text }))
})

// DSPy describes the proposed-for module as `Predict(inputs) -> outputs` from its current signature
// (grounded_proposer.py:199-213). The public structure has no field schemas, so the module is identified
// by its canonical path plus the signature text and field metadata effective under any overlay.
const FieldMetadata = Schema.Struct({
  prefix: Schema.OptionFromNullOr(Schema.String),
  description: Schema.OptionFromNullOr(Schema.String)
})
const ModuleCode = Schema.Struct({
  path: Schema.String,
  name: Schema.String,
  signature: Text,
  fields: Schema.Record(Schema.String, FieldMetadata)
})

class PreparedPredictor extends Data.Class<{
  readonly ref: Predictor.Predictor
  readonly predictorIndex: number
  readonly instruction: string
  readonly moduleCode: Payload.Payload
  readonly renderedDemoCandidates: typeof RenderedDemoCandidates.Type
}> {}

const preparePredictor = (
  ref: Predictor.Predictor,
  predictorIndex: number,
  candidateSets: HashMap.HashMap<string, PredictorDemoCandidates>,
  hasDemos: boolean
) =>
  Effect.gen(function*() {
    const parameters = yield* Binding.read(ref.parameters, ref.name)
    const renderedDemoCandidates = yield* Bool.match(hasDemos, {
      onFalse: () => Effect.succeed(Arr.empty<typeof RenderedDemos.Type>()),
      onTrue: () =>
        Effect.gen(function*() {
          const demoSet = yield* Effect.fromOption(HashMap.get(candidateSets, ref.name), () =>
            new InstructionProposalFailed({
              message: Str.concat(Str.concat("Missing demo candidates for predictor '", ref.name), "'"),
              predictorIndex
            }))
          yield* Effect.asVoid(Effect.fromOption(Arr.head(demoSet.candidates), () =>
            new InstructionProposalFailed({
              message: Str.concat(Str.concat("Demo candidate set for predictor '", ref.name), "' is empty"),
              predictorIndex
            })))
          return yield* Effect.forEach(
            demoSet.candidates,
            (candidate) =>
              Effect.gen(function*() {
                // Validate every supplied demo before model calls, including labels not used for grounding.
                const documents = yield* Effect.forEach(candidate.parameters.demos, ref.demonstrationCodec.encode)
                return Arr.filter(
                  documents,
                  (_document, index) => Option.getOrThrow(Arr.get(candidate.parameters.demos, index)).augmented
                )
              })
          )
        })
    })
    return new PreparedPredictor({
      ref,
      predictorIndex,
      instruction: parameters.instructions,
      moduleCode: yield* Payload.encode(ModuleCode, {
        path: ref.path,
        name: ref.name,
        signature: new Text({ description: ref.signature.description, instructions: parameters.instructions }),
        fields: parameters.fields
      }),
      renderedDemoCandidates
    })
  })

/**
 * Generates ordered instruction candidates without mutating module parameters.
 *
 * @remarks
 * Predictors and all proposals, including the discarded first proposal, run
 * sequentially. Grounding rotates augmented demonstrations from the current,
 * following, then preceding sets. A shared CPython stream draws a tip before
 * the rollout ID; all calls for that proposal share its rollout partition.
 * The program-aware `module` input is a JSON document of the predictor's canonical
 * path, name, signature description, effective instructions and effective field
 * metadata, read through parameter overlays; DSPy's Python class/field rendering
 * has no equivalent in the public program structure.
 * Every supplied set must uniquely identify a predictor.
 * Missing, empty, duplicate, unknown, or misbound Phase 1 candidates fail with
 * `InstructionProposalFailed`. All identities and destination wire demonstrations
 * are preflighted before any model call; invalid demonstrations retain their
 * checked `ParseError`. Provider failures become `InstructionProposalFailed`
 * without retaining provider details.
 *
 * @param options - Module tree, Phase 1 context, total candidate count, and prompt hints.
 * @returns Candidate sets in the module tree's parameter-ref order.
 * @typeParam I - Input fields used to describe the module and prompt examples.
 * @typeParam O - Output fields used to describe the module and prompt examples.
 *
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al. (2024)}
 * @since 0.1.0
 * @category constructors
 */
export const proposeInstructionCandidates = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E = never,
  R = never
>(
  options: ProposeInstructionCandidatesOptions<I, O, E, R>
) =>
  Effect.gen(function*() {
    const refs = Arr.filter(Arr.fromIterable(predictors(options.module)), (entry) => !entry.frozen)
    const sampling = yield* Sampling.resolve(Option.getOrElse(Option.fromUndefinedOr(options.seed), () => 9))
    const hasDemos = Arr.isReadonlyArrayNonEmpty(options.demoCandidates)
    const candidateSetsByName = yield* indexDemoCandidateSets(refs, options.demoCandidates)
    const prepared = yield* Effect.forEach(
      refs,
      (ref, predictorIndex) => preparePredictor(ref, predictorIndex, candidateSetsByName, hasDemos),
      { concurrency: 1 }
    )
    const settings = Settings.merge(
      new Settings.ModelSettings({
        temperature: Option.getOrElse(Option.fromUndefinedOr(options.initTemperature), () => 1)
      }),
      Option.getOrElse(Option.fromUndefinedOr(options.proposerSettings), () => Settings.empty)
    )
    const summary = yield* Bool.match(
      Option.getOrElse(Option.fromUndefinedOr(options.dataAwareProposer), () => true),
      {
        onFalse: () => Effect.succeed(Option.none<string>()),
        onTrue: () =>
          datasetSummary(
            options.trainset,
            Option.getOrElse(Option.fromUndefinedOr(options.viewDataBatchSize), () => 10),
            Settings.merge(settings, new Settings.ModelSettings({ temperature: 1 }))
          ).pipe(Effect.option)
      }
    )
    // Predictor paths and signature text are the declarative source representation.
    const programCode = yield* Payload.encode(ProgramCode, {
      name: options.module.name,
      description: options.module.signature.description,
      predictors: Arr.map(refs, (ref) => ({ path: ref.path, signature: ref.signature }))
    })
    const numDemos = Option.match(Arr.head(options.demoCandidates), {
      onNone: () => options.numInstructions,
      onSome: (set) => Num.max(1, Arr.length(set.candidates))
    })
    const requested = Arr.range(0, Num.decrement(Num.min(options.numInstructions, numDemos)))
    return yield* Effect.forEach(prepared, ({ instruction, moduleCode, predictorIndex, ref, renderedDemoCandidates }) =>
      Effect.gen(function*() {
        const generated = yield* Effect.forEach(
          requested,
          (proposalIndex) =>
            Effect.gen(function*() {
              const tip = yield* Bool.match(
                Option.getOrElse(Option.fromUndefinedOr(options.tipAwareProposer), () =>
                  true),
                {
                  onFalse: () => Effect.succeed<keyof typeof tips>("none"),
                  onTrue: () => sampling.choice(Chunk.fromIterable(Record.keys(tips)))
                }
              )
              const rolloutId = yield* sampling.randint(0, 1_000_000_000)
              const demos = Bool.match(
                Option.getOrElse(Option.fromUndefinedOr(options.fewshotAwareProposer), () => true) &&
                  Num.isGreaterThan(proposalIndex, 0),
                {
                  onFalse: () => Arr.empty<DemoDocuments>(),
                  onTrue: () =>
                    Arr.take(
                      Arr.flatten(
                        Arr.appendAll(
                          Arr.drop(renderedDemoCandidates, proposalIndex),
                          Arr.take(renderedDemoCandidates, proposalIndex)
                        )
                      ),
                      3
                    )
                }
              )
              const taskDemos = Bool.match(Arr.isReadonlyArrayEmpty(demos), {
                onFalse: () =>
                  Arr.join(
                    Arr.map(demos, (demo) => `Input:\n${demo[0]}\nOutput:\n${demo[1]}`),
                    "\n\n"
                  ),
                onTrue: () => "No task demos provided."
              })
              return yield* Effect.gen(function*() {
                const description = yield* Bool.match(
                  Option.getOrElse(Option.fromUndefinedOr(options.programAwareProposer), () => true),
                  {
                    onFalse: () => Effect.succeed(Option.none<Record.ReadonlyRecord<string, string>>()),
                    onTrue: () =>
                      Effect.gen(function*() {
                        const programDescription = stripPrefix(
                          yield* generate(
                            prompt({ program_code: programCode, program_example: taskDemos }, "program_description"),
                            settings
                          )
                        )
                        const moduleDescription = yield* generate(
                          prompt({
                            program_code: programCode,
                            program_example: taskDemos,
                            program_description: programDescription,
                            module: moduleCode
                          }, "module_description"),
                          settings
                        )
                        return {
                          program_code: programCode,
                          program_description: programDescription,
                          module: moduleCode,
                          module_description: moduleDescription
                        }
                      }).pipe(Effect.option)
                  }
                )
                const text = prompt({
                  ...Option.match(summary, {
                    onNone: () => ({}),
                    onSome: (dataset_description) => ({ dataset_description })
                  }),
                  ...Option.getOrElse(description, () => ({})),
                  task_demos: taskDemos,
                  basic_instruction: instruction,
                  ...Bool.match(Str.isEmpty(tips[tip]), {
                    onFalse: () => ({ tip: tips[tip] }),
                    onTrue: () => ({})
                  })
                }, "proposed_instruction")
                const proposed = stripPrefix(yield* generate(text, settings))
                return new InstructionCandidate({
                  predictorName: ref.name,
                  instruction: proposed,
                  tip,
                  rolloutId: Option.some(rolloutId),
                  prompt: text,
                  isBaseline: false
                })
              }).pipe(Effect.provideService(RolloutRef, Option.some(rolloutId)))
            }),
          { concurrency: 1 }
        ).pipe(Effect.mapError(() =>
          new InstructionProposalFailed({
            message: `Failed to propose instruction for predictor '${ref.name}'`,
            predictorIndex
          })
        ))

        return new PredictorInstructionCandidates({
          predictorName: ref.name,
          candidates: Arr.map(generated, (candidate, index) =>
            Bool.match(Num.isGreaterThan(index, 0), {
              onFalse: () => new InstructionCandidate(Struct.assign(candidate, { instruction, isBaseline: true })),
              onTrue: () => candidate
            }))
        })
      }), { concurrency: 1 })
  }).pipe(Binding.withPredictors(predictors(options.module)))
