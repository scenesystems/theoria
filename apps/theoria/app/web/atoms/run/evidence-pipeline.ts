import { Deferred, Effect, Either, Match, Option, Queue, Ref, Stream } from "effect"

import { type DemoError, DemoExecutionError } from "../../../contracts/demo-error.js"
import type { EntryId } from "../../../contracts/entry/id.js"
import {
  applyEvidenceEventToStore,
  emptyEvidenceStoreState,
  type EvidenceStoreState
} from "../../../contracts/evidence/store.js"
import type { EvidenceEvent } from "../../../contracts/evidence/stream.js"
import type { CanonicalFrame } from "../../../contracts/study/workflow/canonical-step.js"
import type { ChoreographyCue, ChoreographyState } from "../../../contracts/study/workflow/choreography.js"
import { initialChoreographyState, reduceChoreographyState } from "../../../contracts/study/workflow/choreography.js"
import type { LocalRunFrame } from "../../state/run/local.js"

import {
  type AuthoredStepQueueEvent,
  type CompletionEvent,
  type ProjectionDriverDescriptor,
  type ProjectionDriverEvent,
  type ProjectionDriverSnapshot,
  type SurfaceRuntime,
  type SurfaceRuntimeServices,
  type SurfaceRuntimeSnapshot
} from "../../runtime/kernel/surface-runtime.js"
import type { RunRegistry } from "../run-registry-context.js"
import { makeServerEvidenceStream } from "../surface/evidence-stream.js"
import type { RunSignal } from "./lifecycle.js"

type ServerEvidenceEvent = {
  readonly _tag: "ServerEvidenceEvent"
  readonly event: EvidenceEvent
}
type PipelineEvent = ServerEvidenceEvent | ProjectionDriverEvent

const projectionEvidenceStreamFor = (
  projectionDriver: Option.Option<ProjectionDriverDescriptor>,
  registry: RunRegistry,
  signal: RunSignal,
  snapshot: ProjectionDriverSnapshot,
  stepQueue: Queue.Queue<AuthoredStepQueueEvent>,
  serverCompleted: Deferred.Deferred<CompletionEvent>
): Stream.Stream<PipelineEvent, DemoError, never> =>
  Option.match(projectionDriver, {
    onNone: () => Stream.empty,
    onSome: (driver) =>
      driver.makeStream(registry, signal, snapshot, stepQueue, serverCompleted).pipe(
        Stream.map((event): PipelineEvent => event)
      )
  })

const recordServerCompletion = (
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

const enqueueAuthoredStep = (
  stepQueue: Queue.Queue<AuthoredStepQueueEvent>,
  event: EvidenceEvent
): Effect.Effect<void, never, never> =>
  Match.value(event).pipe(
    Match.tag("Step", ({ frame }) => Queue.offer(stepQueue, frame).pipe(Effect.asVoid)),
    Match.tag("StreamComplete", (completion) => Queue.offer(stepQueue, completion).pipe(Effect.asVoid)),
    Match.orElse(() => Effect.void)
  )

const executionFailedError = (message: string): DemoExecutionError =>
  new DemoExecutionError({
    code: "execution-failed",
    message,
    retryable: true
  })

const choreographyViolationError = ({
  cueTag,
  message,
  stateTag
}: {
  readonly cueTag: string
  readonly message: string
  readonly stateTag: string
}): DemoExecutionError =>
  executionFailedError(`Recognized choreography cue ${cueTag} violated sequencing authority in ${stateTag}: ${message}`)

const ensureServerCompletion = (
  completionRef: Ref.Ref<Option.Option<CompletionEvent>>
): Effect.Effect<void, DemoExecutionError, never> =>
  Ref.get(completionRef).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.fail(executionFailedError("Evidence stream ended without completion metadata.")),
        onSome: () => Effect.void
      })
    )
  )

const ensureStepQueueDrain = (
  stepQueueDrainRef: Ref.Ref<boolean>
): Effect.Effect<void, DemoExecutionError, never> =>
  Ref.get(stepQueueDrainRef).pipe(
    Effect.flatMap((stepQueueDrained) =>
      stepQueueDrained
        ? Effect.void
        : Effect.fail(
          executionFailedError("Local projection ended before the success gate observed a drained step queue.")
        )
    )
  )

const claimFinalizationNotification = (notified: boolean): readonly [boolean, boolean] =>
  notified ? [false, true] : [true, true]

const claimStepQueueDrain = (stepQueueDrained: boolean): readonly [boolean, boolean] =>
  stepQueueDrained ? [false, true] : [true, true]

