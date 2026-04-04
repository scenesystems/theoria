import { Deferred, Effect, Match, Option, Queue, Ref, Stream } from "effect"

import type { CanonicalStep } from "../../contracts/canonical-step.js"
import type { ChoreographyCue, ChoreographyState } from "../../contracts/choreography.js"
import { initialChoreographyState, reduceChoreographyState } from "../../contracts/choreography.js"
import { type DemoError, DemoExecutionError } from "../../contracts/demo-error.js"
import { optimizationTrialBudgetMax, optimizationTrialBudgetMin } from "../../contracts/demo/objective.js"
import { snapshotEffectTextRunPlan } from "../../contracts/demo/text.js"
import type { EvidenceEvent } from "../../contracts/evidence-stream.js"
import type { Id } from "../../contracts/id.js"
import {
  EffectDspManifest,
  EffectMathManifest,
  EffectSearchManifest,
  EffectTextManifest,
  type StreamManifest
} from "../../contracts/stream-manifest.js"
import type { DemoClient } from "../services/DemoClient.js"
import {
  isEffectMathRunPlan,
  isEffectSearchRunPlan,
  isEffectTextRunPlan,
  type LocalRunFrame,
  type LocalRunPlan
} from "../state/local-run.js"
import {
  applyEvidenceEventToStore,
  emptyEvidenceStoreState,
  type EvidenceStoreState,
  type RunOwnership
} from "../state/types.js"

import { makeAnimationStream, resetAnimationState } from "./animation.js"
import { makeDspRunStream } from "./dsp-local-driver.js"
import { snapshotEffectDspRunPlan } from "./dsp-run-plan.js"
import { dspModuleTypeIndexAtom, dspOptimizationBudgetAtom, dspScenarioIndexAtom } from "./dsp-widget.js"
import { makeServerEvidenceStream } from "./evidence-stream.js"
import { type LocalDriverCompletedEvent } from "./local-driver-events.js"
import {
  makeOptimizationAnimationStream,
  resetOptimizationAnimationState,
  snapshotEffectSearchRunPlan,
  trialBudgetAtom
} from "./optimization-animation.js"
import {
  makePowerAnimationStream,
  powerControlsAtom,
  resetPowerAnimationStateEffect,
  snapshotEffectMathRunPlan
} from "./power-animation.js"
import { customTextAtom, reflowStageViewportWidthAtom } from "./reflow.js"
import type { RunSignal } from "./run-lifecycle.js"
import type { RunRegistry } from "./run-registry-context.js"

type CompletionEvent = Extract<EvidenceEvent, { readonly _tag: "StreamComplete" }>
type AuthoredStepQueueEvent = CanonicalStep | CompletionEvent
type ServerEvidenceEvent = {
  readonly _tag: "ServerEvidenceEvent"
  readonly event: EvidenceEvent
}
type LocalDriverEvidenceEvent = {
  readonly _tag: "LocalDriverEvidenceEvent"
  readonly event: EvidenceEvent
}
type LocalRunFrameUpdatedEvent = {
  readonly _tag: "LocalRunFrameUpdated"
  readonly frame: LocalRunFrame
}
type RawLocalDriverStreamEvent = EvidenceEvent | LocalRunFrameUpdatedEvent | LocalDriverCompletedEvent
type LocalDriverStreamEvent = LocalDriverEvidenceEvent | LocalRunFrameUpdatedEvent | LocalDriverCompletedEvent
type PipelineEvent = ServerEvidenceEvent | LocalDriverStreamEvent

export type LocalDriverSnapshot = {
  readonly manifest: StreamManifest | null
  readonly localRunPlan: LocalRunPlan | null
}

export type LocalDriverDescriptor = {
  readonly ownership: RunOwnership
  readonly snapshot: (registry: RunRegistry) => LocalDriverSnapshot
  readonly makeStream: (
    registry: RunRegistry,
    signal: RunSignal,
    snapshot: LocalDriverSnapshot,
    stepQueue: Queue.Queue<AuthoredStepQueueEvent>,
    serverCompleted: Deferred.Deferred<CompletionEvent>
  ) => Stream.Stream<RawLocalDriverStreamEvent, DemoError, never>
  readonly reset: (registry: RunRegistry) => Effect.Effect<void, never, never>
}

