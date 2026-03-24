/**
 * MIPROv2 Phase 2 — grounded instruction proposal via meta-LLM calls with
 * dataset summaries and demonstration context.
 *
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al., "Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs", 2024}
 * @since 0.0.0
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
 * One instruction proposal — carries the proposed instruction text, the
 * diversity tip used, the rendered prompt, and whether this is the baseline
 * (original) instruction.
 *
 * @since 0.0.0
 * @category models
 */
export class InstructionCandidate extends Schema.Class<InstructionCandidate>("MIPROv2InstructionCandidate")({
  predictorName: Schema.String,
  instruction: Schema.String,
  tip: Schema.String,
  cacheBustMarker: Schema.String,
  prompt: Schema.String,
  isBaseline: Schema.Boolean
}) {}

/**
 * Phase 2 proposals grouped by predictor — each predictor gets a baseline
 * plus `numInstructions` proposed alternatives.
 *
 * @since 0.0.0
 * @category models
 */
export class PredictorInstructionCandidates
  extends Schema.Class<PredictorInstructionCandidates>("MIPROv2PredictorInstructionCandidates")({
    predictorName: Schema.String,
    candidates: Schema.Array(InstructionCandidate)
  })
{}

/**
 * Phase 2 configuration — module, training set, demo candidates from
 * Phase 1, and diversity controls.
 *
 * @since 0.0.0
 * @category models
 */
export type ProposeInstructionCandidatesOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
> = Readonly<{
  readonly module: DspModule<I, O>
  readonly trainset: ReadonlyArray<Example>
  readonly demoCandidates: ReadonlyArray<PredictorDemoCandidates>
  readonly numInstructions: number
  readonly seed?: number
  readonly diversityTemperature?: number
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
 * Generate grounded instruction candidates for each predictor. The baseline
 * instruction is always preserved at position 0. Each proposal uses a
 * diversity tip and demonstration context from Phase 1 candidates.
 *
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al. (2024)}
 * @since 0.0.0
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
