/** Scheduled common-ancestor merge consumes a whole iteration, accepted or not. @internal */
import type * as PseudoRandom from "@scenesystems/effect-math/PseudoRandom"
import { Array as Arr, Effect, Number as Num, Option, Struct, Tuple } from "effect"
import type { Schema } from "effect"
import { events, type EventSink, type Examples, type Options, State } from "../../../GEPA.js"
import { prepareMerge, selectMergeSubsample } from "../merge.js"
import { evaluateCandidate } from "./evaluate.js"

/** Accepted merges alone consume merge budget; every concrete proposal skips reflection. @internal */
export const runMergePhase = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R, EE, ER>(
  options: Options<I, O, ME, MR, E, R>,
  state: State,
  valset: Examples,
  rng: PseudoRandom.CPython,
  emit: EventSink<EE, ER>
) =>
  Effect.gen(function*() {
    const proposal = (options.useMerge ?? true) && state.lastIterationFoundNew && state.mergesDue > 0
      ? yield* prepareMerge(
        state.candidates,
        Arr.map(state.scoreVectors, (row) => Num.sumAll(row) / row.length),
        state.paretoSnapshot.frontierIndices,
        state.mergeTriplets,
        state.mergeDescriptions,
        valset.length >= 5,
        rng
      )
      : Option.none()
    if (Option.isNone(proposal)) {
      yield* emit(
        events.MergeChecked({
          iteration: state.iteration + 1,
          attempted: false,
          accepted: false,
          mergeBudgetRemaining: (options.maxMergeInvocations ?? 5) - state.acceptedMerges
        })
      )
      return {
        state: new State(Struct.assign(state, { lastIterationFoundNew: false })),
        attempted: false,
        accepted: false
      }
    }
    const { candidate, parents: [i, j], ancestor, description } = proposal.value
    const left = Option.getOrThrow(Arr.get(state.scoreVectors, i)),
      right = Option.getOrThrow(Arr.get(state.scoreVectors, j))
    const ids = yield* selectMergeSubsample(left, right, rng)
    const scores = yield* evaluateCandidate(
      options,
      candidate,
      Arr.map(ids, (index) => Option.getOrThrow(Arr.get(valset, index))),
      "select"
    )
    const accepted = Num.sumAll(scores.scores) >= Num.max(
      Num.sumAll(Arr.map(ids, (index) => Option.getOrThrow(Arr.get(left, index)))),
      Num.sumAll(Arr.map(ids, (index) => Option.getOrThrow(Arr.get(right, index))))
    )
    const full = accepted ? yield* evaluateCandidate(options, candidate, valset, "select") : { scores: [] }
    const next = new State(Struct.assign(state, {
      metricCalls: state.metricCalls + ids.length + (accepted ? valset.length : 0),
      candidates: accepted ? Arr.append(state.candidates, candidate) : state.candidates,
      scoreVectors: accepted ? Arr.append(state.scoreVectors, full.scores) : state.scoreVectors,
      componentCursors: accepted
        ? Arr.append(
          state.componentCursors,
          Num.max(
            Option.getOrThrow(Arr.get(state.componentCursors, i)),
            Option.getOrThrow(Arr.get(state.componentCursors, j))
          )
        )
        : state.componentCursors,
      mergesDue: state.mergesDue - (accepted ? 1 : 0),
      acceptedMerges: state.acceptedMerges + (accepted ? 1 : 0),
      lastIterationFoundNew: false,
      mergeTriplets: Arr.append(state.mergeTriplets, Tuple.make(i, j, ancestor)),
      mergeDescriptions: Arr.append(state.mergeDescriptions, Tuple.make(i, j, description))
    }))
    yield* emit(
      events.MergeChecked({
        iteration: state.iteration + 1,
        attempted: true,
        accepted,
        mergeBudgetRemaining: (options.maxMergeInvocations ?? 5) - next.acceptedMerges
      })
    )
    return { state: next, attempted: true, accepted }
  })
