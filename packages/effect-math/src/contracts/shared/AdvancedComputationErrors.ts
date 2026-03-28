/**
 * Typed error taxonomy for advanced computation contract authority.
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

/**
 * Raised when a requested scalar lane is not available for an operation.
 *
 * @since 0.1.0
 * @category errors
 */
export class ScalarLaneUnsupportedError
  extends Schema.TaggedError<ScalarLaneUnsupportedError>()("ScalarLaneUnsupportedError", {
    operation: Schema.String,
    requestedKind: Schema.String,
    availableKinds: Schema.Array(Schema.String),
    message: Schema.String
  })
{}

/**
 * Raised when precision escalation cannot produce a next scalar lane.
 *
 * @since 0.1.0
 * @category errors
 */
export class PrecisionEscalationExhaustedError
  extends Schema.TaggedError<PrecisionEscalationExhaustedError>()("PrecisionEscalationExhaustedError", {
    operation: Schema.String,
    requestedKind: Schema.String,
    attempts: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
    message: Schema.String
  })
{}

/**
 * Raised when no backend can satisfy a dispatch request.
 *
 * @since 0.1.0
 * @category errors
 */
export class BackendUnavailableError extends Schema.TaggedError<BackendUnavailableError>()("BackendUnavailableError", {
  operation: Schema.String,
  requestedBackend: Schema.String,
  availableBackends: Schema.Array(Schema.String),
  message: Schema.String
}) {}

/**
 * Raised when requested autodiff mode is unavailable.
 *
 * @since 0.1.0
 * @category errors
 */
export class AutodiffUnavailableError
  extends Schema.TaggedError<AutodiffUnavailableError>()("AutodiffUnavailableError", {
    operation: Schema.String,
    requestedMode: Schema.String,
    availableModes: Schema.Array(Schema.String),
    message: Schema.String
  })
{}

/**
 * Raised when advanced dispatch boundary decoding fails.
 *
 * @since 0.1.0
 * @category errors
 */
export class ComputationDispatchDecodeError
  extends Schema.TaggedError<ComputationDispatchDecodeError>()("ComputationDispatchDecodeError", {
    operation: Schema.String,
    message: Schema.String
  })
{}

/**
 * Raised by placeholder dispatch implementations during RED-first execution.
 *
 * @since 0.1.0
 * @category errors
 */
export class ComputationDispatchUnimplementedError
  extends Schema.TaggedError<ComputationDispatchUnimplementedError>()("ComputationDispatchUnimplementedError", {
    operation: Schema.String,
    message: Schema.String
  })
{}

/**
 * Raised when synchronous kernels throw during effectful dispatch.
 *
 * @since 0.1.0
 * @category errors
 */
export class KernelExecutionError extends Schema.TaggedError<KernelExecutionError>()("KernelExecutionError", {
  operation: Schema.String,
  message: Schema.String
}) {}
