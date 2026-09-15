/**
 * Study runtime initialization and restoration from persisted state.
 *
 * @since 0.1.0
 */
import type { StudyLifecycle } from "@scenesystems/effect-study/Lifecycle"
import { Array as Arr, type Context, Data, Effect, Option, Ref, type Schema, SubscriptionRef } from "effect"

import type * as StudyEvent from "../../StudyEvent/index.js"
import type * as Trial from "../../Trial/index.js"
import { bestValueFromTrials } from "../best.js"
import type { EventPublisher } from "../events.js"
import { noopEventPublisher } from "../events.js"
import { type OptimizeSettings, singleDirectionFromSettings } from "../options.js"
import type { StudyState } from "../state.js"
import { stateFromInitialTrials, trialsFromState } from "../state.js"
import { makeStopRef, type StopRef } from "./controls.js"
import { StudyClock } from "./runtimeState.js"

/**
 * Composite state pairing the lifecycle phase with the inner study trial data.
 *
 * @since 0.1.0
 * @category models
 */
export class RuntimeState<Config = unknown> extends Data.Class<{
  readonly lifecycle: StudyLifecycle
  readonly studyState: StudyState<Config>
}> {}

/**
 * Search runtime carrying serialized state, stop controls, ranking state, and event publication.
 *
 * @since 0.1.0
 * @category models
 */
export class StudyRuntime<Config = unknown> extends Data.Class<{
  readonly state: SubscriptionRef.SubscriptionRef<RuntimeState<Config>>
  readonly clock: Context.Tag.Service<typeof StudyClock>
  readonly stopRef: StopRef
  readonly completionReasonRef: Ref.Ref<Option.Option<StudyEvent.CompletionReason>>
  readonly bestValueRef: Ref.Ref<Option.Option<number>>
  readonly noImprovementCountRef: Ref.Ref<number>
  readonly eventPublisher: EventPublisher
}> {}

type Trials<Config> = Schema.Schema.Type<Schema.Array$<Schema.Schema<Trial.Trial<Config>>>>

const initialRuntimeState = <Config>(initialTrials: Trials<Config>): RuntimeState<Config> =>
  new RuntimeState({
    lifecycle: "Created",
    studyState: stateFromInitialTrials(initialTrials)
  })

const makeRuntime = <Config>(
  settings: OptimizeSettings,
  state: RuntimeState<Config>,
  eventPublisher: EventPublisher
): Effect.Effect<StudyRuntime<Config>, never, StudyClock> =>
  Effect.gen(function*() {
    return new StudyRuntime({
      state: yield* SubscriptionRef.make(state),
      clock: yield* StudyClock,
      stopRef: yield* makeStopRef,
      completionReasonRef: yield* Ref.make<Option.Option<StudyEvent.CompletionReason>>(Option.none()),
      bestValueRef: yield* Ref.make<Option.Option<number>>(
        Option.match(singleDirectionFromSettings(settings), {
          onNone: () => Option.none(),
          onSome: (direction) => bestValueFromTrials(direction, trialsFromState(state.studyState))
        })
      ),
      noImprovementCountRef: yield* Ref.make(0),
      eventPublisher
    })
  })

/**
 * Constructs a fresh study runtime from initial settings and optional prior trials.
 *
 * @since 0.1.0
 * @category constructors
 */
export const initializeRuntime = <Config>(
  settings: OptimizeSettings,
  initialTrials: Trials<Config> = Arr.empty(),
  eventPublisher: EventPublisher = noopEventPublisher
): Effect.Effect<StudyRuntime<Config>, never, StudyClock> =>
  makeRuntime(settings, initialRuntimeState(initialTrials), eventPublisher)

/**
 * Restores the lifecycle and history from a runtime snapshot into a fresh serialized reference.
 *
 * @since 0.1.0
 * @category constructors
 */
export const restoreRuntime = <Config>(
  settings: OptimizeSettings,
  snapshot: RuntimeState<Config>,
  eventPublisher: EventPublisher = noopEventPublisher
): Effect.Effect<StudyRuntime<Config>, never, StudyClock> => makeRuntime(settings, snapshot, eventPublisher)