const serverOnlyOwnership: RunOwnership = {
  localDriver: false,
  serverStream: true
}

const sharedStreamingOwnership: RunOwnership = {
  localDriver: true,
  serverStream: true
}

const effectTextLocalDriver: LocalDriverDescriptor = {
  ownership: sharedStreamingOwnership,
  snapshot: (registry) => {
    const customText = registry.get(customTextAtom)
    const viewportWidthPx = registry.get(reflowStageViewportWidthAtom)

    return {
      manifest: new EffectTextManifest({ customText, viewportWidthPx }),
      localRunPlan: snapshotEffectTextRunPlan({ customText, viewportWidthPx })
    }
  },
  makeStream: (registry, signal, snapshot, stepQueue, serverCompleted) =>
    isEffectTextRunPlan(snapshot.localRunPlan)
      ? makeAnimationStream(registry, signal, snapshot.localRunPlan, stepQueue, serverCompleted)
      : Stream.empty,
  reset: resetAnimationState
}

const effectSearchLocalDriver: LocalDriverDescriptor = {
  ownership: sharedStreamingOwnership,
  snapshot: (registry) => {
    const trialBudget = registry.get(trialBudgetAtom)
    const manifestTrialBudget = Math.max(
      optimizationTrialBudgetMin,
      Math.min(trialBudget, optimizationTrialBudgetMax)
    )

    return {
      manifest: new EffectSearchManifest({ trialBudget: manifestTrialBudget }),
      localRunPlan: snapshotEffectSearchRunPlan(trialBudget)
    }
  },
  makeStream: (registry, signal, snapshot, _cueQueue, _serverCompleted) =>
    isEffectSearchRunPlan(snapshot.localRunPlan)
      ? makeOptimizationAnimationStream(registry, signal, snapshot.localRunPlan)
      : Stream.empty,
  reset: resetOptimizationAnimationState
}

const effectMathLocalDriver: LocalDriverDescriptor = {
  ownership: sharedStreamingOwnership,
  snapshot: (registry) => {
    const controls = registry.get(powerControlsAtom)

    return {
      manifest: new EffectMathManifest({ alpha: controls.alpha, d: controls.d, n: controls.n }),
      localRunPlan: snapshotEffectMathRunPlan(controls)
    }
  },
  makeStream: (registry, signal, snapshot, _cueQueue, _serverCompleted) =>
    isEffectMathRunPlan(snapshot.localRunPlan)
      ? makePowerAnimationStream(registry, signal, snapshot.localRunPlan)
      : Stream.empty,
  reset: resetPowerAnimationStateEffect
}

const effectDspLocalDriver: LocalDriverDescriptor = {
  ownership: sharedStreamingOwnership,
  snapshot: (registry) => {
    const plan = snapshotEffectDspRunPlan({
      scenarioIndex: registry.get(dspScenarioIndexAtom),
      moduleTypeIndex: registry.get(dspModuleTypeIndexAtom),
      optimizationBudget: registry.get(dspOptimizationBudgetAtom)
    })

    return {
      manifest: new EffectDspManifest({
        scenarioId: plan.scenarioId,
        moduleType: plan.moduleType,
        optimizationBudget: plan.optimizationBudget
      }),
      localRunPlan: plan
    }
  },
  makeStream: (_ctx, signal, _snapshot, stepQueue, _serverCompleted) => makeDspRunStream(signal, stepQueue),
  reset: () => Effect.void
}

export const localDriverFor = (id: Id): Option.Option<LocalDriverDescriptor> =>
  Match.value(id).pipe(
    Match.when("effect-text", () => Option.some(effectTextLocalDriver)),
    Match.when("effect-search", () => Option.some(effectSearchLocalDriver)),
    Match.when("effect-math", () => Option.some(effectMathLocalDriver)),
    Match.when("effect-dsp", () => Option.some(effectDspLocalDriver)),
    Match.orElse(() => Option.none())
  )

export const runOwnershipFor = (localDriver: Option.Option<LocalDriverDescriptor>): RunOwnership =>
  Option.match(localDriver, {
    onNone: () => serverOnlyOwnership,
    onSome: ({ ownership }) => ownership
  })

