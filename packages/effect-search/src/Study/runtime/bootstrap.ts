/**
 * Study runtime initialization and restoration from persisted state.
 *
 * @since 0.1.0
 */
import { Machine } from "@effect/experimental"
import { Data, Effect, Option, Ref, Request } from "effect"
import type { Scope } from "effect"

import type * as StudyEvent from "../../StudyEvent/index.js"
import type * as Trial from "../../Trial/index.js"
import type { EventPublisher } from "../events.js"
import { noopEventPublisher } from "../events.js"
import { type OptimizeSettings, singleDirectionFromSettings } from "../options.js"
import type { StudyState } from "../state.js"
import { stateFromInitialTrials, trialsFromState } from "../state.js"
import { makeStopRef, type StopRef } from "./controls.js"
import type { StudyLifecycle } from "./lifecycle.js"
import type { StudyClock } from "./runtimeState.js"
import { type SuggestionState, suggestionStateFromStudyState } from "./suggestionState.js"
import { warmStopStateFromTrials } from "./warmStopState.js"

/**
 * Composite state pairing the lifecycle phase with the inner study trial data.
 *
 * @since 0.1.0
 * @category models
 */
export class RuntimeState<Config = unknown> extends Data.Class<{
  readonly lifecycle: StudyLifecycle
  readonly studyState: StudyState<Config>
  readonly suggestionState: SuggestionState
}> {}

type RuntimeMutationRequest<Config, A, E> = Request.Request<A, E> & {
  readonly _tag: "effect-search/StudyRuntimeMutation"
  readonly run: (state: RuntimeState<Config>) => Effect.Effect<readonly [A, RuntimeState<Config>], E, StudyClock>
}

type RuntimeMutationAny<Config> = RuntimeMutationRequest<Config, unknown, unknown>

type RuntimeMachine<Config> = Machine.Machine<
  RuntimeState<Config>,
  RuntimeMutationAny<Config>,
  never,
  void,
  never,
  StudyClock
>

/**
 * @since 0.1.0
 * @category type-level
 */
export type RuntimeActor<Config> = Machine.Actor<RuntimeMachine<Config>>

/**
 * @since 0.1.0
 * @category constructors
 */
export const runtimeMutation = <Config, A, E>(
  run: (state: RuntimeState<Config>) => Effect.Effect<readonly [A, RuntimeState<Config>], E, StudyClock>
): RuntimeMutationRequest<Config, A, E> =>
  Request.tagged<RuntimeMutationRequest<Config, A, E>>("effect-search/StudyRuntimeMutation")({ run })

const makeRuntimeMachine = <Config>(initialState: RuntimeState<Config>): RuntimeMachine<Config> =>
  Machine.make(
    Machine.procedures.make(initialState, { identifier: "effect-search/StudyRuntimeMachine" }).pipe(
      Machine.procedures.add<RuntimeMutationAny<Config>>()("effect-search/StudyRuntimeMutation", ({ request, state }) =>
        request.run(state))
    )
  )

/**
 * Aggregated runtime handle carrying the state actor, stop controls, best-value tracking, and event publisher.
 *
 * @since 0.1.0
 * @category models
 */
export class StudyRuntime<Config = unknown> extends Data.Class<{
  readonly stateActor: RuntimeActor<Config>
  readonly stopRef: StopRef
  readonly completionReasonRef: Ref.Ref<Option.Option<StudyEvent.CompletionReason>>
  readonly bestValueRef: Ref.Ref<Option.Option<number>>
  readonly noImprovementCountRef: Ref.Ref<number>
  readonly eventPublisher: EventPublisher
}> {}

const runtimeStateFromStudyState = <Config>(
  settings: OptimizeSettings,
  lifecycle: StudyLifecycle,
  studyState: StudyState<Config>
): RuntimeState<Config> =>
  new RuntimeState({
    lifecycle,
    studyState,
    suggestionState: suggestionStateFromStudyState(
      settings.objectiveSpec,
      studyState,
      settings.priorWeight,
      settings.epsilon
    )
  })

const initialRuntimeState = <Config>(
  settings: OptimizeSettings,
  initialTrials: ReadonlyArray<Trial.Trial<Config>>
): RuntimeState<Config> => runtimeStateFromStudyState(settings, "Created", stateFromInitialTrials(initialTrials))

const makeRuntimeFromActor = <Config>(
  settings: OptimizeSettings,
  stateActor: RuntimeActor<Config>,
  trials: ReadonlyArray<Trial.Trial<Config>>,
  eventPublisher: EventPublisher
): Effect.Effect<StudyRuntime<Config>> =>
  Effect.gen(function*() {
    const warmStopState = Option.match(singleDirectionFromSettings(settings), {
      onNone: () => Option.none(),
      onSome: (direction) => Option.some(warmStopStateFromTrials(direction, trials))
    })

    return new StudyRuntime({
      stateActor,
      stopRef: yield* makeStopRef,
      completionReasonRef: yield* Ref.make<Option.Option<StudyEvent.CompletionReason>>(Option.none()),
      bestValueRef: yield* Ref.make(
        Option.match(warmStopState, {
          onNone: () => Option.none(),
          onSome: (state) => state.bestValue
        })
      ),
      noImprovementCountRef: yield* Ref.make(
        Option.match(warmStopState, {
          onNone: () => 0,
          onSome: (state) => state.noImprovementCount
        })
      ),
      eventPublisher
    })
  })

/**
 * Boots a fresh study runtime from initial settings and optional prior trials, returning a scoped StudyRuntime.
 *
 * @since 0.1.0
 * @category constructors
 */
export const initializeRuntime = <Config>(
  settings: OptimizeSettings,
  initialTrials: ReadonlyArray<Trial.Trial<Config>> = [],
  eventPublisher: EventPublisher = noopEventPublisher
): Effect.Effect<StudyRuntime<Config>, never, StudyClock | Scope.Scope> =>
  Effect.gen(function*() {
    const stateActor = yield* Machine.boot(makeRuntimeMachine(initialRuntimeState(settings, initialTrials)))

    return yield* makeRuntimeFromActor(settings, stateActor, initialTrials, eventPublisher)
  })

/**
 * Restores a study runtime from a previously persisted snapshot, replaying the state machine to its saved position.
 *
 * @since 0.1.0
 * @category constructors
 */
export const restoreRuntime = <Config>(
  settings: OptimizeSettings,
  snapshot: RuntimeState<Config>,
  eventPublisher: EventPublisher = noopEventPublisher
): Effect.Effect<StudyRuntime<Config>, never, StudyClock | Scope.Scope> =>
  Effect.gen(function*() {
    const restoredState = runtimeStateFromStudyState(settings, snapshot.lifecycle, snapshot.studyState)
    const stateActor = yield* Machine.boot(makeRuntimeMachine(restoredState), undefined, {
      previousState: restoredState
    })
    return yield* makeRuntimeFromActor(settings, stateActor, trialsFromState(snapshot.studyState), eventPublisher)
  })
