/**
 * Stop request handling and heartbeat decision logic for trial pruning.
 *
 * @since 0.1.0
 */
import { Effect, Equal, Match, Option, Ref, Tuple } from "effect"

import * as StudyEvent from "../../../StudyEvent/index.js"
import type { EventRuntime } from "../../events.js"
import { appendEvent } from "../../events.js"
import {
  ContinueHeartbeat,
  type HeartbeatDecision,
  preferredStopRequest,
  StopHeartbeat,
  type StopMode,
  StopRequest
} from "../pruning.js"
import { StopRef } from "./model.js"

const stopRequest = (
  mode: StopMode,
  trialNumber: number,
  reason: string
): StopRequest =>
  new StopRequest({
    mode,
    requestedByTrialNumber: trialNumber,
    reason
  })

/**
 * Creates a fresh stop reference initialized to no active stop request.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeStopRef: Effect.Effect<StopRef> = Ref.make<Option.Option<StopRequest>>(Option.none()).pipe(
  Effect.map((ref) => new StopRef({ ref }))
)

/**
 * Evaluates whether the current trial should continue or stop based on the stop ref and mode.
 *
 * @since 0.1.0
 * @category utils
 */
export const heartbeatDecision = (
  stopRef: StopRef,
  mode: StopMode
): Effect.Effect<HeartbeatDecision> =>
  Ref.get(stopRef.ref).pipe(
    Effect.map(
      Option.match({
        onNone: () => ContinueHeartbeat(),
        onSome: (request) =>
          Match.value(mode).pipe(
            Match.when("Interrupt", () => StopHeartbeat({ mode: request.mode, reason: request.reason })),
            Match.when("Drain", () => ContinueHeartbeat()),
            Match.exhaustive
          )
      })
    )
  )

/**
 * Records a stop request from a trial, preferring the earliest request and most aggressive mode.
 *
 * @since 0.1.0
 * @category utils
 */
export const requestStudyStop = (
  runtime: EventRuntime,
  stopRef: StopRef,
  mode: StopMode,
  trialNumber: number,
  reason: string
): Effect.Effect<void> =>
  Ref.modify(stopRef.ref, (current) => {
    const candidate = stopRequest(mode, trialNumber, reason)

    return Option.match(current, {
      onNone: () => Tuple.make(Option.some(candidate), Option.some(candidate)),
      onSome: (existing) => {
        const selected = preferredStopRequest(existing, candidate)
        const changed = !Equal.equals(existing, selected)

        return Tuple.make(changed ? Option.some(selected) : Option.none<StopRequest>(), Option.some(selected))
      }
    })
  }).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.void,
        onSome: (request) =>
          appendEvent(
            runtime,
            StudyEvent.StudyStopRequested({
              mode: request.mode,
              reason: request.reason,
              requestedByTrialNumber: request.requestedByTrialNumber
            })
          )
      })
    )
  )
