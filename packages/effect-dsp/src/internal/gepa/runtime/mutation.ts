/** GEPA reflection uses training minibatches; validation only selects the return. @internal */
import type * as PseudoRandom from "@scenesystems/effect-math/PseudoRandom"
import { Array as Arr, Chunk, Effect, Number as Num, Option, Predicate, Record, Struct, Tuple } from "effect"
import type { Schema } from "effect"
import { events, type EventSink, type Examples, type Options, State } from "../../../GEPA.js"
import * as Predictor from "../../../Predictor.js"
import { CurrentRole } from "../../modelRole.js"
import { extractInstruction, generateText } from "../../module/textGeneration.js"
import { PredictorInstruction, ProgramCandidate } from "../model.js"
import { buildReflectivePrompt } from "../reflect.js"
import { nextMinibatch, selectParent } from "../sampling.js"
import { evaluateCandidate, reflectiveSamples } from "./evaluate.js"

/** Earliest aggregate maximum, including candidates outside the coverage front. @internal */
export const bestIndex = (scores: ReadonlyArray<ReadonlyArray<number>>) =>
  Arr.reduce(scores, { index: 0, score: Number.NEGATIVE_INFINITY }, (best, vector, index) => {
    const score = Num.sumAll(vector) / vector.length
    return score > best.score ? { index, score } : best
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
    const parentIndex = options.candidateSelectionStrategy === "currentBest"
      ? bestIndex(state.scoreVectors)
      : yield* selectParent(state.paretoSnapshot.parentWeights, rng)
    const parent = Option.getOrThrow(Arr.get(state.candidates, parentIndex))
    const sampled = yield* nextMinibatch(
      options.trainset.length,
      options.reflectionMinibatchSize ?? 3,
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
    if (
      (options.skipPerfectScore ?? true) &&
      Arr.every(evaluation.scores, (score) => score >= (options.perfectScore ?? 1))
    ) {
      return { state: evaluated, accepted: false }
    }
    if (Arr.every(evaluation.rows, (row) => Option.isNone(row.prediction) && Option.isNone(row.parseFailure))) {
      return { state: evaluated, accepted: false }
    }
    const names = Arr.map(parent.predictorInstructions, (entry) => Predictor.Path.make(entry.predictorName))
    const cursor = Option.getOrThrow(Arr.get(state.componentCursors, parentIndex))
    const selector = options.componentSelector ?? "roundRobin"
    const components = Predicate.isFunction(selector) ?
      selector(evaluated)
      : selector === "all"
      ? Chunk.fromIterable(names)
      : Chunk.of(Option.getOrThrow(Arr.get(names, cursor)))
    const cursors = selector === "roundRobin"
      ? Option.getOrThrow(
        Arr.modify(state.componentCursors, parentIndex, () => Num.remainder(cursor + 1, names.length))
      )
      : state.componentCursors
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
    if (Chunk.isEmpty(selected)) return { state: reflected, accepted: false }
    const instructions = options.instructionProposer
      ? yield* options.instructionProposer(parent, selected, feedback.examples)
      : Record.fromEntries(
        yield* Effect.forEach(selected, (path) =>
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
            return Tuple.make(path, extractInstruction(response, current))
          }))
      )
    const candidate = new ProgramCandidate({
      candidateId: `candidate-${state.candidates.length}`,
      parentIds: [parent.candidateId],
      predictorInstructions: Arr.map(parent.predictorInstructions, (entry) =>
        new PredictorInstruction({
          predictorName: entry.predictorName,
          instruction: Option.getOrElse(Record.get(instructions, entry.predictorName), () => entry.instruction)
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
    const previousSubsampleSum = Num.sumAll(evaluation.scores)
    const mutatedSubsampleSum = Num.sumAll(child.scores)
    const accepted = mutatedSubsampleSum > previousSubsampleSum
    const full = accepted ? yield* evaluateCandidate(options, candidate, valset, "select") : { scores: [] }
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
        metricCalls: reflected.metricCalls + examples.length + (accepted ? valset.length : 0),
        candidates: accepted ? Arr.append(state.candidates, candidate) : state.candidates,
        scoreVectors: accepted ? Arr.append(state.scoreVectors, full.scores) : state.scoreVectors,
        componentCursors: accepted ? Arr.append(cursors, Option.getOrThrow(Arr.get(cursors, parentIndex))) : cursors,
        lastIterationFoundNew: accepted,
        mergesDue: state.mergesDue +
          (accepted && (options.useMerge ?? true) && state.acceptedMerges < (options.maxMergeInvocations ?? 5) ? 1 : 0)
      }))
    }
  })
