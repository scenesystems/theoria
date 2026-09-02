/**
 * Schema union for package-owned serializable errors.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"
import { EvaluationFailed, MetricError } from "./metric.js"
import { CompositionError, ParseOutputError } from "./module.js"
import { AllTrialsFailed, BootstrapFailed, InstructionProposalFailed, MergeRejected } from "./optimizer.js"
import { SaveLoadError } from "./save-load.js"
import { SignatureError } from "./signature.js"
import { TraceError } from "./trace.js"

/**
 * Decodes package-owned failures across signatures, modules, optimizers,
 * evaluation, tracing, and persistence.
 *
 * @remarks
 * Provider, platform, dependency, Schema parse, and user callback errors remain
 * outside this union when public operations expose them separately.
 *
 * @since 0.1.0
 * @category errors
 */
export const DspError = Schema.Union(
  SignatureError,
  ParseOutputError,
  CompositionError,
  BootstrapFailed,
  InstructionProposalFailed,
  AllTrialsFailed,
  MergeRejected,
  MetricError,
  EvaluationFailed,
  TraceError,
  SaveLoadError
)

/**
 * Selects the tagged error values decoded by the {@link DspError} schema.
 *
 * @since 0.1.0
 * @category errors
 */
export type DspError = Schema.Schema.Type<typeof DspError>
