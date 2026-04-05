/**
 * Provider-blind inference substrate for Effect-native model runtime selection.
 *
 * The stable `v0.1` lane keeps requested runtime intent, resolved-route
 * provenance, and post-execution runtime evidence as separate authorities
 * across the `OpenAiCompatible`, `OpenAiResponses`, `AnthropicMessages`, and
 * `HuggingFace` route families.
 *
 * @since 0.1.0
 */

/**
 * Schema-owned runtime descriptor and evidence contracts.
 *
 * @since 0.1.0
 * @category contracts
 */
export * as Contracts from "./contracts/index.js"

/**
 * Typed package-owned resolution and capability errors.
 *
 * @since 0.1.0
 * @category errors
 */
export * as Errors from "./Errors/index.js"

/**
 * Runtime resolver services, config decoding, post-execution runtime-evidence
 * assembly, and testing helpers.
 *
 * @since 0.1.0
 * @category runtime
 */
export * as Runtime from "./Runtime/index.js"

/**
 * OpenAI-compatible route-family helpers and future live adapter entrypoints.
 *
 * @since 0.1.0
 * @category runtime
 */
export * as OpenAiCompatible from "./OpenAiCompatible/index.js"

/**
 * Hugging Face route-family helpers and future live adapter entrypoints.
 *
 * @since 0.1.0
 * @category runtime
 */
export * as HuggingFace from "./HuggingFace/index.js"

/**
 * Testing fixtures and deterministic runtime-resolution helpers.
 *
 * @since 0.1.0
 * @category testing
 */
export * as Testing from "./testing/index.js"

/**
 * Unstable companion surfaces.
 *
 * @since 0.1.0
 * @category experimental
 */
export * as Experimental from "./experimental/index.js"
