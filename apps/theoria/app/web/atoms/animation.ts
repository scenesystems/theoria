import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import type { Deferred, Stream } from "effect"
import { Effect, Queue } from "effect"
import { Study } from "effect-search"

import type { CanonicalFrame, EffectTextProjectionStep } from "../../contracts/canonical-step.js"
import { corpus } from "../../contracts/corpus.js"
import { DemoExecutionError } from "../../contracts/demo-error.js"
import type { EffectTextRunPlan } from "../../contracts/demo/text.js"
import type { EvidenceEvent } from "../../contracts/evidence-stream.js"
import { type LocalDriverCompletedEvent, localDriverCompletedEvent } from "./local-driver-events.js"
import {
  customTextAtom,
  type EffectTextRunFrame,
  prepareReflowEntry,
  projectReflowProjection,
  reflowControlsAtom,
  reflowSliderMaxWidth,
  resolveReflowCorpusEntry
} from "./reflow.js"
import { awaitNextRunSignalChange, awaitRunSignal, type RunSignal, yieldProjectionFrame } from "./run-lifecycle.js"
import type { RunRegistry } from "./run-registry-context.js"

export const animatingAtom: AtomType.Writable<boolean> = Atom.make(false)

const defaultReflowWidth = Math.round(reflowSliderMaxWidth / 2)

type StreamCompletionEvent = Extract<EvidenceEvent, { readonly _tag: "StreamComplete" }>
type AuthoredStepQueueEvent = CanonicalFrame | StreamCompletionEvent
type EffectTextAnimationEvent =
  | { readonly _tag: "LocalRunFrameUpdated"; readonly frame: EffectTextRunFrame }
  | LocalDriverCompletedEvent

const executionFailedError = (message: string): DemoExecutionError =>
  new DemoExecutionError({
    code: "execution-failed",
    message,
    retryable: true
  })

const isStreamCompletionEvent = (
  event: AuthoredStepQueueEvent
): event is StreamCompletionEvent => "_tag" in event && event._tag === "StreamComplete"

const setFrameControls = (
  registry: RunRegistry,
  frame: EffectTextRunFrame
): void => {
  registry.set(reflowControlsAtom, frame.controls)
}

export const setAnimationPlayback = (
  registry: RunRegistry,
  isAnimating: boolean
): Effect.Effect<void, never, never> =>
  Effect.sync(() => {
    registry.set(animatingAtom, isAnimating)
  })

export const syncAnimationFrameToControls = (
  registry: RunRegistry,
  frame: EffectTextRunFrame
): Effect.Effect<void, never, never> =>
  Effect.sync(() => {
    setFrameControls(registry, frame)
  })

export const resetAnimationState = (registry: RunRegistry): Effect.Effect<void, never, never> =>
  Effect.sync(() => {
    const hasCustomText = registry.get(customTextAtom).trim().length > 0

    registry.set(animatingAtom, false)
    registry.set(reflowControlsAtom, {
      corpusIndex: hasCustomText ? corpus.length : 0,
      width: defaultReflowWidth,
      obstaclesEnabled: false
    })
  })

const takeAuthoredStepQueueEvent = (
  signal: RunSignal,
  stepQueue: Queue.Queue<AuthoredStepQueueEvent>
): Effect.Effect<AuthoredStepQueueEvent, never, never> =>
  Effect.raceFirst(
    Queue.take(stepQueue),
    awaitNextRunSignalChange(signal).pipe(
      Effect.zipRight(awaitRunSignal(signal)),
      Effect.flatMap(() => takeAuthoredStepQueueEvent(signal, stepQueue))
    )
  )

const takeEffectTextProjectionStep = (
  signal: RunSignal,
  stepQueue: Queue.Queue<AuthoredStepQueueEvent>
): Effect.Effect<EffectTextProjectionStep, DemoExecutionError, never> =>
  takeAuthoredStepQueueEvent(signal, stepQueue).pipe(
    Effect.flatMap((nextEvent) =>
      isStreamCompletionEvent(nextEvent)
        ? Effect.fail(
          executionFailedError("effect-text run ended before all authored projection steps arrived.")
        )
        : nextEvent.step._tag === "EffectTextProjectionStep"
        ? Effect.succeed(nextEvent.step)
        : takeEffectTextProjectionStep(signal, stepQueue)
    )
  )

const validateAuthoredStep = ({
  authoredStep,
  plannedCorpusIndex,
  plannedStep
}: {
  readonly authoredStep: EffectTextProjectionStep
  readonly plannedCorpusIndex: number
  readonly plannedStep: EffectTextRunPlan["entries"][number]["steps"][number]
}): Effect.Effect<void, DemoExecutionError, never> =>
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

export const makeAnimationStream = (
  registry: RunRegistry,
  signal: RunSignal,
  plan: EffectTextRunPlan,
  stepQueue: Queue.Queue<AuthoredStepQueueEvent>,
  _serverCompleted: Deferred.Deferred<StreamCompletionEvent>
): Stream.Stream<EffectTextAnimationEvent, DemoExecutionError, never> =>
  Study.streamFromEmitter<
    EffectTextAnimationEvent,
    void,
    DemoExecutionError,
    never
  >((emit) =>
    setAnimationPlayback(registry, true).pipe(
      Effect.zipRight(
        Effect.forEach(
          plan.entries,
          (planEntry) =>
            Effect.gen(function*() {
              const entry = resolveReflowCorpusEntry(planEntry.corpusIndex, plan.customText)
              const prepared = yield* prepareReflowEntry(entry)

              yield* Effect.forEach(
                planEntry.steps,
                (plannedStep) =>
                  Effect.gen(function*() {
                    yield* awaitRunSignal(signal)
                    const authoredStep = yield* takeEffectTextProjectionStep(signal, stepQueue)

                    yield* validateAuthoredStep({
                      authoredStep,
                      plannedCorpusIndex: planEntry.corpusIndex,
                      plannedStep
                    })

                    const projection = projectReflowProjection({
                      entry,
                      obstaclesEnabled: plannedStep.obstaclesEnabled,
                      prepared,
                      requestedWidthPx: plannedStep.requestedWidthPx,
                      stageWidthPx: plannedStep.stageWidthPx
                    })

                    yield* emit({
                      _tag: "LocalRunFrameUpdated",
                      frame: {
                        _tag: "effect-text",
                        controls: {
                          corpusIndex: planEntry.corpusIndex,
                          width: plannedStep.stageWidthPx,
                          obstaclesEnabled: plannedStep.obstaclesEnabled
                        },
                        projection
                      }
                    })
                    yield* yieldProjectionFrame(signal)
                  }),
                { discard: true }
              )
            }),
          { discard: true }
        )
      ),
      Effect.zipRight(emit(localDriverCompletedEvent)),
      Effect.ensuring(resetAnimationState(registry))
    )
  )
