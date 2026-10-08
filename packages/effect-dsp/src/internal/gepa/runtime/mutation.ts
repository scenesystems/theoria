/** GEPA reflection uses training minibatches; validation only selects the return. @internal */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import type * as PseudoRandom from "@scenesystems/effect-math/PseudoRandom"
import {
  Array as Arr,
  Boolean,
  Chunk,
  Effect,
  Match,
  Number as Num,
  Option,
  Predicate,
  Record,
  Struct,
  Tuple
} from "effect"
import type { Schema } from "effect"
import {
  events,
  type EventSink,
  type Examples,
  type Options,
  PredictorInstruction,
  ProgramCandidate,
  State
} from "../../../GEPA.js"
import { predictors } from "../../../ModuleGraph.js"
import * as Predictor from "../../../Predictor.js"
import { CurrentRole } from "../../modelRole.js"
import { extractInstruction, generateText } from "../../module/textGeneration.js"
import { buildReflectivePrompt } from "../reflect.js"
import { nextMinibatch, selectParent } from "../sampling.js"
import { validateComponents } from "../validation.js"
import { evaluateCandidate, reflectiveSamples } from "./evaluate.js"

/** Earliest aggregate maximum, including candidates outside the coverage front.
 * Aggregates are GEPA's `sum(scores) / len(scores)` with CPython's builtin sum. @internal */
export const bestIndex = (scores: ReadonlyArray<ReadonlyArray<number>>) =>
  Arr.reduce(scores, { index: 0, score: Number.NEGATIVE_INFINITY }, (best, vector, index) => {
    const score = Num.divideUnsafe(Numeric.sumNeumaier(vector), Arr.length(vector))
    return Boolean.match(score > best.score, { onFalse: () => best, onTrue: () => ({ index, score }) })
  }).index

