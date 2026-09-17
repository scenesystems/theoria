/**
 * Optimization runtime initialization and restoration from persisted state.
 *
 * @since 0.1.0
 */
import * as History from "@scenesystems/effect-study/History"
import * as GenericStudy from "@scenesystems/effect-study/Study"
import { Array as Arr, Data, Effect, Option, Ref } from "effect"
import type { Scope } from "effect"

import type * as OptimizationEvent from "../../../OptimizationEvent.js"
import type * as Trial from "../../../Trial.js"
import { bestValueFromTrials } from "../best.js"
import type { EventPublisher } from "../events.js"
import { noopEventPublisher } from "../events.js"
import type { OptimizeSettings } from "../options/plan.js"
import { singleDirectionFromSettings } from "../options/settings.js"
import { makeStopRef, type StopRef } from "./controls.js"

/**
 * Search-specific controls and ranking state around a generic scoped study.
 *
 * @since 0.1.0
 * @category models
 */
export class OptimizationRuntime<Config = unknown> extends Data.Class<{
  readonly study: GenericStudy.Study<Config, Trial.State>
  readonly stopRef: StopRef
  readonly completionReasonRef: Ref.Ref<Option.Option<OptimizationEvent.CompletionReason>>
  readonly bestValueRef: Ref.Ref<Option.Option<number>>
  readonly noImprovementCountRef: Ref.Ref<number>
  readonly eventPublisher: EventPublisher
}> {}

const initialState = <Config>(initialTrials: Iterable<Trial.Trial<Config>>): GenericStudy.State<Config, Trial.State> =>
  new GenericStudy.State({
    lifecycle: "Created",
    history: History.fromIterable(initialTrials)
  })

const makeRuntime = <Config>(
  settings: OptimizeSettings,
  state: GenericStudy.State<Config, Trial.State>,
  eventPublisher: EventPublisher
): Effect.Effect<OptimizationRuntime<Config>, never, Scope.Scope> =>
  Effect.gen(function*() {
    return new OptimizationRuntime({
      study: yield* GenericStudy.fromState(state),
      stopRef: yield* makeStopRef,
      completionReasonRef: yield* Ref.make<Option.Option<OptimizationEvent.CompletionReason>>(Option.none()),
      bestValueRef: yield* Ref.make<Option.Option<number>>(
        Option.match(singleDirectionFromSettings(settings), {
          onNone: () => Option.none(),
          onSome: (direction) => bestValueFromTrials(direction, History.values(state.history))
        })
      ),
      noImprovementCountRef: yield* Ref.make(0),
      eventPublisher
    })
  })

/**
 * Constructs a fresh optimization runtime from initial settings and optional prior trials.
 *
 * @since 0.1.0
 * @category constructors
 */
export const initializeRuntime = <Config>(
  settings: OptimizeSettings,
  initialTrials: Iterable<Trial.Trial<Config>> = Arr.empty(),
  eventPublisher: EventPublisher = noopEventPublisher
): Effect.Effect<OptimizationRuntime<Config>, never, Scope.Scope> =>
  makeRuntime(settings, initialState(initialTrials), eventPublisher)

/**
 * Restores the lifecycle and history from a runtime snapshot into a fresh serialized reference.
 *
 * @since 0.1.0
 * @category constructors
 */
export const restoreRuntime = <Config>(
  settings: OptimizeSettings,
  snapshot: GenericStudy.State<Config, Trial.State>,
  eventPublisher: EventPublisher = noopEventPublisher
): Effect.Effect<OptimizationRuntime<Config>, never, Scope.Scope> => makeRuntime(settings, snapshot, eventPublisher)
