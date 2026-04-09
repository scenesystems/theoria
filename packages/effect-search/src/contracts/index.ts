/**
 * Domain contracts shared across modules — identity, envelopes, directions, distributions,
 * and objective specifications.
 *
 * @since 0.1.0
 */

/**
 * @since 0.1.0
 */
export * from "./identity.js"
/**
 * @since 0.1.0
 */
export * from "./ArtifactLineage.js"
/**
 * @since 0.1.0
 */
export * from "./ArtifactProducer.js"
/**
 * @since 0.1.0
 */
export * from "./ArtifactRelation.js"
/**
 * @since 0.1.0
 */
export * from "./ArtifactEnvelope.js"
/**
 * @since 0.1.0
 */
export * from "./ArtifactSink.js"
/**
 * @since 0.1.0
 */
export * from "./EnvelopeContext.js"
import { fileSystem as _fileSystemSink } from "./sinks/fileSystem.js"
import { readEnvelopeLog as _readEnvelopeLog } from "./sinks/reader.js"

/**
 * File-system envelope sink — writes each envelope as a JSON line to disk.
 *
 * @since 0.1.0
 * @category sinks
 */
export const fileSystemSink = _fileSystemSink

/**
 * Stream-based envelope reader — deserializes JSONL files into typed artifact envelopes.
 *
 * @since 0.1.0
 * @category readers
 */
export const readEnvelopeLog = _readEnvelopeLog
/**
 * @since 0.1.0
 */
export * from "./Direction.js"
/**
 * @since 0.1.0
 */
export * from "./Acquisition.js"
/**
 * @since 0.1.0
 */
export * from "./Distribution.js"
/**
 * @since 0.1.0
 */
export * from "./ObjectiveSpec.js"
/**
 * @since 0.1.0
 */
export * from "./ObjectiveValue.js"
/**
 * @since 0.3.0
 */
export * from "./SuggestionDiagnostics.js"
