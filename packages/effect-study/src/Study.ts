/**
 * Scoped, transactional ownership of a study lifecycle and typed trial history.
 *
 * @since 0.1.0
 * @module
 */
import { Array as Arr, Boolean as Bool, Data, Effect, Match, String as Str, SubscriptionRef, Tuple } from "effect"
import type { Scope, Stream } from "effect"

import * as History from "./History.js"
import * as Lifecycle from "./Lifecycle.js"
import type * as Trial from "./Trial.js"

/**
 * An immutable study snapshot. Lifecycle and history share one value so every
 * published change observes a coherent pair.
 *
 * @since 0.1.0
 * @category models
 */
export class State<Config, TrialState> extends Data.Class<{
  readonly lifecycle: Lifecycle.Lifecycle
  readonly history: History.History<Config, TrialState>
}> {}

/**
 * A scoped study backed by Effect's serialized, observable reference.
 *
 * @since 0.1.0
 * @category models
 */
export class Study<Config, TrialState> extends Data.Class<{
  readonly state: SubscriptionRef.SubscriptionRef<State<Config, TrialState>>
}> {}

/**
 * Restores a scoped study from an immutable snapshot. Closing the owning scope
 * cancels a created, running, or paused study; an already-terminal snapshot is unchanged.
 *
 * @since 0.1.0
 * @category constructors
 */
export const fromState = <Config, TrialState>(
  state: State<Config, TrialState>
): Effect.Effect<Study<Config, TrialState>, never, Scope.Scope> =>
  Effect.gen(function*() {
    const study = new Study({ state: yield* SubscriptionRef.make(state) })
    yield* Effect.addFinalizer(() => transition(study, "Cancelled"))
    return study
  })

/**
 * Creates a scoped study in the `Created` phase from optional prior trials.
 *
 * @since 0.1.0
 * @category constructors
 */
export const make = <Config, TrialState>(
  trials: Iterable<Trial.Trial<Config, TrialState>> = Arr.empty()
): Effect.Effect<Study<Config, TrialState>, never, Scope.Scope> =>
  fromState(new State({ lifecycle: "Created", history: History.fromIterable(trials) }))

/**
 * Reads one atomic snapshot of lifecycle and history.
 *
 * @since 0.1.0
 * @category accessors
 */
export const read = <Config, TrialState>(
  self: Study<Config, TrialState>
): Effect.Effect<State<Config, TrialState>> => SubscriptionRef.get(self.state)

/**
 * Runs a serialized transaction over the complete study snapshot. The new
 * state is published only after the transaction succeeds. Failure or
 * interruption leaves the prior snapshot visible and releases the serializer.
 * Returning an illegal lifecycle change is a programmer invariant violation:
 * the transaction dies with a diagnostic before any part of its snapshot is
 * committed or published. Use {@link transition} for no-op transition requests.
 *
 * @since 0.1.0
 * @category operations
 */
export const modify = <Config, TrialState, A, E, R>(
  self: Study<Config, TrialState>,
  transaction: (
    state: State<Config, TrialState>
  ) => Effect.Effect<readonly [A, State<Config, TrialState>], E, R>
): Effect.Effect<A, E, R> =>
  SubscriptionRef.modifyEffect(self.state, (state) =>
    transaction(state).pipe(
      Effect.flatMap((resultAndNext) => {
        const result = Tuple.getFirst(resultAndNext)
        const next = Tuple.getSecond(resultAndNext)
        return Match.value(
          Bool.or(
            Str.Equivalence(state.lifecycle, next.lifecycle),
            Lifecycle.canTransition(state.lifecycle, next.lifecycle)
          )
        ).pipe(
          Match.when(true, () => Effect.succeed(Tuple.make(result, next))),
          Match.orElse(() =>
            Effect.die(
              Str.concat(
                Str.concat(
                  Str.concat("Study.modify invariant violated: illegal lifecycle transition ", state.lifecycle),
                  " -> "
                ),
                next.lifecycle
              )
            )
          )
        )
      })
    ))

/**
 * Applies a valid lifecycle transition atomically with the current history.
 * Invalid transitions are no-ops, so terminal studies can never reopen.
 *
 * @since 0.1.0
 * @category operations
 */
export const transition = <Config, TrialState>(
  self: Study<Config, TrialState>,
  lifecycle: Lifecycle.Lifecycle
): Effect.Effect<void> =>
  modify(self, (state) =>
    Match.value(Lifecycle.canTransition(state.lifecycle, lifecycle)).pipe(
      Match.when(true, () => Effect.succeed(Tuple.make(undefined, new State({ lifecycle, history: state.history })))),
      Match.orElse(() => Effect.succeed(Tuple.make(undefined, state)))
    ))

/**
 * Streams the current snapshot followed by every committed transaction.
 *
 * @since 0.1.0
 * @category conversions
 */
export const changes = <Config, TrialState>(
  self: Study<Config, TrialState>
): Stream.Stream<State<Config, TrialState>> => self.state.changes
