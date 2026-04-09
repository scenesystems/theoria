/**
 * Snapshot recovery with duplicate detection, renumbering, and validation.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Equal, Match, Number as Num, Option, Order } from "effect"

import { InvalidStudyConfig } from "../../Errors/index.js"
import type { SnapshotTrial } from "./stateCodec.js"
import { StudySnapshot } from "./versioning.js"

const duplicateTrialNumber = (trials: ReadonlyArray<SnapshotTrial>): Option.Option<number> =>
  Option.map(
    Arr.findFirst(
      trials,
      (trial, index) =>
        Arr.some(
          Arr.drop(trials, index + 1),
          (candidate) => Equal.equals(candidate.trialNumber, trial.trialNumber)
        )
    ),
    (trial) => trial.trialNumber
  )

const staleReplayTrial = (
  snapshot: StudySnapshot,
  replayTail: ReadonlyArray<SnapshotTrial>
): Option.Option<SnapshotTrial> =>
  Arr.findFirst(replayTail, (trial) => Num.lessThan(trial.trialNumber, snapshot.nextTrialNumber))

const orderedTrials = (trials: ReadonlyArray<SnapshotTrial>): Array<SnapshotTrial> =>
  Arr.sort(trials, Order.mapInput(Num.Order, (trial: SnapshotTrial) => trial.trialNumber))

const completedCountFromTrials = (trials: ReadonlyArray<SnapshotTrial>): number =>
  Arr.reduce(
    trials,
    0,
    (count, trial) =>
      Match.value(trial.state).pipe(
        Match.tag("Completed", () => Num.increment(count)),
        Match.orElse(() => count)
      )
  )

const nextTrialNumberFromTrials = (trials: ReadonlyArray<SnapshotTrial>): number =>
  Num.increment(
    Arr.reduce(trials, -1, (currentMax, trial) => Num.max(currentMax, trial.trialNumber))
  )

const snapshotMetadataFromSnapshot = (snapshot: StudySnapshot) => ({
  spaceFingerprint: snapshot.spaceFingerprint,
  objectiveSpec: snapshot.objectiveSpec,
  stopMode: snapshot.stopMode,
  samplerKind: snapshot.samplerKind,
  samplerCheckpoint: snapshot.samplerCheckpoint
})

/**
 * Merge a persisted canonical snapshot with replay-tail trial log entries.
 *
 * @since 0.1.0
 * @category utils
 */
export const recoverSnapshotWithReplayTail = (
  snapshot: StudySnapshot,
  replayTail: ReadonlyArray<SnapshotTrial>
): Effect.Effect<StudySnapshot, InvalidStudyConfig> =>
  Effect.gen(function*() {
    const staleReplay = staleReplayTrial(snapshot, replayTail)

    yield* Option.match(staleReplay, {
      onNone: () => Effect.void,
      onSome: (trial) =>
        Effect.fail(
          new InvalidStudyConfig({
            reason:
              `Study.resumeFromStorage replay tail includes trial ${trial.trialNumber} below snapshot.nextTrialNumber ` +
              `${snapshot.nextTrialNumber}`
          })
        )
    })

    const mergedTrials = orderedTrials(Arr.appendAll(snapshot.trials, replayTail))
    const duplicate = duplicateTrialNumber(mergedTrials)

    yield* Option.match(duplicate, {
      onNone: () => Effect.void,
      onSome: (trialNumber) =>
        Effect.fail(
          new InvalidStudyConfig({
            reason: `Study.resumeFromStorage replay tail produced duplicate trial number ${trialNumber}`
          })
        )
    })

    return StudySnapshot.fromMaterialized({
      ...snapshotMetadataFromSnapshot(snapshot),
      nextTrialNumber: nextTrialNumberFromTrials(mergedTrials),
      trials: mergedTrials,
      completedCount: completedCountFromTrials(mergedTrials)
    })
  })