export const snapshotLocalDriver = (
  localDriver: Option.Option<LocalDriverDescriptor>,
  registry: RunRegistry
): LocalDriverSnapshot =>
  Option.match(localDriver, {
    onNone: () => ({ manifest: null, localRunPlan: null }),
    onSome: (driver) => driver.snapshot(registry)
  })

export const resetLocalDriverState = (
  localDriver: Option.Option<LocalDriverDescriptor>,
  registry: RunRegistry
): Effect.Effect<void, never, never> =>
  Option.match(localDriver, {
    onNone: () => Effect.void,
    onSome: (driver) => driver.reset(registry)
  })

const localEvidenceStreamFor = (
  localDriver: Option.Option<LocalDriverDescriptor>,
  registry: RunRegistry,
  signal: RunSignal,
  snapshot: LocalDriverSnapshot,
  stepQueue: Queue.Queue<AuthoredStepQueueEvent>,
  serverCompleted: Deferred.Deferred<CompletionEvent>,
  onLocalCompleted: Effect.Effect<void, never, never>
): Stream.Stream<PipelineEvent, DemoError, never> =>
  Option.match(localDriver, {
    onNone: () => Stream.empty,
    onSome: (driver) =>
      driver.makeStream(registry, signal, snapshot, stepQueue, serverCompleted).pipe(
        Stream.map((event): LocalDriverStreamEvent =>
          isLocalDriverLifecycleEvent(event)
            ? event
            : localDriverEvidenceEvent(event)
        ),
        Stream.onDone(() => onLocalCompleted)
      )
  })

const deferServerEvidenceVisibility = (
  id: Id,
  localDriver: Option.Option<LocalDriverDescriptor>
): boolean => id === "effect-text" && Option.isSome(localDriver)

const shouldExposeServerEvidence = (
  deferVisibility: boolean,
  localCompletion: boolean
): boolean => !deferVisibility || localCompletion

const localDriverEvidenceEvent = (event: EvidenceEvent): LocalDriverEvidenceEvent => ({
  _tag: "LocalDriverEvidenceEvent",
  event
})

const isLocalDriverLifecycleEvent = (
  event: RawLocalDriverStreamEvent
): event is LocalRunFrameUpdatedEvent | LocalDriverCompletedEvent =>
  Match.value(event).pipe(
    Match.tag("LocalRunFrameUpdated", () => true),
    Match.tag("LocalDriverCompleted", () => true),
    Match.orElse(() => false)
  )

const recordServerCompletion = (
  completionRef: Ref.Ref<Option.Option<CompletionEvent>>,
  serverCompleted: Deferred.Deferred<CompletionEvent>,
  storeRef: Ref.Ref<EvidenceStoreState>,
  event: EvidenceEvent
): Effect.Effect<void, never, never> =>
  Match.value(event).pipe(
    Match.tag("StreamComplete", (completion) =>
      Ref.update(storeRef, (store) =>
        applyEvidenceEventToStore(store, completion)).pipe(
          Effect.zipRight(Ref.set(completionRef, Option.some(completion))),
          Effect.zipRight(Deferred.succeed(serverCompleted, completion))
        )),
    Match.orElse(() =>
      Effect.void
    )
  )

const enqueueAuthoredStep = (
  stepQueue: Queue.Queue<AuthoredStepQueueEvent>,
  event: EvidenceEvent
): Effect.Effect<void, never, never> =>
  Match.value(event).pipe(
    Match.tag("Step", ({ step }) => Queue.offer(stepQueue, step).pipe(Effect.asVoid)),
    Match.tag("StreamComplete", (completion) => Queue.offer(stepQueue, completion).pipe(Effect.asVoid)),
    Match.orElse(() => Effect.void)
  )

const executionFailedError = (message: string): DemoExecutionError =>
  new DemoExecutionError({
    code: "execution-failed",
    message,
    retryable: true
  })

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

const ensureLocalCompletion = (
  localCompletionRef: Ref.Ref<boolean>
): Effect.Effect<void, DemoExecutionError, never> =>
  Ref.get(localCompletionRef).pipe(
    Effect.flatMap((localCompletion) =>
      localCompletion
        ? Effect.void
        : Effect.fail(executionFailedError("Local driver ended without emitting completion metadata."))
    )
  )

