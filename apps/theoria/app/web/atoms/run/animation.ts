import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import type { Stream } from "effect"
import { Data, Effect, Queue } from "effect"
import { Study } from "effect-search"
import { effectTextSurfaceControlsForCustomText } from "../../../contracts/capability/effect-text-surface.js"
import type { EffectTextProjectionStep } from "../../../contracts/capability/effect-text.js"
import type { EffectTextTraversalScript } from "../../../contracts/capability/effect-text.js"
import { EntryExecutionError } from "../../../contracts/entry-error.js"
import type { EvidenceEvent } from "../../../contracts/evidence/stream.js"
import type { AuthoredStepQueueEvent as ProjectionAuthoredStepQueueEvent } from "../../runtime/kernel/surface-runtime.js"
import {
  customTextAtom,
  type EffectTextRunFrame,
  prepareReflowEntry,
  projectReflowProjection,
  reflowControlsAtom,
  resolveReflowCorpusEntry
} from "../reflow.js"
import type { RunRegistry } from "../run-registry-context.js"
import type { RunSignal } from "./lifecycle.js"
import { type ProjectionDriverCompletedEvent, projectionDriverCompletedEvent } from "./projection-driver-events.js"
export const animatingAtom: AtomType.Writable<boolean> = Atom.make(false)
type StreamCompletionEvent = Extract<EvidenceEvent, { readonly _tag: "StreamComplete" }>
type EffectTextAnimationEvent =
  | { readonly _tag: "LocalRunFrameUpdated"; readonly frame: EffectTextRunFrame }
  | ProjectionDriverCompletedEvent
type PlannedEffectTextFrame = {
  readonly corpusIndex: number
  readonly plannedStep: EffectTextTraversalScript["entries"][number]["steps"][number]
  readonly frame: EffectTextRunFrame
}
const executionFailedError = (message: string): EntryExecutionError =>
  EntryExecutionError.make({
    code: "execution-failed",
    message,
    retryable: true
  })
const isStreamCompletionEvent = (
  event: ProjectionAuthoredStepQueueEvent
): event is StreamCompletionEvent => "_tag" in event && event._tag === "StreamComplete"
const setFrameControls = (
  registry: RunRegistry,
  frame: EffectTextRunFrame
): void => {
  registry.set(reflowControlsAtom, frame.controls)
}
const takeAuthoredStepQueueEvent = ({
  signal,
  stepQueue
}: {
  readonly signal: RunSignal
  readonly stepQueue: Queue.Queue<ProjectionAuthoredStepQueueEvent>
}): Effect.Effect<ProjectionAuthoredStepQueueEvent, never, never> =>
  Effect.raceFirst(
    Queue.take(stepQueue),
    signal.awaitNextChange().pipe(
      Effect.zipRight(signal.awaitRunning()),
      Effect.flatMap(() => takeAuthoredStepQueueEvent({ signal, stepQueue }))
    )
  )
const takeEffectTextProjectionStep = ({
  signal,
  stepQueue
}: {
  readonly signal: RunSignal
  readonly stepQueue: Queue.Queue<ProjectionAuthoredStepQueueEvent>
}): Effect.Effect<EffectTextProjectionStep, EntryExecutionError, never> =>
  takeAuthoredStepQueueEvent({ signal, stepQueue }).pipe(
    Effect.flatMap((nextEvent) =>
      isStreamCompletionEvent(nextEvent)
        ? Effect.fail(
          executionFailedError("effect-text run ended before all authored projection steps arrived.")
        )
        : nextEvent.step._tag === "EffectTextProjectionStep"
        ? Effect.succeed(nextEvent.step)
        : takeEffectTextProjectionStep({ signal, stepQueue })
    )
  )
const validateAuthoredStep = ({
  authoredStep,
  plannedCorpusIndex,
  plannedStep
}: {
  readonly authoredStep: EffectTextProjectionStep
  readonly plannedCorpusIndex: number
  readonly plannedStep: EffectTextTraversalScript["entries"][number]["steps"][number]
}): Effect.Effect<void, EntryExecutionError, never> =>
  authoredStep.corpusIndex === plannedCorpusIndex
    && authoredStep.requestedWidthPx === plannedStep.requestedWidthPx
    && authoredStep.stageWidthPx === plannedStep.stageWidthPx
    && authoredStep.obstaclesEnabled === plannedStep.obstaclesEnabled
    ? Effect.void
    : Effect.fail(
      executionFailedError(
        `effect-text authored step drifted from the frozen run plan (expected corpus=${plannedCorpusIndex}, requestedWidth=${plannedStep.requestedWidthPx}, stageWidth=${plannedStep.stageWidthPx}, obstacles=${plannedStep.obstaclesEnabled}; received corpus=${authoredStep.corpusIndex}, requestedWidth=${authoredStep.requestedWidthPx}, stageWidth=${authoredStep.stageWidthPx}, obstacles=${authoredStep.obstaclesEnabled}).`
      )
    )
