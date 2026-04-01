import type { Atom as AtomType } from "@effect-atom/atom"
import { Effect, Match, Option, Ref, Stream } from "effect"

import { type DemoError, DemoExecutionError } from "../../contracts/demo-error.js"
import type { EvidenceEvent } from "../../contracts/evidence-stream.js"
import type { Id } from "../../contracts/id.js"
import type { DemoClient } from "../services/DemoClient.js"
import { isEffectMathRunPlan, isEffectTextRunPlan, type LocalRunFrame, type LocalRunPlan } from "../state/local-run.js"
import {
  applyEvidenceEventToStore,
  emptyEvidenceStoreState,
  type EvidenceStoreState,
  type RunOwnership
} from "../state/types.js"

import { makeAnimationStream, resetAnimationState } from "./animation.js"
import { makeServerEvidenceStream } from "./evidence-stream.js"
import { makeOptimizationAnimationStream, resetOptimizationAnimationState } from "./optimization-animation.js"
import {
  makePowerAnimationStream,
  powerControlsAtom,
  resetPowerAnimationStateEffect,
  snapshotEffectMathRunPlan
} from "./power-animation.js"
import { customTextAtom, reflowStageViewportWidthAtom, snapshotEffectTextRunPlan } from "./reflow.js"
import type { RunSignal } from "./run-lifecycle.js"

type CompletionEvent = Extract<EvidenceEvent, { readonly _tag: "StreamComplete" }>
type LocalCompletionEvent = { readonly _tag: "LocalDriverCompleted" }
type LocalRunFrameUpdatedEvent = {
  readonly _tag: "LocalRunFrameUpdated"
  readonly frame: LocalRunFrame
}
type LocalDriverStreamEvent = EvidenceEvent | LocalRunFrameUpdatedEvent
type PipelineEvent = LocalDriverStreamEvent | LocalCompletionEvent

export type LocalDriverSnapshot = {
  readonly serverStreamInput: string | null
  readonly localRunPlan: LocalRunPlan | null
}

export type LocalDriverDescriptor = {
  readonly ownership: RunOwnership
  readonly snapshot: (ctx: AtomType.FnContext) => LocalDriverSnapshot
  readonly makeStream: (
    ctx: AtomType.FnContext,
    signal: RunSignal,
    snapshot: LocalDriverSnapshot
  ) => Stream.Stream<LocalDriverStreamEvent, never, never>
  readonly reset: (ctx: AtomType.FnContext) => Effect.Effect<void, never, never>
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
  snapshot: (ctx) => {
    const customText = ctx(customTextAtom)

    return {
      serverStreamInput: customText,
      localRunPlan: snapshotEffectTextRunPlan({
        customText,
        viewportWidthPx: ctx(reflowStageViewportWidthAtom)
      })
    }
  },
  makeStream: (ctx, signal, snapshot) =>
    isEffectTextRunPlan(snapshot.localRunPlan)
      ? makeAnimationStream(ctx, signal, snapshot.localRunPlan)
      : Stream.empty,
  reset: resetAnimationState
}

const effectSearchLocalDriver: LocalDriverDescriptor = {
  ownership: sharedStreamingOwnership,
  snapshot: () => ({ serverStreamInput: null, localRunPlan: null }),
  makeStream: (ctx, signal) => makeOptimizationAnimationStream(ctx, signal),
  reset: resetOptimizationAnimationState
}

const effectMathLocalDriver: LocalDriverDescriptor = {
  ownership: sharedStreamingOwnership,
  snapshot: (ctx) => ({
    serverStreamInput: null,
    localRunPlan: snapshotEffectMathRunPlan(ctx(powerControlsAtom))
  }),
  makeStream: (ctx, signal, snapshot) =>
    isEffectMathRunPlan(snapshot.localRunPlan)
      ? makePowerAnimationStream(ctx, signal, snapshot.localRunPlan)
      : Stream.empty,
  reset: resetPowerAnimationStateEffect
}

export const localDriverFor = (id: Id): Option.Option<LocalDriverDescriptor> =>
  Match.value(id).pipe(
    Match.when("effect-text", () => Option.some(effectTextLocalDriver)),
    Match.when("effect-search", () => Option.some(effectSearchLocalDriver)),
    Match.when("effect-math", () => Option.some(effectMathLocalDriver)),
    Match.orElse(() => Option.none())
  )

export const runOwnershipFor = (localDriver: Option.Option<LocalDriverDescriptor>): RunOwnership =>
  Option.match(localDriver, {
    onNone: () => serverOnlyOwnership,
    onSome: ({ ownership }) => ownership
  })

export const snapshotLocalDriver = (
  localDriver: Option.Option<LocalDriverDescriptor>,
  ctx: AtomType.FnContext
): LocalDriverSnapshot =>
  Option.match(localDriver, {
    onNone: () => ({ serverStreamInput: null, localRunPlan: null }),
    onSome: (driver) => driver.snapshot(ctx)
  })

