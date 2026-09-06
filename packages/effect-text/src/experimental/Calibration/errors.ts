/**
 * Typed failures raised by experimental calibration optimization when supplied
 * study storage does not hold the study it was asked to persist.
 *
 * @since 0.4.0
 */
import { Schema } from "effect"

/**
 * Reports that the study storage supplied to `optimizeProfile` held no
 * `StudySnapshot` after the study ran.
 *
 * @remarks
 * `StudyStorageApi.loadSnapshot` permits absence because external storage may
 * evict or delete checkpoints. Calibration needs the checkpoint to build its
 * resumable artifacts, so absence is a typed failure rather than a defect.
 *
 * @since 0.4.0
 * @category errors
 */
export class CalibrationSnapshotMissing extends Schema.TaggedError<CalibrationSnapshotMissing>()(
  "CalibrationSnapshotMissing",
  {
    /** Number of trials the storage still retained in its trial log. */
    trialLogLength: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
  }
) {}

/**
 * Reports that the study storage supplied to `optimizeProfile` resolved to a
 * multi-objective study result.
 *
 * @remarks
 * Calibration studies minimize a single weighted loss. Storage that holds a
 * multi-objective study belongs to a different optimization and cannot supply
 * a best calibration profile.
 *
 * @since 0.4.0
 * @category errors
 */
export class CalibrationStudyNotSingleObjective
  extends Schema.TaggedError<CalibrationStudyNotSingleObjective>()("CalibrationStudyNotSingleObjective", {
    /** Number of trials retained by the multi-objective result. */
    trialCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
    /** Number of non-dominated trials on the stored Pareto front. */
    paretoFrontSize: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
  })
{}