const finalizePipelineIfReady = ({
  completionRef,
  finalizationNotifiedRef,
  stepQueueDrainRef,
  onSuccessGateSatisfied,
  storeRef
}: {
  readonly completionRef: Ref.Ref<Option.Option<CompletionEvent>>
  readonly finalizationNotifiedRef: Ref.Ref<boolean>
  readonly stepQueueDrainRef: Ref.Ref<boolean>
  readonly onSuccessGateSatisfied: (store: EvidenceStoreState) => Effect.Effect<void, never, never>
  readonly storeRef: Ref.Ref<EvidenceStoreState>
}): Effect.Effect<void, never, never> =>
  Effect.all([Ref.get(completionRef), Ref.get(stepQueueDrainRef)]).pipe(
    Effect.flatMap(([completion, stepQueueDrained]) =>
      Option.isSome(completion) && stepQueueDrained
        ? Ref.modify(finalizationNotifiedRef, claimFinalizationNotification).pipe(
          Effect.flatMap((shouldNotify) =>
            shouldNotify
              ? Ref.get(storeRef).pipe(Effect.flatMap(onSuccessGateSatisfied))
              : Effect.void
          )
        )
        : Effect.void
    )
  )

// Projection reactors report their authored-step drain through the same
// reducer-private fact, but run success still waits for StreamComplete from the
// shared server ledger before sealing RunData.
const recordStepQueueDrain = ({
  completionRef,
  finalizationNotifiedRef,
  stepQueueDrainRef,
  onStepQueueDrained,
  onSuccessGateSatisfied,
  storeRef
}: {
  readonly completionRef: Ref.Ref<Option.Option<CompletionEvent>>
  readonly finalizationNotifiedRef: Ref.Ref<boolean>
  readonly stepQueueDrainRef: Ref.Ref<boolean>
  readonly onStepQueueDrained: () => Effect.Effect<void, never, never>
  readonly onSuccessGateSatisfied: (store: EvidenceStoreState) => Effect.Effect<void, never, never>
  readonly storeRef: Ref.Ref<EvidenceStoreState>
}): Effect.Effect<void, never, never> =>
  Ref.modify(stepQueueDrainRef, claimStepQueueDrain).pipe(
    Effect.flatMap((shouldRecordCompletion) =>
      shouldRecordCompletion
        ? onStepQueueDrained().pipe(
          Effect.zipRight(
            finalizePipelineIfReady({
              completionRef,
              finalizationNotifiedRef,
              stepQueueDrainRef,
              onSuccessGateSatisfied,
              storeRef
            })
          )
        )
        : Effect.void
    )
  )

const recordEvidenceEvent = ({
  choreographyRef,
  evidenceEvent,
  onCue,
  onCanonicalFrameObserved,
  onEvent,
  onStreamCompleteObserved,
  storeRef
}: {
  readonly choreographyRef: Ref.Ref<ChoreographyState>
  readonly evidenceEvent: EvidenceEvent
  readonly onCue: (cue: ChoreographyCue, state: ChoreographyState) => Effect.Effect<void, never, never>
  readonly onCanonicalFrameObserved: (frame: CanonicalFrame) => Effect.Effect<void, never, never>
  readonly onEvent: (event: EvidenceEvent) => Effect.Effect<void, never, never>
  readonly onStreamCompleteObserved: (completion: CompletionEvent) => Effect.Effect<void, never, never>
  readonly storeRef: Ref.Ref<EvidenceStoreState>
}): Effect.Effect<void, DemoExecutionError, never> =>
  Ref.update(storeRef, (store) => applyEvidenceEventToStore(store, evidenceEvent)).pipe(
    Effect.zipRight(
      Match.value(evidenceEvent).pipe(
        Match.tag(
          "Choreography",
          ({ cue }) =>
            Ref.get(choreographyRef).pipe(
              Effect.flatMap((state) =>
                reduceChoreographyState(state, cue).pipe(
                  Either.match({
                    onLeft: (violation) => Effect.fail(choreographyViolationError(violation)),
                    onRight: (nextState) =>
                      Ref.set(choreographyRef, nextState).pipe(
                        Effect.zipRight(onCue(cue, nextState))
                      )
                  })
                )
              )
            )
        ),
        Match.tag("Step", ({ frame }) => onCanonicalFrameObserved(frame)),
        Match.tag(
          "StreamComplete",
          (completion) => onEvent(completion).pipe(Effect.zipRight(onStreamCompleteObserved(completion)))
        ),
        Match.orElse(onEvent)
      )
    )
  )

