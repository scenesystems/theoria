/**
 * Defines and decodes the versioned study snapshot format.
 *
 * @since 0.1.0
 */
import * as VariantSchema from "@effect/experimental/VariantSchema"
import { Array as Arr, Effect, Number as Num, Schema } from "effect"

import type * as Trial from "../../Trial/index.js"
import { isCompletedTrial } from "../best.js"
import { SnapshotMetadataSchema } from "./metadata.js"
import { samplerMetricsFromTrials, SamplerMetricsSchema, studyDurationFromTrials } from "./metrics.js"
import { type SnapshotTrial, SnapshotTrialSchema, trialToSnapshot } from "./stateCodec.js"

/**
 * Accepts only on-disk format version `1`; snapshots with any other version
 * fail decoding rather than being interpreted with incompatible fields.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SnapshotFormatVersionSchema = Schema.Literal(1)

/**
 * Identifies the only on-disk study snapshot format accepted by this release.
 *
 * @since 0.1.0
 * @category type-level
 */
export type SnapshotFormatVersion = Schema.Schema.Type<typeof SnapshotFormatVersionSchema>

const CURRENT_SNAPSHOT_FORMAT_VERSION: SnapshotFormatVersion = 1

const SnapshotFormatVariants = VariantSchema.make({
  variants: ["formatV1"],
  defaultVariant: "formatV1"
})

const SnapshotCoreFields = {
  ...SnapshotMetadataSchema.fields,
  /** Trial number reserved for the next generated configuration. */
  nextTrialNumber: Schema.Number,
  /** Persisted trials in the order recorded by the study. */
  trials: Schema.Array(SnapshotTrialSchema),
  /** Number of persisted trials in the completed state. */
  completedCount: Schema.Number
}

const StudySnapshotFormatStruct = SnapshotFormatVariants.Struct({
  snapshotFormatVersion: SnapshotFormatVariants.Field({
    formatV1: SnapshotFormatVersionSchema
  }),
  ...SnapshotCoreFields,
  studyDuration: SnapshotFormatVariants.FieldOnly("formatV1")(Schema.Number),
  samplerMetrics: SnapshotFormatVariants.FieldOnly("formatV1")(SamplerMetricsSchema)
})

const SnapshotFormatVariantUnion = SnapshotFormatVariants.Union(StudySnapshotFormatStruct)

/**
 * Decodes version 1 study snapshots, including persisted duration and sampler metrics.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StudySnapshotFormatVariantSchema = SnapshotFormatVariantUnion.formatV1

/**
 * Stores the restoration state and derived diagnostics for one saved study.
 *
 * @remarks
 * Direct class construction does not decode or validate fields. Snapshots created
 * by study operations use format version 1, derive `studyDuration` by summing trial
 * durations, and derive sampler metrics from the saved trials and checkpoint.
 *
 * @since 0.1.0
 * @category models
 */
export class StudySnapshot extends Schema.Class<StudySnapshot>("effect-search/StudySnapshot")({
  /** On-disk format discriminator; currently always `1`. */
  snapshotFormatVersion: SnapshotFormatVersionSchema,
  ...SnapshotCoreFields,
  /** Sum of completed, failed, and pruned trial durations in milliseconds. */
  studyDuration: Schema.Number,
  /** Counts derived from saved trials together with the sampler checkpoint tag. */
  samplerMetrics: SamplerMetricsSchema
}) {}

type SnapshotMaterialized = Schema.Schema.Type<typeof SnapshotMetadataSchema> & {
  readonly nextTrialNumber: number
  readonly trials: ReadonlyArray<SnapshotTrial>
  readonly completedCount: number
}

const toStudySnapshot = (snapshot: SnapshotMaterialized): StudySnapshot =>
  new StudySnapshot({
    ...snapshot,
    snapshotFormatVersion: CURRENT_SNAPSHOT_FORMAT_VERSION,
    studyDuration: studyDurationFromTrials(snapshot.trials),
    samplerMetrics: samplerMetricsFromTrials(snapshot.trials, snapshot.samplerCheckpoint, snapshot.completedCount)
  })

/**
 * @since 0.1.0
 * @category constructors
 */
export const makeStudySnapshot = (snapshot: SnapshotMaterialized): StudySnapshot => toStudySnapshot(snapshot)

/**
 * Computes the next non-negative trial number after all generated trials.
 *
 * @remarks
 * Negative warm-start trial numbers do not lower the result below zero. With any
 * non-negative trial, the result is one greater than the largest trial number.
 *
 * @typeParam Config - Decoded configuration retained by the input trials.
 *
 * @since 0.1.0
 * @category combinators
 */
export const nextTrialNumberFromTrials = <Config>(trials: ReadonlyArray<Trial.Trial<Config>>): number =>
  Num.increment(
    Arr.reduce(trials, -1, (currentMax, trial) => Num.max(currentMax, trial.trialNumber))
  )

const completedCountFromTrials = <Config>(trials: ReadonlyArray<Trial.Trial<Config>>): number =>
  Arr.reduce(
    trials,
    0,
    (count, trial) => (isCompletedTrial(trial) ? Num.increment(count) : count)
  )

const snapshotTrialsFromTrials = <Config>(trials: ReadonlyArray<Trial.Trial<Config>>): Array<SnapshotTrial> =>
  Arr.map(trials, trialToSnapshot)

/**
 * @since 0.1.0
 * @category constructors
 */
export const snapshotFromTrials = <Config>(
  trials: ReadonlyArray<Trial.Trial<Config>>,
  metadata: Schema.Schema.Type<typeof SnapshotMetadataSchema>
): StudySnapshot =>
  makeStudySnapshot({
    ...metadata,
    nextTrialNumber: nextTrialNumberFromTrials(trials),
    trials: snapshotTrialsFromTrials(trials),
    completedCount: completedCountFromTrials(trials)
  })

/**
 * Decodes a version 1 snapshot and rebuilds its derived duration and sampler metrics.
 *
 * @remarks
 * Structural or schema-invalid input fails with an Effect Schema parse error.
 * Persisted `studyDuration` and `samplerMetrics` must decode, but their values are
 * replaced with values derived from the decoded trials, checkpoint, and completed count.
 *
 * @since 0.1.0
 * @category codecs
 */
export const decodeStudySnapshot = (
  snapshot: unknown
) =>
  Schema.decodeUnknown(StudySnapshotFormatVariantSchema)(snapshot).pipe(
    Effect.map((decoded) => toStudySnapshot(decoded))
  )
