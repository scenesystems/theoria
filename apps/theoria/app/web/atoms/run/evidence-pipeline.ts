import { Deferred, Effect, Option, Queue, Ref, Stream } from "effect"

import type { EntryError, EntryExecutionError } from "../../../contracts/entry-error.js"
import type { EntryId } from "../../../contracts/entry/id.js"
import { EvidenceStore } from "../../../contracts/evidence/store.js"
import type { EvidenceEvent } from "../../../contracts/evidence/stream.js"
import type { CanonicalFrame } from "../../../contracts/study/workflow/canonical-step.js"
import type { ChoreographyCue, ChoreographyState } from "../../../contracts/study/workflow/choreography.js"
import { initialChoreographyState } from "../../../contracts/study/workflow/choreography.js"
import type { LocalRunFrame } from "../../state/run/local.js"

import type {
  AuthoredStepQueueEvent,
  CompletionEvent,
  ProjectionDriverDescriptor,
  ProjectionDriverSnapshot,
  SurfaceRuntime,
  SurfaceRuntimeServices,
  SurfaceRuntimeSnapshot
} from "../../runtime/kernel/surface-runtime.js"
import type { RunRegistry } from "../run-registry-context.js"
import { ServerEvidenceStream } from "../surface/evidence-stream.js"
import { processPipelineEvent } from "./evidence-event-recording.js"
import {
  enqueueAuthoredStep,
  type PipelineEvent,
  projectionEvidenceStreamFor,
  recordServerCompletion,
  type ServerEvidenceEvent
} from "./evidence-pipeline-stream.js"
import { ensureServerCompletion, ensureStepQueueDrain } from "./evidence-success-gate.js"
import type { RunSignal } from "./lifecycle.js"

export const runEvidencePipeline = ({
  registry,
  id,
  runtime,
  runtimeSnapshot,
  projectionDriver,
  projectionDriverSnapshot,
  onCue,
  onCanonicalFrameObserved,
  onEvent,
  onFrame,
  onStepQueueDrained,
  onSuccessGateSatisfied,
  onStreamCompleteObserved,
  runToken,
  signal
}: {
  readonly registry: RunRegistry
  readonly id: EntryId
  readonly runtime: SurfaceRuntime
  readonly runtimeSnapshot: SurfaceRuntimeSnapshot
  readonly projectionDriver: Option.Option<ProjectionDriverDescriptor>
  readonly projectionDriverSnapshot: ProjectionDriverSnapshot
  readonly onCue: (cue: ChoreographyCue, state: ChoreographyState) => Effect.Effect<void, never, never>
  readonly onCanonicalFrameObserved: (frame: CanonicalFrame) => Effect.Effect<void, never, never>
  readonly onEvent: (event: EvidenceEvent) => Effect.Effect<void, never, never>
  readonly onFrame: (frame: LocalRunFrame) => Effect.Effect<void, never, never>
  readonly onStepQueueDrained: () => Effect.Effect<void, never, never>
  readonly onSuccessGateSatisfied: (store: EvidenceStore) => Effect.Effect<void, never, never>
  readonly onStreamCompleteObserved: (completion: CompletionEvent) => Effect.Effect<void, never, never>
  readonly runToken: string
  readonly signal: RunSignal
}): Effect.Effect<EvidenceStore, EntryError, SurfaceRuntimeServices> =>
  Effect.gen(function*() {
    const completionRef = yield* Ref.make<Option.Option<CompletionEvent>>(Option.none())
    const serverCompleted = yield* Deferred.make<CompletionEvent>()
    const finalizationNotifiedRef = yield* Ref.make(false)
    const stepQueueDrainRef = yield* Ref.make(Option.match(projectionDriver, {
      onNone: () => true,
      onSome: () => false
    }))
    const storeRef = yield* Ref.make(EvidenceStore.empty())
    const choreographyRef = yield* Ref.make(initialChoreographyState)
    const stepQueue = yield* Queue.unbounded<AuthoredStepQueueEvent>()
    const serverEvidenceStream = ServerEvidenceStream.fromRuntime({
      id,
      runtime,
      runtimeSnapshot,
      runToken
    }).pipe(
      Stream.tap((event) => enqueueAuthoredStep(stepQueue, event)),
      Stream.tap((event) => recordServerCompletion(completionRef, serverCompleted, event)),
      Stream.map((event): ServerEvidenceEvent => ({
        _tag: "ServerEvidenceEvent",
        event
      }))
    )

    const handlePipelineEvent = (event: PipelineEvent): Effect.Effect<void, EntryExecutionError, never> =>
      processPipelineEvent({
        completionRef,
        event,
        finalizationNotifiedRef,
        stepQueueDrainRef,
        onCue,
        onCanonicalFrameObserved,
        onEvent,
        onFrame,
        onStepQueueDrained,
        onSuccessGateSatisfied,
        onStreamCompleteObserved,
        storeRef,
        choreographyRef
      })

    yield* Stream.merge(
      serverEvidenceStream,
      projectionEvidenceStreamFor(
        projectionDriver,
        registry,
        signal,
        projectionDriverSnapshot,
        stepQueue,
        serverCompleted
      ),
      { haltStrategy: "both" }
    ).pipe(Stream.runForEach(handlePipelineEvent))

    yield* ensureServerCompletion(completionRef)
    yield* ensureStepQueueDrain(stepQueueDrainRef)

    return yield* Ref.get(storeRef)
  })
