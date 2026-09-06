/**
 * Separates requested model intent, pre-execution route resolution, and
 * post-execution evidence for Effect AI model providers.
 *
 * @remarks
 * Requested runtime intent, resolver-selected route provenance, and provider
 * response evidence remain separate records
 * across the `OpenAiCompatible`, `OpenAiResponses`, `AnthropicMessages`, and
 * `HuggingFace` route families.
 *
 * @since 0.1.0
 * @module
 */

/**
 * Schema-owned runtime descriptor and evidence contracts.
 *
 * @since 0.1.0
 * @category contracts
 */
export * as Contracts from "./contracts/index.js"

/**
 * Errors returned for invalid config, unsupported routes, and unmet capabilities.
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
 * OpenAI-compatible route descriptors plus live language and embedding model
 * layers. The returned layers own their HTTP client dependencies.
 *
 * @since 0.1.0
 * @category runtime
 */
export * as OpenAiCompatible from "./OpenAiCompatible/index.js"

/**
 * Hugging Face routed-marketplace and dedicated-endpoint descriptors, config
 * decoding, and live language and embedding model layers.
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
 * Opt-in native protocol families excluded from canonical execution routes;
 * importing this namespace accepts their experimental compatibility boundary.
 *
 * @since 0.1.0
 * @category experimental
 */
export * as Experimental from "./experimental/index.js"
