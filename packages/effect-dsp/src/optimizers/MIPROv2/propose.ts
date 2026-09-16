/**
 * Generates Phase 2 instruction candidates from dataset and demonstration context.
 *
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al., "Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs", 2024}
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, HashMap, Number as Num, Option, Ref, Schema, String as Str } from "effect"
import { DemoDocuments } from "../../contracts/DemoContract.js"
import type { ModuleParams } from "../../contracts/ModuleParams.js"
import { InstructionProposalFailed } from "../../Errors/optimizer.js"
import { collectModuleParamRefs, type ModuleParamRef } from "../../internal/module-params.js"
import type { Module as DspModule } from "../../Module/model.js"
import { generateText } from "../../Module/textGeneration.js"
import type { PredictorDemoCandidates, PredictorDemoCandidateSets } from "./bootstrap.js"
import type { MIPROExamples, MIPROTipVocabulary } from "./index.js"
import {
  proposalIndices,
  proposalMarker,
  resolveDiversityTemperature,
  resolveSeed,
  resolveTipVocabulary,
  tipAt
} from "./runtime/policy.js"
import { buildProposalPrompt, datasetSummary, ProposalPromptOptions } from "./runtime/prompt.js"

/**
 * Records one baseline or model-generated instruction for a predictor.
 *
 * @remarks
 * Generated candidates retain the complete prompt, including rendered example
 * values. Treat `prompt` as potentially sensitive when persisting or logging a
 * candidate. Model text is stored without parsing or validation.
 *
 * @since 0.1.0
 * @category models
 */
export class InstructionCandidate extends Schema.Class<InstructionCandidate>("MIPROv2InstructionCandidate")({
  /** Exact parameter-ref name of the candidate's predictor. */
  predictorName: Schema.String,
  /** Baseline or model-generated instruction evaluated by Phase 3. */
  instruction: Schema.String,
  /** Proposal hint rendered into the generation prompt; baseline candidates use `"baseline"`. */
  tip: Schema.String,
  /** Deterministic marker rendered into the prompt to distinguish proposals. */
  cacheBustMarker: Schema.String,
  /** Complete proposal prompt; baseline candidates store `"baseline"`. */
  prompt: Schema.String,
  /** Identifies the predictor's original instruction at index zero. */
  isBaseline: Schema.Boolean
}) {}

/**
 * Groups one predictor's baseline and generated instructions in search order.
 *
 * @remarks
 * Index zero is always the original instruction. The array's total length is
 * the normalized `numInstructions`, so model generation runs one fewer time.
 *
 * @since 0.1.0
 * @category models
 */
export class PredictorInstructionCandidates
  extends Schema.Class<PredictorInstructionCandidates>("MIPROv2PredictorInstructionCandidates")({
    /** Exact parameter-ref name shared by every grouped candidate. */
    predictorName: Schema.String,
    /** Baseline followed by model-generated instructions in Phase 3 search order. */
    candidates: Schema.Array(InstructionCandidate)
  })
{}

/**
 * Ordered Phase 2 candidate sets, one per predictor.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PredictorInstructionCandidateSets = Schema.Array(PredictorInstructionCandidates)

/**
 * Ordered Phase 2 candidate sets, one per predictor.
 *
 * @since 0.1.0
 * @category type-level
 */
export type PredictorInstructionCandidateSets = typeof PredictorInstructionCandidateSets.Type

/**
 * Configures instruction generation for every owned predictor.
 *
 * @typeParam I - Input fields used to describe the module and prompt examples.
 * @typeParam O - Output fields used to describe the module and prompt examples.
 *
 * @since 0.1.0
 * @category models
 */
export class ProposeInstructionCandidatesOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E = never,
  R = never
> extends Data.Class<{
  /** Root whose current instructions become index-zero baselines. */
  readonly module: DspModule<I, O, E, R>
  /** Dataset counts and module description rendered into proposal prompts. */
  readonly trainset: MIPROExamples
  /** Phase 1 context matched to predictors by exact name. */
  readonly demoCandidates: PredictorDemoCandidateSets
  /** Total candidates per predictor, including the baseline; invalid counts become one. */
  readonly numInstructions: number
  /** Positive integer used for tip selection and prompt markers. Defaults to `1`. */
  readonly seed?: number
  /** Numeric prompt text only; this value does not configure the model provider. */
  readonly diversityTemperature?: number
  /** Prompt hints selected cyclically; an empty or omitted array uses the built-in vocabulary. */
  readonly tipVocabulary?: MIPROTipVocabulary
}> {}

