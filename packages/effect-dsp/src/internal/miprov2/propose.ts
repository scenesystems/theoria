/**
 * Generates Phase 2 instruction candidates from dataset and demonstration context.
 *
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al., "Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs", 2024}
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, HashMap, Number as Num, Option, Ref, Schema, String as Str } from "effect"
import { Documents as DemoDocuments } from "../../Demonstration.js"
import { InstructionProposalFailed } from "../../DspError.js"
import {
  InstructionCandidate,
  type PredictorDemoCandidates,
  type PredictorDemoCandidateSets,
  PredictorInstructionCandidates,
  type ProposeInstructionCandidatesOptions
} from "../../MIPROv2Candidates.js"
import type { ModuleParameters } from "../../ModuleParameters.js"
import { generateText } from "../module/textGeneration.js"
import { collectModuleParamRefs, type ModuleParamRef } from "../moduleParameters.js"
import {
  proposalIndices,
  proposalMarker,
  resolveDiversityTemperature,
  resolveSeed,
  resolveTipVocabulary,
  tipAt
} from "./runtime/policy.js"
import { buildProposalPrompt, datasetSummary, ProposalPromptOptions } from "./runtime/prompt.js"

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
  readonly params: ModuleParameters
}> {}

const RenderedDemos = Schema.Array(DemoDocuments)
const RenderedDemoCandidates = Schema.Array(RenderedDemos)

class PreparedPredictor extends Data.Class<{
  readonly ref: ModuleParamRef
  readonly predictorIndex: number
  readonly params: ModuleParameters
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
      (candidate) => Effect.forEach(candidate.params.demos, resolved.ref.demonstrationCodec.encode)
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
