/**
 * Event publishing infrastructure for study lifecycle notifications.
 *
 * @since 0.1.0
 */
import { Data, DateTime, Effect, Match, Number as Num, Option, PubSub, Ref, Tuple } from "effect"

import {
  type ArtifactEnvelopeVersion,
  ArtifactLineage,
  type ArtifactSinkApi,
  type ComponentPath,
  EnvelopeContext,
  RunRelation,
  SourceRef,
  StudyEventEnvelope
} from "../contracts/index.js"
import { matchObjectiveSpec, type ObjectiveSpec } from "../contracts/ObjectiveSpec.js"
import * as StudyEvent from "../StudyEvent/index.js"
import * as Trial from "../Trial/index.js"
import { betterByDirection } from "./best.js"

/**
 * @since 0.1.0
 * @category models
 */
export class EventPublisher extends Data.Class<{
  readonly publish: (event: StudyEvent.StudyEvent) => Effect.Effect<void>
}> {}

/**
 * @since 0.1.0
 * @category constructors
 */
export const noopEventPublisher = new EventPublisher({
  publish: () => Effect.succeed(undefined)
})

/**
 * @since 0.1.0
 * @category models
 */
export class EventRuntime extends Data.Class<{
  readonly bestValueRef: Ref.Ref<Option.Option<number>>
  readonly noImprovementCountRef: Ref.Ref<number>
  readonly eventPublisher: EventPublisher
}> {}

const updateNoImprovementCount = (
  noImprovementCountRef: Ref.Ref<number>,
  wasUpdated: boolean
): Effect.Effect<void> =>
  Ref.update(noImprovementCountRef, (current) =>
    Match.value(wasUpdated).pipe(
      Match.when(true, () => 0),
      Match.orElse(() => Num.increment(current))
    ))

/**
 * @since 0.1.0
 * @category constructors
 */
export const eventPublisherFromPubSub = (pubsub: PubSub.PubSub<StudyEvent.StudyEvent>): EventPublisher =>
  new EventPublisher({
    publish: (event) => PubSub.publish(pubsub, event).pipe(Effect.asVoid)
  })

/**
 * @since 0.1.0
 * @category constructors
 */
export const fanoutEventPublisher = (left: EventPublisher, right: EventPublisher): EventPublisher =>
  new EventPublisher({
    publish: (event) => left.publish(event).pipe(Effect.zipRight(right.publish(event)))
  })

const SCHEMA_VERSION: ArtifactEnvelopeVersion = "artifact-envelope/v1"
const EVENT_COMPONENT: ComponentPath = ["Study", "events"]
const EVENT_SOURCE_REF = new SourceRef({ origin: "effect-search", domain: "study", segments: ["event"] })

/**
 * Create an event publisher that wraps study events in artifact envelopes and writes them to a sink.
 *
 * @since 0.1.0
 * @category constructors
 */
export const envelopeEventPublisher = (sink: ArtifactSinkApi): Effect.Effect<EventPublisher, never, EnvelopeContext> =>
  EnvelopeContext.pipe(
    Effect.map((ctx) =>
      new EventPublisher({
        publish: (event) =>
          ctx.nextArtifactId.pipe(
            Effect.map((artifactId) =>
              StudyEventEnvelope({
                schemaVersion: SCHEMA_VERSION,
                producer: {
                  _tag: "EffectSearch",
                  packageVersion: ctx.packageVersion,
                  component: EVENT_COMPONENT,
                  runId: ctx.runId
                },
                lineage: new ArtifactLineage({
                  sourceRef: EVENT_SOURCE_REF,
                  artifactId,
                  emittedAt: DateTime.unsafeNow()
                }),
                relations: [RunRelation({ ref: ctx.runId })],
                event
              })
            ),
            Effect.flatMap((envelope) => sink.emit(envelope)),
            Effect.catchAll(() => Effect.void)
          )
      })
    )
  )

/**
 * @since 0.1.0
 * @category utils
 */
export const appendEvent = (runtime: EventRuntime, event: StudyEvent.StudyEvent): Effect.Effect<void> =>
  runtime.eventPublisher.publish(event)

const eventFromFinalizedTrial = <Config>(trial: Trial.Trial<Config>): Option.Option<StudyEvent.StudyEvent> =>
  Trial.matchState({
    Running: () => Option.none(),
    Completed: ({ value }) => Option.some(StudyEvent.TrialCompleted({ trialNumber: trial.trialNumber, value })),
    Pruned: ({ step, reason, policy }) =>
      Option.some(
        StudyEvent.TrialPruned({
          trialNumber: trial.trialNumber,
          step,
          reason,
          policy
        })
      ),
    Failed: ({ error }) => Option.some(StudyEvent.TrialFailed({ trialNumber: trial.trialNumber, error })),
    Cancelled: () => Option.none()
  })(trial.state)

const updateBestValue = (
  bestValueRef: Ref.Ref<Option.Option<number>>,
  direction: "minimize" | "maximize",
  candidateValue: number
): Effect.Effect<boolean> =>
  Ref.modify(bestValueRef, (currentBest) =>
    Option.match(currentBest, {
      onNone: () => Tuple.make(true, Option.some(candidateValue)),
      onSome: (value): readonly [boolean, Option.Option<number>] =>
        Match.value(betterByDirection(direction, candidateValue, value)).pipe(
          Match.when(true, () => Tuple.make(true, Option.some(candidateValue))),
          Match.when(false, () => Tuple.make(false, currentBest)),
          Match.exhaustive
        )
    }))

/**
 * @since 0.1.0
 * @category utils
 */
export const emitLifecycleEvents = <Config>(
  objectiveSpec: ObjectiveSpec,
  finalized: Trial.Trial<Config>,
  runtime: EventRuntime
): Effect.Effect<void> =>
  Effect.gen(function*() {
    yield* Option.match(eventFromFinalizedTrial(finalized), {
      onNone: () => Effect.succeed(undefined),
      onSome: (event) => appendEvent(runtime, event)
    })

    yield* Trial.matchState({
      Running: () => Effect.succeed(undefined),
      Pruned: () => Effect.succeed(undefined),
      Failed: () => Effect.succeed(undefined),
      Cancelled: () => Effect.succeed(undefined),
      Completed: ({ value }) =>
        matchObjectiveSpec({
          Single: ({ direction }) =>
            Match.value(value).pipe(
              Match.when(Match.number, (numericValue) =>
                updateBestValue(runtime.bestValueRef, direction, numericValue).pipe(
                  Effect.flatMap((wasUpdated) =>
                    updateNoImprovementCount(runtime.noImprovementCountRef, wasUpdated).pipe(
                      Effect.zipRight(
                        Effect.when(
                          appendEvent(
                            runtime,
                            StudyEvent.BestUpdated({ trialNumber: finalized.trialNumber, value: numericValue })
                          ),
                          () => wasUpdated
                        )
                      )
                    )
                  ),
                  Effect.asVoid
                )),
              Match.orElse(() => Effect.succeed(undefined))
            ),
          Multi: () => Effect.succeed(undefined)
        })(objectiveSpec)
    })(finalized.state)
  })