const preparePlannedFrames = (
  plan: EffectTextTraversalScript
): Effect.Effect<ReadonlyArray<PlannedEffectTextFrame>, never, never> =>
  Effect.forEach(
    plan.entries,
    (planEntry) =>
      Effect.gen(function*() {
        const entry = resolveReflowCorpusEntry(planEntry.corpusIndex, plan.customText)
        const prepared = yield* prepareReflowEntry(entry)

        return planEntry.steps.map((plannedStep): PlannedEffectTextFrame => ({
          corpusIndex: planEntry.corpusIndex,
          plannedStep,
          frame: {
            _tag: "effect-text",
            controls: {
              corpusIndex: planEntry.corpusIndex,
              width: plannedStep.stageWidthPx,
              obstaclesEnabled: plannedStep.obstaclesEnabled
            },
            projection: projectReflowProjection({
              entry,
              obstaclesEnabled: plannedStep.obstaclesEnabled,
              prepared,
              requestedWidthPx: plannedStep.requestedWidthPx,
              stageWidthPx: plannedStep.stageWidthPx
            })
          }
        }))
      }),
    { discard: false }
  ).pipe(Effect.map((frameGroups) => frameGroups.flat()))
const emitFrameUpdate = ({
  emit,
  frame
}: {
  readonly emit: (event: EffectTextAnimationEvent) => Effect.Effect<void, never, never>
  readonly frame: EffectTextRunFrame
}): Effect.Effect<void, never, never> => emit({ _tag: "LocalRunFrameUpdated", frame })
const drainEffectTextFrames = ({
  emit,
  remainingFrames,
  signal,
  stepQueue
}: {
  readonly emit: (event: EffectTextAnimationEvent) => Effect.Effect<void, never, never>
  readonly remainingFrames: ReadonlyArray<PlannedEffectTextFrame>
  readonly signal: RunSignal
  readonly stepQueue: Queue.Queue<ProjectionAuthoredStepQueueEvent>
}): Effect.Effect<void, EntryExecutionError, never> =>
  remainingFrames.length === 0
    ? emit(projectionDriverCompletedEvent)
    : signal.awaitRunning().pipe(
      Effect.zipRight(takeEffectTextProjectionStep({ signal, stepQueue })),
      Effect.flatMap((authoredStep) =>
        validateAuthoredStep({
          authoredStep,
          plannedCorpusIndex: remainingFrames[0]!.corpusIndex,
          plannedStep: remainingFrames[0]!.plannedStep
        }).pipe(
          Effect.zipRight(emitFrameUpdate({ emit, frame: remainingFrames[0]!.frame })),
          Effect.zipRight(
            remainingFrames.length > 1
              ? signal.yieldProjectionFrame().pipe(
                Effect.zipRight(
                  drainEffectTextFrames({
                    emit,
                    remainingFrames: remainingFrames.slice(1),
                    signal,
                    stepQueue
                  })
                )
              )
              : emit(projectionDriverCompletedEvent)
          )
        )
      )
    )
export class EffectTextAnimation extends Data.Class<EffectTextAnimation.Shape> {
  static make(animation: EffectTextAnimation.Shape): EffectTextAnimation {
    return new EffectTextAnimation(animation)
  }
  static setPlayback(
    registry: RunRegistry,
    isAnimating: boolean
  ): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      registry.set(animatingAtom, isAnimating)
    })
  }
  static syncFrameToControls(
    registry: RunRegistry,
    frame: EffectTextRunFrame
  ): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      setFrameControls(registry, frame)
    })
  }
  static reset(registry: RunRegistry): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      const customText = registry.get(customTextAtom)
      registry.set(animatingAtom, false)
      registry.set(reflowControlsAtom, effectTextSurfaceControlsForCustomText(customText))
    })
  }
  stream(): Stream.Stream<EffectTextAnimationEvent, EntryExecutionError, never> {
    return Study.streamFromEmitter<
      EffectTextAnimationEvent,
      void,
      EntryExecutionError,
      never
    >((emit) =>
      EffectTextAnimation.setPlayback(this.registry, true).pipe(
        Effect.zipRight(preparePlannedFrames(this.plan)),
        Effect.flatMap((plannedFrames) =>
          drainEffectTextFrames({
            emit,
            remainingFrames: plannedFrames,
            signal: this.signal,
            stepQueue: this.stepQueue
          })
        ),
        Effect.ensuring(EffectTextAnimation.reset(this.registry))
      )
    )
  }
}
export namespace EffectTextAnimation {
  export interface Shape {
    readonly registry: RunRegistry
    readonly signal: RunSignal
    readonly plan: EffectTextTraversalScript
    readonly stepQueue: Queue.Queue<ProjectionAuthoredStepQueueEvent>
  }
}