/** One parent choice, one training minibatch, then optional proposal and full validation. @internal */
export const runMutationPhase = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R, EE, ER>(
  options: Options<I, O, ME, MR, E, R>,
  state: State,
  valset: Examples,
  rng: PseudoRandom.CPython,
  adapterRng: PseudoRandom.CPython,
  emit: EventSink<EE, ER>
) =>
  Effect.gen(function*() {
    const parentIndex = yield* Boolean.match(options.candidateSelectionStrategy === "currentBest", {
      onFalse: () => selectParent(state.paretoSnapshot.parentWeights, rng),
      onTrue: () => Effect.succeed(bestIndex(state.scoreVectors))
    })
    const parent = Option.getOrThrow(Arr.get(state.candidates, parentIndex))
    const sampled = yield* nextMinibatch(
      options.trainset.length,
      Option.getOrElse(Option.fromUndefinedOr(options.reflectionMinibatchSize), () => 3),
      state.iteration,
      state.batch,
      rng
    )
    const examples = Arr.map(sampled.batch, (index) => Option.getOrThrow(Arr.get(options.trainset, index)))
    const evaluation = yield* evaluateCandidate(options, parent, examples, "search")
    const evaluated = new State(
      Struct.assign(state, {
        batch: sampled.state,
        metricCalls: state.metricCalls + examples.length,
        lastIterationFoundNew: false
      })
    )
    const skipped = (
      Option.getOrElse(Option.fromUndefinedOr(options.skipPerfectScore), () => true) &&
      Arr.every(
        evaluation.scores,
        (score) => score >= Option.getOrElse(Option.fromUndefinedOr(options.perfectScore), () => 1)
      )
    ) || Arr.every(evaluation.rows, (row) => Option.isNone(row.prediction) && Option.isNone(row.parseFailure))
    return yield* Boolean.match(skipped, {
      onTrue: () => Effect.succeed({ state: evaluated, accepted: false }),
      onFalse: () =>
        Effect.gen(function*() {
          const names = Arr.map(parent.predictorInstructions, (entry) => Predictor.Path.make(entry.predictorName))
          const cursor = Option.getOrThrow(Arr.get(state.componentCursors, parentIndex))
          const selector = Option.getOrElse(
            Option.fromUndefinedOr(options.componentSelector),
            (): "roundRobin" => "roundRobin"
          )
          const components = Match.value(selector).pipe(
            Match.when(Predicate.isFunction, (select) => select(evaluated)),
            Match.when("all", () => Chunk.fromIterable(names)),
            Match.orElse(() => Chunk.of(Option.getOrThrow(Arr.get(names, cursor))))
          )
          yield* validateComponents(
            components,
            names,
            Arr.map(Arr.filter(Arr.fromIterable(predictors(options.module)), Struct.get("frozen")), Struct.get("path"))
          )
          const cursors = Boolean.match(selector === "roundRobin", {
            onFalse: () => state.componentCursors,
            onTrue: () =>
              Option.getOrThrow(
                Arr.modify(state.componentCursors, parentIndex, () => Num.remainder(cursor + 1, names.length))
              )
          })
          const feedback = yield* reflectiveSamples(options, evaluation.rows, components, adapterRng)
          const reflected = new State(
            Struct.assign(evaluated, {
              componentCursors: cursors,
              feedbackMetricCalls: evaluated.feedbackMetricCalls + feedback.feedbackCalls
            })
          )
          const selected = Chunk.filter(
            components,
            (path) => Option.exists(Record.get(feedback.examples, path), Arr.isReadonlyArrayNonEmpty)
          )
          return yield* Boolean.match(Chunk.isEmpty(selected), {
            onTrue: () => Effect.succeed({ state: reflected, accepted: false }),
            onFalse: () =>
              Effect.gen(function*() {
                const instructions = yield* Option.match(Option.fromUndefinedOr(options.instructionProposer), {
                  onSome: (propose) => propose(parent, selected, feedback.examples),
                  onNone: () =>
                    Effect.forEach(selected, (path) =>
                      Effect.gen(function*() {
                        const current = Option.getOrThrow(Arr.findFirst(parent.predictorInstructions, (entry) =>
                          entry.predictorName === path)).instruction
                        const prompt = buildReflectivePrompt({
                          predictorName: path,
                          currentInstruction: current,
                          examples: Option.getOrThrow(Record.get(feedback.examples, path))
                        })
                        const response = yield* generateText(prompt, options.reflectionSettings).pipe(
                          Effect.provideService(CurrentRole, "critic")
                        )
                        return Tuple.make(path, extractInstruction(response))
                      })).pipe(Effect.map(Record.fromEntries))
                })
                const candidate = new ProgramCandidate({
                  candidateId: `candidate-${state.candidates.length}`,
                  parentIds: [parent.candidateId],
                  predictorInstructions: Arr.map(parent.predictorInstructions, (entry) =>
                    new PredictorInstruction({
                      predictorName: entry.predictorName,
                      instruction: Option.getOrElse(
                        Record.get(instructions, entry.predictorName),
                        () => entry.instruction
                      )
                    }))
                })
                yield* Effect.forEach(Record.toEntries(instructions), ([predictorName, instruction]) =>
                  emit(events.MutationProposed({
                    iteration: state.iteration + 1,
                    parentId: parent.candidateId,
                    mutatedCandidateId: candidate.candidateId,
                    predictorName,
                    instruction
                  })))
                const child = yield* evaluateCandidate(options, candidate, examples, "search")
                // StrictImprovementAcceptance compares builtin sums of the two minibatch score lists.
                const previousSubsampleSum = Numeric.sumNeumaier(evaluation.scores)
                const mutatedSubsampleSum = Numeric.sumNeumaier(child.scores)
                const accepted = mutatedSubsampleSum > previousSubsampleSum
                const full = yield* Boolean.match(accepted, {
                  onFalse: () => Effect.succeed({ scores: Arr.empty<number>() }),
                  onTrue: () => evaluateCandidate(options, candidate, valset, "select")
                })
                yield* emit(
                  events.AcceptanceEvaluated({
                    iteration: state.iteration + 1,
                    accepted,
                    gate1Passed: accepted,
                    fullValsetEvaluated: accepted,
                    previousSubsampleSum,
                    mutatedSubsampleSum
                  })
                )
                return {
                  accepted,
                  state: new State(Struct.assign(reflected, {
                    metricCalls: reflected.metricCalls + examples.length +
                      Boolean.match(accepted, { onFalse: () => 0, onTrue: () => valset.length }),
                    candidates: Boolean.match(accepted, {
                      onFalse: () => state.candidates,
                      onTrue: () => Arr.append(state.candidates, candidate)
                    }),
                    scoreVectors: Boolean.match(accepted, {
                      onFalse: () => state.scoreVectors,
                      onTrue: () => Arr.append(state.scoreVectors, full.scores)
                    }),
                    componentCursors: Boolean.match(accepted, {
                      onFalse: () => cursors,
                      onTrue: () => Arr.append(cursors, Option.getOrThrow(Arr.get(cursors, parentIndex)))
                    }),
                    lastIterationFoundNew: accepted,
                    mergesDue: state.mergesDue +
                      Boolean.match(
                        accepted && Option.getOrElse(Option.fromUndefinedOr(options.useMerge), () => true) &&
                          state.acceptedMerges <
                            Option.getOrElse(Option.fromUndefinedOr(options.maxMergeInvocations), () => 5),
                        { onFalse: () => 0, onTrue: () => 1 }
                      )
                  }))
                }
              })
          })
        })
    })
  })
