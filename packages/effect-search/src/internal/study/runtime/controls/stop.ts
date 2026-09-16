/**
 * Stop request handling and heartbeat decision logic for trial pruning.
 *
 * @since 0.1.0
 */
import * as Stop from "@scenesystems/effect-study/Stop"
import { Effect, Option } from "effect"

import type { ArtifactStorageError } from "../../../../SearchError.js"
import * as StudyEvent from "../../../../StudyEvent.js"
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
export const requestStudyStop = (
  runtime: EventRuntime,
  stopRef: StopRef,
  mode: Stop.Mode,
  trialNumber: number,
  reason: string
): Effect.Effect<void, ArtifactStorageError> =>
  Stop.request(stopRef, new Stop.Request({ mode, requestedByTrialNumber: trialNumber, reason })).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.void,
        onSome: (request) =>
          appendEvent(
            runtime,
            StudyEvent.stopRequested({
              mode: request.mode,
              reason: request.reason,
              requestedByTrialNumber: request.requestedByTrialNumber
            })
          )
      })
    )
  )
