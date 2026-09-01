/**
 * Versioned snapshot schema with v1/v2 support and snapshot construction helpers.
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
 * The supported on-disk study snapshot format version.
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
  nextTrialNumber: Schema.Number,
  trials: Schema.Array(SnapshotTrialSchema),
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
 * Variant schema seam for future snapshot format upgrades.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StudySnapshotFormatVariantSchema = SnapshotFormatVariantUnion.formatV1

/**
 * Canonical snapshot format emitted by `Study.snapshot`.
 *
 * @since 0.1.0
 * @category models
 */
export class StudySnapshot extends Schema.Class<StudySnapshot>("effect-search/StudySnapshot")({
  snapshotFormatVersion: SnapshotFormatVersionSchema,
  ...SnapshotCoreFields,
  studyDuration: Schema.Number,
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
 * Returns one greater than the largest existing trial number, or zero for no trials.
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
 * Decode the canonical snapshot format.
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