const claimFinalizationNotification = (notified: boolean): readonly [boolean, boolean] =>
  notified ? [false, true] : [true, true]

const claimLocalCompletion = (localCompletion: boolean): readonly [boolean, boolean] =>
  localCompletion ? [false, true] : [true, true]

const finalizePipelineIfReady = ({
  completionRef,
  finalizationNotifiedRef,
  localCompletionRef,
  onReadyForFinalization,
  storeRef
}: {
  readonly completionRef: Ref.Ref<Option.Option<CompletionEvent>>
  readonly finalizationNotifiedRef: Ref.Ref<boolean>
  readonly localCompletionRef: Ref.Ref<boolean>
  readonly onReadyForFinalization: (store: EvidenceStoreState) => Effect.Effect<void, never, never>
  readonly storeRef: Ref.Ref<EvidenceStoreState>
}): Effect.Effect<void, never, never> =>
  Effect.all([Ref.get(completionRef), Ref.get(localCompletionRef)]).pipe(
    Effect.flatMap(([completion, localCompletion]) =>
      Option.isSome(completion) && localCompletion
        ? Ref.modify(finalizationNotifiedRef, claimFinalizationNotification).pipe(
          Effect.flatMap((shouldNotify) =>
            shouldNotify
              ? Ref.get(storeRef).pipe(Effect.flatMap(onReadyForFinalization))
              : Effect.void
          )
        )
        : Effect.void
    )
  )

const recordLocalCompletion = ({
  completionRef,
  deferVisibility,
  finalizationNotifiedRef,
  localCompletionRef,
  onLocalCompleted,
  onReadyForFinalization,
  onServerCompleted,
  storeRef
}: {
  readonly completionRef: Ref.Ref<Option.Option<CompletionEvent>>
  readonly deferVisibility: boolean
  readonly finalizationNotifiedRef: Ref.Ref<boolean>
  readonly localCompletionRef: Ref.Ref<boolean>
  readonly onLocalCompleted: () => Effect.Effect<void, never, never>
  readonly onReadyForFinalization: (store: EvidenceStoreState) => Effect.Effect<void, never, never>
  readonly onServerCompleted: (completion: CompletionEvent) => Effect.Effect<void, never, never>
  readonly storeRef: Ref.Ref<EvidenceStoreState>
}): Effect.Effect<void, never, never> =>
  Ref.modify(localCompletionRef, claimLocalCompletion).pipe(
    Effect.flatMap((shouldRecordCompletion) =>
      shouldRecordCompletion
        ? onLocalCompleted().pipe(
          Effect.zipRight(
            deferVisibility
              ? Ref.get(completionRef).pipe(
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.void,
                    onSome: onServerCompleted
                  })
                )
              )
              : Effect.void
          ),
          Effect.zipRight(
            finalizePipelineIfReady({
              completionRef,
              finalizationNotifiedRef,
              localCompletionRef,
              onReadyForFinalization,
              storeRef
            })
          )
        )
        : Effect.void
    )
  )

const recordEvidenceEvent = ({
  choreographyRef,
  deferVisibility,
  evidenceEvent,
  localCompletionRef,
  onCue,
  onEvent,
  onServerCompleted,
  source,
  storeRef
}: {
  readonly choreographyRef: Ref.Ref<ChoreographyState>
  readonly deferVisibility: boolean
  readonly evidenceEvent: EvidenceEvent
  readonly localCompletionRef: Ref.Ref<boolean>
  readonly onCue: (cue: ChoreographyCue) => Effect.Effect<void, never, never>
  readonly onEvent: (event: EvidenceEvent) => Effect.Effect<void, never, never>
  readonly onServerCompleted: (completion: CompletionEvent) => Effect.Effect<void, never, never>
  readonly source: "local" | "server"
  readonly storeRef: Ref.Ref<EvidenceStoreState>
}): Effect.Effect<void, never, never> =>
  Ref.update(storeRef, (store) => applyEvidenceEventToStore(store, evidenceEvent)).pipe(
    Effect.zipRight(
      Match.value(evidenceEvent).pipe(
        Match.tag(
          "Choreography",
          ({ cue }) =>
            Ref.update(choreographyRef, (state) => reduceChoreographyState(state, cue)).pipe(
              Effect.zipRight(onCue(cue))
            )
        ),
        Match.tag("Step", () => Effect.void),
        Match.tag("StreamComplete", (completion) =>
          source === "server"
            ? Ref.get(localCompletionRef).pipe(
              Effect.flatMap((localCompletion) =>
                shouldExposeServerEvidence(deferVisibility, localCompletion)
                  ? onEvent(completion).pipe(Effect.zipRight(onServerCompleted(completion)))
                  : Effect.void
              )
            )
            : onEvent(completion)),
        Match.orElse((nextEvidenceEvent) =>
          source === "server"
            ? Ref.get(localCompletionRef).pipe(
              Effect.flatMap((localCompletion) =>
                shouldExposeServerEvidence(deferVisibility, localCompletion)
                  ? onEvent(nextEvidenceEvent)
                  : Effect.void
              )
            )
            : onEvent(nextEvidenceEvent)
        )
      )
    )
  )

