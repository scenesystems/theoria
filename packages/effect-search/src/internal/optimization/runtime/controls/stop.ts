/**
 * Optimization stop requests and heartbeat decisions for trial pruning.
 *
 * @since 0.1.0
 */
import type * as Journal from "@scenesystems/effect-study/Journal"
import * as Stop from "@scenesystems/effect-study/Stop"
import { Effect, Option } from "effect"

import * as OptimizationEvent from "../../../../OptimizationEvent.js"
import type { EventRuntime } from "../../events.js"
import { appendEvent } from "../../events.js"
import type { StopRef } from "./reportState.js"

/**
 * Creates a fresh stop reference initialized to no active stop request.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeStopRef: Effect.Effect<StopRef> = Stop.make

/**
 * Evaluates whether the current trial should continue or stop based on the stop ref and mode.
 *
 * @since 0.1.0
 * @category utils
 */
export const heartbeatDecision = (
  stopRef: StopRef,
  mode: Stop.Mode
): Effect.Effect<Stop.Decision> => Stop.heartbeat(stopRef, mode)

/**
 * Records a stop request from a trial, preferring the earliest request and most aggressive mode.
 *
 * @since 0.1.0
 * @category utils
 */
export const requestOptimizationStop = (
  runtime: EventRuntime,
  stopRef: StopRef,
  mode: Stop.Mode,
  trialNumber: number,
  reason: string
): Effect.Effect<void, Journal.Failure> =>
  Stop.request(stopRef, new Stop.Request({ mode, requestedByTrialNumber: trialNumber, reason })).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.void,
        onSome: (request) =>
          appendEvent(
            runtime,
            OptimizationEvent.StopRequested({
              mode: request.mode,
              reason: request.reason,
              requestedByTrialNumber: request.requestedByTrialNumber
            })
          )
      })
    )
  )