export const resetLocalDriverState = (
  localDriver: Option.Option<LocalDriverDescriptor>,
  ctx: AtomType.FnContext
): Effect.Effect<void, never, never> =>
  Option.match(localDriver, {
    onNone: () => Effect.void,
    onSome: (driver) => driver.reset(ctx)
  })

const localDriverCompleted: LocalCompletionEvent = { _tag: "LocalDriverCompleted" }

const localEvidenceStreamFor = (
  localDriver: Option.Option<LocalDriverDescriptor>,
  ctx: AtomType.FnContext,
  signal: RunSignal,
  snapshot: LocalDriverSnapshot
): Stream.Stream<PipelineEvent, never, never> =>
  Option.match(localDriver, {
    onNone: () => Stream.empty,
    onSome: (driver) => Stream.concat(driver.makeStream(ctx, signal, snapshot), Stream.succeed(localDriverCompleted))
  })

const recordServerCompletion = (
  completionRef: Ref.Ref<Option.Option<CompletionEvent>>,
  onServerCompleted: (completion: CompletionEvent) => Effect.Effect<void, never, never>,
  event: PipelineEvent
): Effect.Effect<void, never, never> =>
  Match.value(event).pipe(
    Match.tag("StreamComplete", (completion) =>
      Ref.set(completionRef, Option.some(completion)).pipe(
        Effect.zipRight(onServerCompleted(completion))
      )),
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
  Effect.all([Ref.get(completionRef), Ref.get(finalizationNotifiedRef), Ref.get(localCompletionRef)]).pipe(
    Effect.flatMap(([completion, finalizationNotified, localCompletion]) =>
      Option.isSome(completion) && localCompletion && !finalizationNotified
        ? Ref.set(finalizationNotifiedRef, true).pipe(
          Effect.zipRight(Ref.get(storeRef)),
          Effect.flatMap(onReadyForFinalization)
        )
        : Effect.void
    )
  )

const recordPipelineEvent = (
  localCompletionRef: Ref.Ref<boolean>,
  onFrame: (frame: LocalRunFrame) => Effect.Effect<void, never, never>,
  onLocalCompleted: () => Effect.Effect<void, never, never>,
  storeRef: Ref.Ref<EvidenceStoreState>,
  onEvent: (event: EvidenceEvent) => Effect.Effect<void, never, never>,
  event: PipelineEvent
): Effect.Effect<void, never, never> =>
  Match.value(event).pipe(
    Match.tag("LocalRunFrameUpdated", ({ frame }) => onFrame(frame)),
    Match.tag(
      "LocalDriverCompleted",
      () => Ref.set(localCompletionRef, true).pipe(Effect.zipRight(onLocalCompleted()))
    ),
    Match.orElse((evidenceEvent) =>
      Ref.update(storeRef, (store) => applyEvidenceEventToStore(store, evidenceEvent)).pipe(
        Effect.zipRight(onEvent(evidenceEvent))
      )
    )
  )

export const runEvidencePipeline = ({
  ctx,
  id,
  localDriver,
  localDriverSnapshot,
  onEvent,
  onFrame,
  onLocalCompleted,
  onReadyForFinalization,
  onServerCompleted,
  signal
}: {
  readonly ctx: AtomType.FnContext
  readonly id: Id
  readonly localDriver: Option.Option<LocalDriverDescriptor>
  readonly localDriverSnapshot: LocalDriverSnapshot
  readonly onEvent: (event: EvidenceEvent) => Effect.Effect<void, never, never>
  readonly onFrame: (frame: LocalRunFrame) => Effect.Effect<void, never, never>
  readonly onLocalCompleted: () => Effect.Effect<void, never, never>
  readonly onReadyForFinalization: (store: EvidenceStoreState) => Effect.Effect<void, never, never>
  readonly onServerCompleted: (completion: CompletionEvent) => Effect.Effect<void, never, never>
  readonly signal: RunSignal
}): Effect.Effect<EvidenceStoreState, DemoError, DemoClient> =>
  Effect.gen(function*() {
    const completionRef = yield* Ref.make<Option.Option<CompletionEvent>>(Option.none())
    const finalizationNotifiedRef = yield* Ref.make(false)
    const localCompletionRef = yield* Ref.make(Option.match(localDriver, {
      onNone: () => true,
      onSome: () => false
    }))
    const storeRef = yield* Ref.make<EvidenceStoreState>(emptyEvidenceStoreState)
    const serverEvidenceStream = makeServerEvidenceStream(id, localDriverSnapshot.serverStreamInput).pipe(
      Stream.tap((event) => recordServerCompletion(completionRef, onServerCompleted, event))
    )

    yield* Stream.merge(
      serverEvidenceStream,
      localEvidenceStreamFor(localDriver, ctx, signal, localDriverSnapshot)
    ).pipe(
      Stream.runForEach((event) =>
        recordPipelineEvent(localCompletionRef, onFrame, onLocalCompleted, storeRef, onEvent, event).pipe(
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

    yield* ensureServerCompletion(completionRef)
    yield* ensureLocalCompletion(localCompletionRef)

    return yield* Ref.get(storeRef)
  })