const recordPipelineEvent = ({
  choreographyRef,
  deferVisibility,
  event,
  localCompletionRef,
  onCue,
  onEvent,
  onFrame,
  onServerCompleted,
  storeRef
}: {
  readonly choreographyRef: Ref.Ref<ChoreographyState>
  readonly deferVisibility: boolean
  readonly event: PipelineEvent
  readonly localCompletionRef: Ref.Ref<boolean>
  readonly onCue: (cue: ChoreographyCue) => Effect.Effect<void, never, never>
  readonly onEvent: (event: EvidenceEvent) => Effect.Effect<void, never, never>
  readonly onFrame: (frame: LocalRunFrame) => Effect.Effect<void, never, never>
  readonly onServerCompleted: (completion: CompletionEvent) => Effect.Effect<void, never, never>
  readonly storeRef: Ref.Ref<EvidenceStoreState>
}): Effect.Effect<void, never, never> =>
  Match.value(event).pipe(
    Match.tag("ServerEvidenceEvent", ({ event: evidenceEvent }) =>
      recordEvidenceEvent({
        choreographyRef,
        deferVisibility,
        evidenceEvent,
        localCompletionRef,
        onCue,
        onEvent,
        onServerCompleted,
        source: "server",
        storeRef
      })),
    Match.tag("LocalDriverEvidenceEvent", ({ event: evidenceEvent }) =>
      recordEvidenceEvent({
        choreographyRef,
        deferVisibility,
        evidenceEvent,
        localCompletionRef,
        onCue,
        onEvent,
        onServerCompleted,
        source: "local",
        storeRef
      })),
    Match.tag("LocalRunFrameUpdated", ({ frame }) => onFrame(frame)),
    Match.tag("LocalDriverCompleted", () => Effect.void),
    Match.exhaustive
  )

const processPipelineEvent = ({
  completionRef,
  deferVisibility,
  event,
  finalizationNotifiedRef,
  localCompletionRef,
  onCue,
  onEvent,
  onFrame,
  onLocalCompleted,
  onReadyForFinalization,
  onServerCompleted,
  storeRef,
  choreographyRef
}: {
  readonly completionRef: Ref.Ref<Option.Option<CompletionEvent>>
  readonly deferVisibility: boolean
  readonly event: PipelineEvent
  readonly finalizationNotifiedRef: Ref.Ref<boolean>
  readonly localCompletionRef: Ref.Ref<boolean>
  readonly onCue: (cue: ChoreographyCue) => Effect.Effect<void, never, never>
  readonly onEvent: (event: EvidenceEvent) => Effect.Effect<void, never, never>
  readonly onFrame: (frame: LocalRunFrame) => Effect.Effect<void, never, never>
  readonly onLocalCompleted: () => Effect.Effect<void, never, never>
  readonly onReadyForFinalization: (store: EvidenceStoreState) => Effect.Effect<void, never, never>
  readonly onServerCompleted: (completion: CompletionEvent) => Effect.Effect<void, never, never>
  readonly storeRef: Ref.Ref<EvidenceStoreState>
  readonly choreographyRef: Ref.Ref<ChoreographyState>
}): Effect.Effect<void, never, never> =>
  Match.value(event).pipe(
    Match.tag("LocalDriverCompleted", () =>
      recordLocalCompletion({
        completionRef,
        deferVisibility,
        finalizationNotifiedRef,
        localCompletionRef,
        onLocalCompleted,
        onReadyForFinalization,
        onServerCompleted,
        storeRef
      })),
    Match.orElse(() =>
      recordPipelineEvent({
        choreographyRef,
        deferVisibility,
        event,
        localCompletionRef,
        onCue,
        onEvent,
        onFrame,
        onServerCompleted,
        storeRef
      }).pipe(
        Effect.zipRight(
          finalizePipelineIfReady({
            completionRef,
            finalizationNotifiedRef,
            localCompletionRef,
            onReadyForFinalization,
            storeRef
          })
        )
      )
    )
  )

