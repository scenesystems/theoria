/**
 * Defines typed failures for authority resolution and computation dispatch.
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

/**
 * Reports that scalar authority found no lane for an operation category.
 *
 * @remarks
 * `requestedKind` records the explicit request or policy primary. The
 * `availableKinds` array contains lanes whose capability declarations include
 * the requested category.
 *
 * @since 0.1.0
 * @category errors
 */
export class ScalarLaneUnsupportedError
  extends Schema.TaggedError<ScalarLaneUnsupportedError>()("ScalarLaneUnsupportedError", {
    /** Requested operation whose category could not be assigned. */
    operation: Schema.String,
    /** Explicit scalar kind, or the policy's primary kind, requested for the operation. */
    requestedKind: Schema.String,
    /** Configured scalar kinds declaring support for the operation category. */
    availableKinds: Schema.Array(Schema.String),
    /** Diagnostic explanation of the failed lane selection. */
    message: Schema.String
  })
{}

/**
 * Reports that failed convergence cannot advance to another scalar lane.
 *
 * @remarks
 * This occurs when the escalation budget is exhausted, the current lane is
 * absent from the configured order, or no later lane exists. `attempts`
 * records the caller-supplied failed-gate count.
 *
 * @since 0.1.0
 * @category errors
 */
export class PrecisionEscalationExhaustedError
  extends Schema.TaggedError<PrecisionEscalationExhaustedError>()("PrecisionEscalationExhaustedError", {
    /** Operation whose convergence gate requested escalation. */
    operation: Schema.String,
    /** Scalar kind used by the failed lane. */
    requestedKind: Schema.String,
    /** Number of failed convergence gates already counted by the caller. */
    attempts: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
    /** Diagnostic explanation of the exhausted order or budget. */
    message: Schema.String
  })
{}

/**
 * Reports that the runtime backend order contains no lane for the selected scalar kind.
 *
 * @remarks
 * `requestedBackend` is diagnostic metadata from the request or runtime
 * policy. `availableBackends` lists all statically enabled backends, including
 * any that cannot execute the selected scalar kind.
 *
 * @since 0.1.0
 * @category errors
 */
export class BackendUnavailableError extends Schema.TaggedError<BackendUnavailableError>()("BackendUnavailableError", {
  /** Operation awaiting backend selection. */
  operation: Schema.String,
  /** Backend requested explicitly or selected first by runtime policy. */
  requestedBackend: Schema.String,
  /** Statically enabled backends, regardless of scalar-kind compatibility. */
  availableBackends: Schema.Array(Schema.String),
  /** Diagnostic explanation of the failed backend selection. */
  message: Schema.String
}) {}

/**
 * Reports that no declared autodiff mode is available and finite-difference fallback is disabled.
 *
 * @remarks
 * `requestedMode` contains the preferred mode or `"policy-default"`.
 * `availableModes` contains modes whose capability has `available: true`.
 *
 * @since 0.1.0
 * @category errors
 */
export class AutodiffUnavailableError
  extends Schema.TaggedError<AutodiffUnavailableError>()("AutodiffUnavailableError", {
    /** Differentiation operation awaiting mode selection. */
    operation: Schema.String,
    /** Preferred mode, or `"policy-default"` when no mode was explicit. */
    requestedMode: Schema.String,
    /** Declared modes whose capability is currently available. */
    availableModes: Schema.Array(Schema.String),
    /** Diagnostic explanation of the unavailable mode and disabled fallback. */
    message: Schema.String
  })
{}

/**
 * Reports that an advanced dispatch request failed Schema decoding.
 *
 * @remarks
 * `operation` is `"ComputationDispatchRequest"` because the requested
 * operation cannot be trusted until decoding succeeds. `message` contains
 * Effect Schema's issue report.
 *
 * @since 0.1.0
 * @category errors
 */
export class ComputationDispatchDecodeError
  extends Schema.TaggedError<ComputationDispatchDecodeError>()("ComputationDispatchDecodeError", {
    /** Stable boundary name used before the request's operation can be trusted. */
    operation: Schema.String,
    /** Effect Schema issue report for the rejected request. */
    message: Schema.String
  })
{}

/**
 * Reports that a dispatcher has no implementation for a recognized operation.
 *
 * @remarks
 * Current exported dispatch operations do not emit this error. Custom
 * dispatchers may use it to distinguish missing kernels from malformed plans.
 *
 * @since 0.1.0
 * @category errors
 */
export class ComputationDispatchUnimplementedError
  extends Schema.TaggedError<ComputationDispatchUnimplementedError>()("ComputationDispatchUnimplementedError", {
    /** Recognized operation for which the dispatcher has no kernel. */
    operation: Schema.String,
    /** Dispatcher diagnostic suitable for logging or error presentation. */
    message: Schema.String
  })
{}

/**
 * Reports an exception thrown by a synchronous kernel at an Effect boundary.
 *
 * @remarks
 * `operation` names the kernel wrapper. `message` is derived from the thrown
 * value. Calculus validated operations currently emit this error.
 *
 * @since 0.1.0
 * @category errors
 */
export class KernelExecutionError extends Schema.TaggedError<KernelExecutionError>()("KernelExecutionError", {
  /** Public operation wrapping the synchronous kernel. */
  operation: Schema.String,
  /** Diagnostic derived from the value thrown by the kernel. */
  message: Schema.String
}) {}
