/**
 * Values shared across search spaces, samplers, studies, and artifact persistence.
 *
 * @remarks
 * Import this module when an integration must exchange objective configuration or
 * versioned artifact records without depending on a study implementation.
 *
 * @since 0.1.0
 * @module
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
 * Appends artifact envelopes to `envelopes.jsonl` under the supplied directory.
 *
 * @remarks
 * Requires platform filesystem and path services. Directory creation, encoding, and
 * append errors are discarded because {@link ArtifactSink} has no typed failure channel;
 * successful emission therefore does not confirm persistence.
 *
 * @since 0.1.0
 * @category sinks
 */
export const fileSystemSink = _fileSystemSink

/**
 * Streams valid envelopes from a UTF-8 JSON-lines file and omits invalid lines.
 * Missing files and filesystem failures end as an empty or truncated stream rather
 * than a typed failure.
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
