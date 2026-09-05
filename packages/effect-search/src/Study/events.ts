/**
 * Publishes study lifecycle events to in-process and artifact sinks.
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
import type { ArtifactStorageError } from "../Errors/Artifact.js"
import * as StudyEvent from "../StudyEvent/index.js"
import * as Trial from "../Trial/index.js"
import { betterByDirection } from "./best.js"

/**
 * Delivers study events to their destination: a pub-sub for live subscribers, an
 * artifact sink for persistence, or both through a fan-out.
 *
 * @remarks
 * `ExecuteRequest.eventPublisher` accepts one; {@link envelopeEventPublisher}
 * builds the persistent form. Publication to a persistent destination can fail
 * with {@link ArtifactStorageError}, and that failure is the study's.
 *
 * @since 0.1.0
 * @category models
 */
export class EventPublisher extends Data.Class<{
  /** Delivers one event; a persistent destination that cannot accept it fails with {@link ArtifactStorageError}. */
  readonly publish: (event: StudyEvent.StudyEvent) => Effect.Effect<void, ArtifactStorageError>
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
 * Wraps study events in artifact envelopes and sends them to an artifact sink.
 *
 * @remarks
 * Each call allocates the next artifact ID from the required {@link EnvelopeContext},
 * records the current wall-clock time, and relates the envelope to the context's
 * run ID. The envelope identifies `effect-search` as its origin and uses schema
 * version `artifact-envelope/v1`. A sink that cannot accept the envelope fails
 * publication with the sink's {@link ArtifactStorageError}.
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
            Effect.flatMap((envelope) => sink.emit(envelope))
          )
      })
    )
  )

/**
 * @since 0.1.0
 * @category utils
 */
export const appendEvent = (
  runtime: EventRuntime,
  event: StudyEvent.StudyEvent
): Effect.Effect<void, ArtifactStorageError> => runtime.eventPublisher.publish(event)

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
): Effect.Effect<void, ArtifactStorageError> =>
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
