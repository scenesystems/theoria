/**
 * Experimental extension points.
 *
 * These APIs are public but unstable and may change outside semver guarantees.
 *
 * @since 0.1.0
 * @category experimental
 */

export const _experimental = true

/**
 * Experimental open-agent-trace ingestion and normalization lane.
 *
 * @since 0.2.0
 * @category experimental
 */
export * as OpenAgentTrace from "../OpenAgentTrace/index.js"