export const runEvidencePipeline = ({
  registry,
  id,
  localDriver,
  localDriverSnapshot,
  onCue,
  onEvent,
  onFrame,
  onLocalCompleted,
  onReadyForFinalization,
  onServerCompleted,
  signal
}: {
  readonly registry: RunRegistry
  readonly id: Id
  readonly localDriver: Option.Option<LocalDriverDescriptor>
  readonly localDriverSnapshot: LocalDriverSnapshot
  readonly onCue: (cue: ChoreographyCue) => Effect.Effect<void, never, never>
  readonly onEvent: (event: EvidenceEvent) => Effect.Effect<void, never, never>
  readonly onFrame: (frame: LocalRunFrame) => Effect.Effect<void, never, never>
  readonly onLocalCompleted: () => Effect.Effect<void, never, never>
  readonly onReadyForFinalization: (store: EvidenceStoreState) => Effect.Effect<void, never, never>
  readonly onServerCompleted: (completion: CompletionEvent) => Effect.Effect<void, never, never>
  readonly signal: RunSignal
}): Effect.Effect<EvidenceStoreState, DemoError, DemoClient> =>
  Effect.gen(function*() {
    const deferVisibility = deferServerEvidenceVisibility(id, localDriver)
    const completionRef = yield* Ref.make<Option.Option<CompletionEvent>>(Option.none())
    const serverCompleted = yield* Deferred.make<CompletionEvent>()
    const finalizationNotifiedRef = yield* Ref.make(false)
    const localCompletionRef = yield* Ref.make(Option.match(localDriver, {
      onNone: () => true,
      onSome: () => false
    }))
    const storeRef = yield* Ref.make<EvidenceStoreState>(emptyEvidenceStoreState)
    const choreographyRef = yield* Ref.make(initialChoreographyState)
    const stepQueue = yield* Queue.unbounded<AuthoredStepQueueEvent>()
    const serverEvidenceStream = makeServerEvidenceStream(id, localDriverSnapshot.manifest).pipe(
      Stream.tap((event) => enqueueAuthoredStep(stepQueue, event)),
      Stream.tap((event) => recordServerCompletion(completionRef, serverCompleted, storeRef, event)),
      Stream.map((event): ServerEvidenceEvent => ({
        _tag: "ServerEvidenceEvent",
        event
      }))
    )

    const handlePipelineEvent = (event: PipelineEvent): Effect.Effect<void, never, never> =>
      processPipelineEvent({
        completionRef,
        deferVisibility,
        event,
        finalizationNotifiedRef,
        localCompletionRef,
        onCue,
        onEvent,
        onFrame,
        onLocalCompleted,
        onReadyForFinalization,
        onServerCompleted,
        storeRef,
        choreographyRef
      })

    const localCompletionEffect = recordLocalCompletion({
      completionRef,
      deferVisibility,
      finalizationNotifiedRef,
      localCompletionRef,
      onLocalCompleted,
      onReadyForFinalization,
      onServerCompleted,
      storeRef
    })

    yield* Stream.merge(
      serverEvidenceStream,
      localEvidenceStreamFor(
        localDriver,
        registry,
        signal,
        localDriverSnapshot,
        stepQueue,
        serverCompleted,
        localCompletionEffect
      ),
      { haltStrategy: "both" }
    ).pipe(Stream.runForEach(handlePipelineEvent))

    yield* ensureServerCompletion(completionRef)
    yield* ensureLocalCompletion(localCompletionRef)

    return yield* Ref.get(storeRef)
  })