const recordPipelineEvent = ({
  choreographyRef,
  event,
  onCue,
  onCanonicalFrameObserved,
  onEvent,
  onFrame,
  onStreamCompleteObserved,
  storeRef
}: {
  readonly choreographyRef: Ref.Ref<ChoreographyState>
  readonly event: PipelineEvent
  readonly onCue: (cue: ChoreographyCue, state: ChoreographyState) => Effect.Effect<void, never, never>
  readonly onCanonicalFrameObserved: (frame: CanonicalFrame) => Effect.Effect<void, never, never>
  readonly onEvent: (event: EvidenceEvent) => Effect.Effect<void, never, never>
  readonly onFrame: (frame: LocalRunFrame) => Effect.Effect<void, never, never>
  readonly onStreamCompleteObserved: (completion: CompletionEvent) => Effect.Effect<void, never, never>
  readonly storeRef: Ref.Ref<EvidenceStoreState>
}): Effect.Effect<void, DemoExecutionError, never> =>
  Match.value(event).pipe(
    Match.tag("ServerEvidenceEvent", ({ event: evidenceEvent }) =>
      recordEvidenceEvent({
        choreographyRef,
        evidenceEvent,
        onCue,
        onCanonicalFrameObserved,
        onEvent,
        onStreamCompleteObserved,
        storeRef
      })),
    Match.tag("LocalRunFrameUpdated", ({ frame }) => onFrame(frame)),
    Match.tag("LocalDriverCompleted", () => Effect.void),
    Match.exhaustive
  )

const processPipelineEvent = ({
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
}: {
  readonly completionRef: Ref.Ref<Option.Option<CompletionEvent>>
  readonly event: PipelineEvent
  readonly finalizationNotifiedRef: Ref.Ref<boolean>
  readonly stepQueueDrainRef: Ref.Ref<boolean>
  readonly onCue: (cue: ChoreographyCue, state: ChoreographyState) => Effect.Effect<void, never, never>
  readonly onCanonicalFrameObserved: (frame: CanonicalFrame) => Effect.Effect<void, never, never>
  readonly onEvent: (event: EvidenceEvent) => Effect.Effect<void, never, never>
  readonly onFrame: (frame: LocalRunFrame) => Effect.Effect<void, never, never>
  readonly onStepQueueDrained: () => Effect.Effect<void, never, never>
  readonly onSuccessGateSatisfied: (store: EvidenceStoreState) => Effect.Effect<void, never, never>
  readonly onStreamCompleteObserved: (completion: CompletionEvent) => Effect.Effect<void, never, never>
  readonly storeRef: Ref.Ref<EvidenceStoreState>
  readonly choreographyRef: Ref.Ref<ChoreographyState>
}): Effect.Effect<void, DemoExecutionError, never> =>
  Match.value(event).pipe(
    Match.tag("LocalDriverCompleted", () =>
      recordStepQueueDrain({
        completionRef,
        finalizationNotifiedRef,
        stepQueueDrainRef,
        onStepQueueDrained,
        onSuccessGateSatisfied,
        storeRef
      })),
    Match.orElse(() =>
      recordPipelineEvent({
        choreographyRef,
        event,
        onCue,
        onCanonicalFrameObserved,
        onEvent,
        onFrame,
        onStreamCompleteObserved,
        storeRef
      }).pipe(
        Effect.zipRight(
          finalizePipelineIfReady({
            completionRef,
            finalizationNotifiedRef,
            stepQueueDrainRef,
            onSuccessGateSatisfied,
            storeRef
          })
        )
      )
    )
  )

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
  readonly onSuccessGateSatisfied: (store: EvidenceStoreState) => Effect.Effect<void, never, never>
  readonly onStreamCompleteObserved: (completion: CompletionEvent) => Effect.Effect<void, never, never>
  readonly runToken: string
  readonly signal: RunSignal
}): Effect.Effect<EvidenceStoreState, DemoError, SurfaceRuntimeServices> =>
  Effect.gen(function*() {
    const completionRef = yield* Ref.make<Option.Option<CompletionEvent>>(Option.none())
    const serverCompleted = yield* Deferred.make<CompletionEvent>()
    const finalizationNotifiedRef = yield* Ref.make(false)
    const stepQueueDrainRef = yield* Ref.make(Option.match(projectionDriver, {
      onNone: () => true,
      onSome: () => false
    }))
    const storeRef = yield* Ref.make<EvidenceStoreState>(emptyEvidenceStoreState)
    const choreographyRef = yield* Ref.make(initialChoreographyState)
    const stepQueue = yield* Queue.unbounded<AuthoredStepQueueEvent>()
    const serverEvidenceStream = makeServerEvidenceStream({
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

    const handlePipelineEvent = (event: PipelineEvent): Effect.Effect<void, DemoExecutionError, never> =>
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
