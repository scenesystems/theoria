/** Scheduled common-ancestor merge consumes a whole iteration, accepted or not. @internal */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import type * as PseudoRandom from "@scenesystems/effect-math/PseudoRandom"
import { Array as Arr, Boolean, Effect, Number as Num, Option, Struct, Tuple } from "effect"
import type { Schema } from "effect"
import { events, type EventSink, type Examples, type Options, State } from "../../../GEPA.js"
import { type MergeProposal, prepareMerge, selectMergeSubsample } from "../merge.js"
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
    const maxMergeInvocations = Option.getOrElse(Option.fromUndefinedOr(options.maxMergeInvocations), () => 5)
    const proposal = yield* Boolean.match(
      Option.getOrElse(Option.fromUndefinedOr(options.useMerge), () => true) && state.lastIterationFoundNew &&
        state.mergesDue > 0,
      {
        onFalse: () => Effect.succeed(Option.none<MergeProposal>()),
        onTrue: () =>
          prepareMerge(
            state.candidates,
            // GEPAState.program_full_scores_val_set: builtin sum / len; these also weight the ancestor draw.
            Arr.map(state.scoreVectors, (row) => Num.divideUnsafe(Numeric.sumNeumaier(row), Arr.length(row))),
            state.paretoSnapshot.frontierIndices,
            state.mergeTriplets,
            state.mergeDescriptions,
            valset.length >= 5,
            rng
          )
      }
    )
    return yield* Option.match(proposal, {
      onNone: () =>
        Effect.gen(function*() {
          yield* emit(
            events.MergeChecked({
              iteration: state.iteration + 1,
              attempted: false,
              accepted: false,
              mergeBudgetRemaining: maxMergeInvocations - state.acceptedMerges
            })
          )
          return {
            state: new State(Struct.assign(state, { lastIterationFoundNew: false })),
            attempted: false,
            accepted: false
          }
        }),
      onSome: ({ ancestor, candidate, description, parents: [i, j] }) =>
        Effect.gen(function*() {
          const left = Option.getOrThrow(Arr.get(state.scoreVectors, i)),
            right = Option.getOrThrow(Arr.get(state.scoreVectors, j))
          const ids = yield* selectMergeSubsample(left, right, rng)
          const scores = yield* evaluateCandidate(
            options,
            candidate,
            Arr.map(ids, (index) => Option.getOrThrow(Arr.get(valset, index))),
            "select"
          )
          // Engine merge gate: sum(subsample_scores_after) >= max of the parents' builtin subsample sums.
          const accepted = Numeric.sumNeumaier(scores.scores) >= Num.max(
            Numeric.sumNeumaier(Arr.map(ids, (index) => Option.getOrThrow(Arr.get(left, index)))),
            Numeric.sumNeumaier(Arr.map(ids, (index) => Option.getOrThrow(Arr.get(right, index))))
          )
          const full = yield* Boolean.match(accepted, {
            onFalse: () => Effect.succeed({ scores: Arr.empty<number>() }),
            onTrue: () => evaluateCandidate(options, candidate, valset, "select")
          })
          const next = new State(Struct.assign(state, {
            metricCalls: state.metricCalls + ids.length +
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
              onFalse: () => state.componentCursors,
              onTrue: () =>
                Arr.append(
                  state.componentCursors,
                  Num.max(
                    Option.getOrThrow(Arr.get(state.componentCursors, i)),
                    Option.getOrThrow(Arr.get(state.componentCursors, j))
                  )
                )
            }),
            mergesDue: state.mergesDue - Boolean.match(accepted, { onFalse: () => 0, onTrue: () => 1 }),
            acceptedMerges: state.acceptedMerges + Boolean.match(accepted, { onFalse: () => 0, onTrue: () => 1 }),
            lastIterationFoundNew: false,
            mergeTriplets: Arr.append(state.mergeTriplets, Tuple.make(i, j, ancestor)),
            mergeDescriptions: Arr.append(state.mergeDescriptions, Tuple.make(i, j, description))
          }))
          yield* emit(
            events.MergeChecked({
              iteration: state.iteration + 1,
              attempted: true,
              accepted,
              mergeBudgetRemaining: maxMergeInvocations - next.acceptedMerges
            })
          )
          return { state: next, attempted: true, accepted }
        })
    })
  })
