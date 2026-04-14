import { Effect, Option, Ref } from "effect"

import { EntryExecutionError } from "../../../contracts/entry-error.js"
import type { EvidenceStore } from "../../../contracts/evidence/store.js"

import type { CompletionEvent } from "../../runtime/kernel/surface-runtime.js"

const claimFinalizationNotification = (notified: boolean): readonly [boolean, boolean] =>
  notified ? [false, true] : [true, true]

const claimStepQueueDrain = (stepQueueDrained: boolean): readonly [boolean, boolean] =>
  stepQueueDrained ? [false, true] : [true, true]

export const pipelineExecutionFailedError = (message: string): EntryExecutionError =>
  new EntryExecutionError({
    code: "execution-failed",
    message,
    retryable: true
  })

export const ensureServerCompletion = (
  completionRef: Ref.Ref<Option.Option<CompletionEvent>>
): Effect.Effect<void, EntryExecutionError, never> =>
  Ref.get(completionRef).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.fail(pipelineExecutionFailedError("Evidence stream ended without completion metadata.")),
        onSome: () => Effect.void
      })
    )
  )

export const ensureStepQueueDrain = (
  stepQueueDrainRef: Ref.Ref<boolean>
): Effect.Effect<void, EntryExecutionError, never> =>
  Ref.get(stepQueueDrainRef).pipe(
    Effect.flatMap((stepQueueDrained) =>
      stepQueueDrained
        ? Effect.void
        : Effect.fail(
          pipelineExecutionFailedError("Local projection ended before the success gate observed a drained step queue.")
        )
    )
  )

export const finalizePipelineIfReady = ({
  completionRef,
  finalizationNotifiedRef,
  stepQueueDrainRef,
  onSuccessGateSatisfied,
  storeRef
}: {
  readonly completionRef: Ref.Ref<Option.Option<CompletionEvent>>
  readonly finalizationNotifiedRef: Ref.Ref<boolean>
  readonly stepQueueDrainRef: Ref.Ref<boolean>
  readonly onSuccessGateSatisfied: (store: EvidenceStore) => Effect.Effect<void, never, never>
  readonly storeRef: Ref.Ref<EvidenceStore>
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

export const recordStepQueueDrain = ({
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
  readonly onSuccessGateSatisfied: (store: EvidenceStore) => Effect.Effect<void, never, never>
  readonly storeRef: Ref.Ref<EvidenceStore>
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
