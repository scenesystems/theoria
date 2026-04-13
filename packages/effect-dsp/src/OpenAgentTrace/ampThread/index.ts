/**
 * Amp thread export schema and normalization surface.
 *
 * @since 0.2.0
 */
import { normalizeExport, normalizeExportSnapshot } from "./normalize.js"
import { decodeExportSnapshot } from "./schema.js"

/**
 * Replay-safe Amp thread export snapshot nouns.
 *
 * @since 0.2.0
 */
export * from "./schema.js"

/**
 * Amp thread export normalization entrypoints.
 *
 * @since 0.2.0
 */
export * from "./normalize.js"

/**
 * Amp thread export surface under the `OpenAgentTrace` namespace.
 *
 * @since 0.2.0
 */
export const AmpThread = {
  decodeExportSnapshot,
  normalizeExport,
  normalizeExportSnapshot
}
