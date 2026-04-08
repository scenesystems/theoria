import { Chunk, Effect, Either, Option, Schema, Stream } from "effect"
import { Sampler, SearchSpace, Study } from "effect-search"
import type { Sampler as StudySampler } from "effect-search/Sampler"
import * as SearchStudyEvent from "effect-search/StudyEvent"
import type { StudyEvent } from "effect-search/StudyEvent"

import {
  type Config2D,
  Config2DSchema,
  defaultSamplerSeed,
  objectiveAt,
  searchBounds,
  type TrialPoint
} from "../../../contracts/capability/effect-search.js"

type StudyLaneCheckpoint = {
  readonly events: ReadonlyArray<StudyEvent>
  readonly trialPoints: ReadonlyArray<TrialPoint>
}

export type StudyLaneStory = {
  readonly checkpoints: ReadonlyArray<StudyLaneCheckpoint>
  readonly events: ReadonlyArray<StudyEvent>
  readonly trialPoints: ReadonlyArray<TrialPoint>
}

type StudyLaneState = {
  readonly checkpoints: ReadonlyArray<StudyLaneCheckpoint>
  readonly startedByTrialNumber: Readonly<Record<string, Config2D>>
  readonly trialPoints: ReadonlyArray<TrialPoint>
}

const emptyStudyLaneState: StudyLaneState = {
  checkpoints: [],
  startedByTrialNumber: {},
  trialPoints: []
}

const objective = (config: Config2D) => Effect.succeed(objectiveAt(config))

const numericObjectiveValue = (value: number | ReadonlyArray<number>): number =>
  typeof value === "number"
    ? value
    : Option.fromNullable(value.at(0)).pipe(
      Option.match({
        onNone: () => 0,
        onSome: (nextValue) => nextValue
      })
    )

const withStartedTrial = (
  state: StudyLaneState,
  event: Extract<StudyEvent, { readonly _tag: "TrialStarted" }>
): StudyLaneState =>
  Either.match(Schema.decodeUnknownEither(Config2DSchema)(event.config), {
    onLeft: () => state,
    onRight: (config) => ({
      ...state,
      startedByTrialNumber: {
        ...state.startedByTrialNumber,
        [String(event.trialNumber)]: config
      }
    })
  })

const withCompletedTrial = (
  state: StudyLaneState,
  event: Extract<StudyEvent, { readonly _tag: "TrialCompleted" }>
): StudyLaneState => {
  const key = String(event.trialNumber)
  return Option.fromNullable(state.startedByTrialNumber[key]).pipe(
    Option.match({
      onNone: () => state,
      onSome: (config) => {
        const { [key]: _ignored, ...remainingStarted } = state.startedByTrialNumber

        return {
          ...state,
          startedByTrialNumber: remainingStarted,
          trialPoints: [
            ...state.trialPoints,
            {
              x: config.x,
              y: config.y,
              value: numericObjectiveValue(event.value),
              index: state.trialPoints.length
            }
          ]
        }
      }
    })
  )
}

const reduceStudyLaneEvent = (state: StudyLaneState, event: StudyEvent): StudyLaneState =>
  SearchStudyEvent.matchStudyEvent<StudyLaneState>({
    TrialStarted: (nextEvent) => withStartedTrial(state, nextEvent),
    TrialReported: () => state,
    TrialCompleted: (nextEvent) => withCompletedTrial(state, nextEvent),
    TrialCosted: () => state,
    TrialPruned: () => state,
    TrialRetried: () => state,
    TrialCancelled: () => state,
    TrialFailed: () => state,
    BestUpdated: () => state,
    StudyStopRequested: () => state,
    BracketStarted: () => state,
    RoundStarted: () => state,
    RoundCompleted: () => state,
    BracketCompleted: () => state,
    StudyCompleted: () => state
  })(event)

const shouldCaptureCheckpoint = ({
  checkpointCount,
  completedTrials,
  nextEvent
}: {
  readonly checkpointCount: number
  readonly completedTrials: number
  readonly nextEvent: Option.Option<StudyEvent>
}): boolean =>
  completedTrials > checkpointCount
  && Option.match(nextEvent, {
    onNone: () => true,
    onSome: (event) => event._tag === "TrialStarted"
  })

const projectStudyLaneStory = (events: ReadonlyArray<StudyEvent>): StudyLaneStory => {
  const state = events.reduce<StudyLaneState>((current, event, index) => {
    const nextState = reduceStudyLaneEvent(current, event)
    const nextEvent = Option.fromNullable(events.at(index + 1))

    return shouldCaptureCheckpoint({
        checkpointCount: current.checkpoints.length,
        completedTrials: nextState.trialPoints.length,
        nextEvent
      })
      ? {
        ...nextState,
        checkpoints: [
          ...nextState.checkpoints,
          {
            events: events.slice(0, index + 1),
            trialPoints: nextState.trialPoints
          }
        ]
      }
      : nextState
  }, emptyStudyLaneState)

  return {
    checkpoints: state.checkpoints,
    events,
    trialPoints: state.trialPoints
  }
}

export const collectStudyLaneStory = ({
  sampler,
  trialBudget
}: {
  readonly sampler: StudySampler
  readonly trialBudget: number
}): Effect.Effect<StudyLaneStory, never, never> =>
  Effect.scoped(
    Effect.gen(function*() {
      const space = yield* SearchSpace.make({
        x: SearchSpace.float(searchBounds.xMin, searchBounds.xMax),
        y: SearchSpace.float(searchBounds.yMin, searchBounds.yMax)
      }).pipe(Effect.orDie)
      const collected = yield* Stream.runCollect(
        Study.optimizeStream({
          space,
          sampler,
          objective,
          trials: trialBudget,
          direction: "minimize"
        })
      ).pipe(Effect.orDie)

      return projectStudyLaneStory(Chunk.toReadonlyArray(collected))
    })
  )

export const tpeLaneStory = (trialBudget: number): Effect.Effect<StudyLaneStory, never, never> =>
  collectStudyLaneStory({
    sampler: Sampler.tpe({ seed: defaultSamplerSeed }),
    trialBudget
  })

export const randomLaneStory = (trialBudget: number): Effect.Effect<StudyLaneStory, never, never> =>
  collectStudyLaneStory({
    sampler: Sampler.random({ seed: defaultSamplerSeed }),
    trialBudget
  })