const indexDemoCandidateSets = (
  refs: Arr.NonEmptyReadonlyArray<ModuleParamRef>,
  candidateSets: PredictorDemoCandidateSets
) =>
  Effect.reduce(
    candidateSets,
    HashMap.empty<string, PredictorDemoCandidates>(),
    (setsByName, candidateSet) =>
      Effect.gen(function*() {
        const predictorIndex = yield* Option.match(
          Arr.findFirstIndex(refs, (ref) => Str.Equivalence(ref.name, candidateSet.predictorName)),
          {
            onNone: () =>
              Effect.fail(
                new InstructionProposalFailed({
                  message: Str.concat(
                    Str.concat("Unknown demo candidates for predictor '", candidateSet.predictorName),
                    "'"
                  ),
                  predictorIndex: -1
                })
              ),
            onSome: Effect.succeed
          }
        )
        yield* Effect.if(HashMap.has(setsByName, candidateSet.predictorName), {
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
          Effect.if(Str.Equivalence(candidate.predictorName, candidateSet.predictorName), {
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

const baselineCandidate = (predictorName: string, instruction: string): InstructionCandidate =>
  new InstructionCandidate({
    predictorName,
    instruction,
    tip: "baseline",
    cacheBustMarker: proposalMarker(predictorName, 0, 0),
    prompt: "baseline",
    isBaseline: true
  })

class ResolvedPredictor extends Data.Class<{
  readonly ref: ModuleParamRef
  readonly predictorIndex: number
  readonly demoSet: PredictorDemoCandidates
  readonly params: ModuleParams
}> {}

const RenderedDemos = Schema.Array(DemoDocuments)
const RenderedDemoCandidates = Schema.Array(RenderedDemos)

class PreparedPredictor extends Data.Class<{
  readonly ref: ModuleParamRef
  readonly predictorIndex: number
  readonly params: ModuleParams
  readonly renderedDemoCandidates: typeof RenderedDemoCandidates.Type
  readonly firstDemos: typeof RenderedDemos.Type
}> {}

const resolvePredictor = (
  ref: ModuleParamRef,
  predictorIndex: number,
  candidateSets: HashMap.HashMap<string, PredictorDemoCandidates>
) =>
  Effect.gen(function*() {
    const demoSet = yield* Option.match(HashMap.get(candidateSets, ref.name), {
      onNone: () =>
        Effect.fail(
          new InstructionProposalFailed({
            message: Str.concat(Str.concat("Missing demo candidates for predictor '", ref.name), "'"),
            predictorIndex
          })
        ),
      onSome: Effect.succeed
    })
    yield* Option.match(Arr.head(demoSet.candidates), {
      onNone: () =>
        Effect.fail(
          new InstructionProposalFailed({
            message: Str.concat(Str.concat("Demo candidate set for predictor '", ref.name), "' is empty"),
            predictorIndex
          })
        ),
      onSome: () => Effect.void
    })
    const params = yield* Ref.get(ref.params)
    return new ResolvedPredictor({ ref, predictorIndex, demoSet, params })
  })

const preparePredictor = (resolved: ResolvedPredictor) =>
  Effect.gen(function*() {
    const renderedDemoCandidates = yield* Effect.forEach(
      resolved.demoSet.candidates,
      (candidate) => Effect.forEach(candidate.params.demos, resolved.ref.demoContract.toTrace)
    )
    const firstDemos = yield* Option.match(Arr.head(renderedDemoCandidates), {
      onNone: () =>
        Effect.fail(
          new InstructionProposalFailed({
            message: Str.concat(
              Str.concat("Demo candidate set for predictor '", resolved.ref.name),
              "' is empty"
            ),
            predictorIndex: resolved.predictorIndex
          })
        ),
      onSome: Effect.succeed
    })
    return new PreparedPredictor({
      ref: resolved.ref,
      predictorIndex: resolved.predictorIndex,
      params: resolved.params,
      renderedDemoCandidates,
      firstDemos
    })
  })

/**
 * Generates ordered instruction candidates without mutating module parameters.
 *
 * @remarks
 * Predictors and their generated alternatives run sequentially. Each proposal
 * uses one Phase 1 candidate in cyclic order and sends a plain-text prompt to
 * the configured language model. Every supplied set must uniquely identify an
 * owned predictor, and every candidate must identify its enclosing set's predictor.
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
    const refs = collectModuleParamRefs(options.module)
    const requested = proposalIndices(options.numInstructions)
    const seed = resolveSeed(options.seed)
    const tips = resolveTipVocabulary(options.tipVocabulary)
    const summary = datasetSummary(options.trainset)
    const diversityTemperature = resolveDiversityTemperature(options.diversityTemperature)
    const candidateSetsByName = yield* indexDemoCandidateSets(refs, options.demoCandidates)
    const resolved = yield* Effect.forEach(
      refs,
      (ref, predictorIndex) => resolvePredictor(ref, predictorIndex, candidateSetsByName),
      { concurrency: 1 }
    )
    const prepared = yield* Effect.forEach(resolved, preparePredictor, { concurrency: 1 })

    return yield* Effect.forEach(prepared, ({ firstDemos, params, predictorIndex, ref, renderedDemoCandidates }) =>
      Effect.gen(function*() {
        const generated = yield* Effect.forEach(
          requested,
          (proposalOffset) =>
            Effect.gen(function*() {
              const proposalIndex = Num.increment(proposalOffset)
              const tip = tipAt(tips, Num.sum(Num.sum(seed, predictorIndex), proposalIndex))
              const marker = proposalMarker(ref.name, proposalIndex, seed)
              const demos = Option.getOrElse(
                Arr.get(
                  renderedDemoCandidates,
                  Num.remainder(proposalOffset, Arr.length(renderedDemoCandidates))
                ),
                () =>
                  firstDemos
              )
              const prompt = buildProposalPrompt(
                new ProposalPromptOptions({
                  marker,
                  predictorName: ref.name,
                  moduleDescription: options.module.signature.description,
                  summary,
                  tip,
                  demos,
                  baselineInstruction: params.instructions,
                  diversityTemperature
                })
              )
              const proposed = yield* generateText(prompt).pipe(
                Effect.mapError(
                  () =>
                    new InstructionProposalFailed({
                      message: Str.concat(
                        Str.concat("Failed to propose instruction for predictor '", ref.name),
                        "'"
                      ),
                      predictorIndex
                    })
                )
              )

              return new InstructionCandidate({
                predictorName: ref.name,
                instruction: proposed,
                tip,
                cacheBustMarker: marker,
                prompt,
                isBaseline: false
              })
            }),
          { concurrency: 1 }
        )

        return new PredictorInstructionCandidates({
          predictorName: ref.name,
          candidates: Arr.appendAll(Arr.make(baselineCandidate(ref.name, params.instructions)), generated)
        })
      }), { concurrency: 1 })
  })
