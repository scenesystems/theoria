import { Deferred, Effect, Match, Option, Queue, Ref, Stream } from "effect"

import type { EntryError } from "../../../contracts/entry-error.js"
import type { EvidenceEvent } from "../../../contracts/evidence/stream.js"

import {
  type AuthoredStepQueueEvent,
  type CompletionEvent,
  type ProjectionDriverDescriptor,
  type ProjectionDriverEvent,
  type ProjectionDriverSnapshot
} from "../../runtime/kernel/surface-runtime.js"
import type { RunRegistry } from "../run-registry-context.js"
import type { RunSignal } from "./lifecycle.js"

export type ServerEvidenceEvent = {
  readonly _tag: "ServerEvidenceEvent"
  readonly event: EvidenceEvent
}

export type PipelineEvent = ServerEvidenceEvent | ProjectionDriverEvent

export const projectionEvidenceStreamFor = (
  projectionDriver: Option.Option<ProjectionDriverDescriptor>,
  registry: RunRegistry,
  signal: RunSignal,
  snapshot: ProjectionDriverSnapshot,
  stepQueue: Queue.Queue<AuthoredStepQueueEvent>,
  serverCompleted: Deferred.Deferred<CompletionEvent>
): Stream.Stream<PipelineEvent, EntryError, never> =>
  Option.match(projectionDriver, {
    onNone: () => Stream.empty,
    onSome: (driver) =>
      driver.stream(registry, signal, snapshot, stepQueue, serverCompleted).pipe(
        Stream.map((event): PipelineEvent => event)
      )
  })

export const recordServerCompletion = (
  completionRef: Ref.Ref<Option.Option<CompletionEvent>>,
  serverCompleted: Deferred.Deferred<CompletionEvent>,
  event: EvidenceEvent
): Effect.Effect<void, never, never> =>
  Match.value(event).pipe(
    Match.tag("StreamComplete", (completion) =>
      Ref.set(completionRef, Option.some(completion)).pipe(
        Effect.zipRight(Deferred.succeed(serverCompleted, completion))
      )),
    Match.orElse(() => Effect.void)
  )

export const enqueueAuthoredStep = (
  stepQueue: Queue.Queue<AuthoredStepQueueEvent>,
  event: EvidenceEvent
): Effect.Effect<void, never, never> =>
  Match.value(event).pipe(
    Match.tag("Step", ({ frame }) => Queue.offer(stepQueue, frame).pipe(Effect.asVoid)),
    Match.tag("StreamComplete", (completion) => Queue.offer(stepQueue, completion).pipe(Effect.asVoid)),
    Match.orElse(() => Effect.void)
  )
