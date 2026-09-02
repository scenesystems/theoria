/**
 * Generates Phase 2 instruction candidates from dataset and demonstration context.
 *
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al., "Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs", 2024}
 * @since 0.1.0
 */
import { Array as Arr, Effect, Option, Ref, Schema } from "effect"
import { InstructionProposalFailed } from "../../Errors/optimizer.js"
import type { Example } from "../../Example/index.js"
import { collectModuleParamRefs } from "../../internal/module-params.js"
import type { Module as DspModule } from "../../Module/model.js"
import { generateText } from "../../Module/textGeneration.js"
import type { PredictorDemoCandidates } from "./bootstrap.js"
import {
  proposalIndices,
  proposalMarker,
  resolveDiversityTemperature,
  resolveSeed,
  resolveTipVocabulary,
  tipAt
} from "./runtime/policy.js"
import { buildProposalPrompt, datasetSummary, promptDemosFromCandidate } from "./runtime/prompt.js"

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
 * Configures instruction generation for every owned predictor.
 *
 * @typeParam I - Input fields used to describe the module and prompt examples.
 * @typeParam O - Output fields used to describe the module and prompt examples.
 *
 * @since 0.1.0
 * @category models
 */
export type ProposeInstructionCandidatesOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
> = Readonly<{
  /** Root whose current instructions become index-zero baselines. */
  readonly module: DspModule<I, O>
  /** Dataset counts and module description rendered into proposal prompts. */
  readonly trainset: ReadonlyArray<Example>
  /** Phase 1 context matched to predictors by exact name. */
  readonly demoCandidates: ReadonlyArray<PredictorDemoCandidates>
  /** Total candidates per predictor, including the baseline; invalid counts become one. */
  readonly numInstructions: number
  /** Positive integer used for tip selection and prompt markers. Defaults to `1`. */
  readonly seed?: number
  /** Numeric prompt text only; this value does not configure the model provider. */
  readonly diversityTemperature?: number
  /** Prompt hints selected cyclically; an empty or omitted array uses the built-in vocabulary. */
  readonly tipVocabulary?: ReadonlyArray<string>
}>

const resolvePredictorCandidates = (
  predictorName: string,
  candidateSets: ReadonlyArray<PredictorDemoCandidates>
): Option.Option<PredictorDemoCandidates> =>
  Arr.findFirst(candidateSets, (candidateSet) => candidateSet.predictorName === predictorName)

const baselineCandidate = (predictorName: string, instruction: string): InstructionCandidate =>
  new InstructionCandidate({
    predictorName,
    instruction,
    tip: "baseline",
    cacheBustMarker: proposalMarker(predictorName, 0, 0),
    prompt: "baseline",
    isBaseline: true
  })

/**
 * Generates ordered instruction candidates without mutating module parameters.
 *
 * @remarks
 * Predictors and their generated alternatives run sequentially. Each proposal
 * uses one Phase 1 candidate in cyclic order and sends a plain-text prompt to
 * the configured language model. A missing or empty Phase 1 candidate set, or
 * a provider failure, fails with `InstructionProposalFailed`. Provider failure
 * details are not retained in that error.
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
  O extends Schema.Struct.Fields
>(
  options: ProposeInstructionCandidatesOptions<I, O>
) =>
  Effect.gen(function*() {
    const refs = collectModuleParamRefs(options.module)
    const requested = proposalIndices(options.numInstructions)
    const seed = resolveSeed(options.seed)
    const tips = resolveTipVocabulary(options.tipVocabulary)
    const summary = datasetSummary(options.trainset)
    const diversityTemperature = resolveDiversityTemperature(options.diversityTemperature)

    return yield* Effect.forEach(refs, (ref, predictorIndex) =>
      Effect.gen(function*() {
        const params = yield* Ref.get(ref.params)
        const demoSet = yield* Option.match(resolvePredictorCandidates(ref.name, options.demoCandidates), {
          onNone: () =>
            Effect.fail(
              new InstructionProposalFailed({
                message: `Missing demo candidates for predictor '${ref.name}'`,
                predictorIndex
              })
            ),
          onSome: (candidateSet) => Effect.succeed(candidateSet)
        })
        const firstDemoCandidate = yield* Option.match(Arr.head(demoSet.candidates), {
          onNone: () =>
            Effect.fail(
              new InstructionProposalFailed({
                message: `Demo candidate set for predictor '${ref.name}' is empty`,
                predictorIndex
              })
            ),
          onSome: (candidate) => Effect.succeed(candidate)
        })

        const generated = yield* Effect.forEach(
          requested,
          (proposalOffset) =>
            Effect.gen(function*() {
              const proposalIndex = proposalOffset + 1
              const tip = tipAt(tips, seed + predictorIndex + proposalIndex)
              const marker = proposalMarker(ref.name, proposalIndex, seed)
              const candidate = Option.getOrElse(
                Arr.get(demoSet.candidates, proposalOffset % demoSet.candidates.length),
                () => firstDemoCandidate
              )
              const prompt = buildProposalPrompt({
                marker,
                predictorName: ref.name,
                moduleDescription: options.module.signature.description,
                summary,
                tip,
                demos: promptDemosFromCandidate(candidate.params.demos),
                baselineInstruction: params.instructions,
                diversityTemperature
              })
              const proposed = yield* generateText(prompt).pipe(
                Effect.mapError(
                  () =>
                    new InstructionProposalFailed({
                      message: `Failed to propose instruction for predictor '${ref.name}'`,
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
