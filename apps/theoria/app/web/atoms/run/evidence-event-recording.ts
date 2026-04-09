import { Effect, Either, Match, type Option, Ref } from "effect"

import type { EntryExecutionError } from "../../../contracts/entry-error.js"
import type { EvidenceStore } from "../../../contracts/evidence/store.js"
import type { EvidenceEvent } from "../../../contracts/evidence/stream.js"
import type { CanonicalFrame } from "../../../contracts/study/workflow/canonical-step.js"
import type { ChoreographyCue, ChoreographyState } from "../../../contracts/study/workflow/choreography.js"
import { reduceChoreographyState } from "../../../contracts/study/workflow/choreography.js"
import type { LocalRunFrame } from "../../state/run/local.js"

import type { CompletionEvent } from "../../runtime/kernel/surface-runtime.js"

import type { PipelineEvent } from "./evidence-pipeline-stream.js"
import { finalizePipelineIfReady, pipelineExecutionFailedError, recordStepQueueDrain } from "./evidence-success-gate.js"

const choreographyViolationError = ({
  cueTag,
  message,
  stateTag
}: {
  readonly cueTag: string
  readonly message: string
  readonly stateTag: string
}): EntryExecutionError =>
  pipelineExecutionFailedError(
    `Recognized choreography cue ${cueTag} violated sequencing authority in ${stateTag}: ${message}`
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
  readonly storeRef: Ref.Ref<EvidenceStore>
}): Effect.Effect<void, EntryExecutionError, never> =>
  Ref.update(storeRef, (store) => store.apply(evidenceEvent)).pipe(
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
  readonly storeRef: Ref.Ref<EvidenceStore>
}): Effect.Effect<void, EntryExecutionError, never> =>
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
    Match.tag("ProjectionDriverCompleted", () => Effect.void),
    Match.exhaustive
  )

export const processPipelineEvent = ({
  choreographyRef,
  completionRef,
  event,
  finalizationNotifiedRef,
  onCue,
  onCanonicalFrameObserved,
  onEvent,
  onFrame,
  onStepQueueDrained,
  onSuccessGateSatisfied,
  onStreamCompleteObserved,
  stepQueueDrainRef,
  storeRef
}: {
  readonly choreographyRef: Ref.Ref<ChoreographyState>
  readonly completionRef: Ref.Ref<Option.Option<CompletionEvent>>
  readonly event: PipelineEvent
  readonly finalizationNotifiedRef: Ref.Ref<boolean>
  readonly onCue: (cue: ChoreographyCue, state: ChoreographyState) => Effect.Effect<void, never, never>
  readonly onCanonicalFrameObserved: (frame: CanonicalFrame) => Effect.Effect<void, never, never>
  readonly onEvent: (event: EvidenceEvent) => Effect.Effect<void, never, never>
  readonly onFrame: (frame: LocalRunFrame) => Effect.Effect<void, never, never>
  readonly onStepQueueDrained: () => Effect.Effect<void, never, never>
  readonly onSuccessGateSatisfied: (store: EvidenceStore) => Effect.Effect<void, never, never>
  readonly onStreamCompleteObserved: (completion: CompletionEvent) => Effect.Effect<void, never, never>
  readonly stepQueueDrainRef: Ref.Ref<boolean>
  readonly storeRef: Ref.Ref<EvidenceStore>
}): Effect.Effect<void, EntryExecutionError, never> =>
  Match.value(event).pipe(
    Match.tag("ProjectionDriverCompleted", () =>
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
