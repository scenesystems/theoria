/**
 * effect-text root entrypoint.
 *
 * Provisional text preparation and pure layout substrate for Effect.
 *
 * @since 0.1.0
 * @module
 */

/**
 * Provisional text preparation, prepared handles, layout, and live layers.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Text from "./Text/index.js"

/**
 * Provisional browser-backed measurement helpers.
 *
 * @since 0.2.0
 * @category domains
 */
export * as Browser from "./Browser/index.js"

/**
 * Provisional framework-thin React helpers.
 *
 * @since 0.2.0
 * @category domains
 */
export * as React from "./React/index.js"

/**
 * Stable runtime service contracts.
 *
 * @since 0.1.0
 * @category contracts
 */
export * as Contracts from "./contracts/index.js"

/**
 * Stable typed errors.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Errors from "./Errors/index.js"

/**
 * Unstable experimental seams.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Experimental from "./experimental/index.js"
