/**
 * Prepares text for layout across pure, browser-backed, and React consumers.
 *
 * @remarks
 * Runtime service contracts isolate segmentation and measurement from the pure
 * layout projection. Experimental calibration APIs remain on their own
 * unstable subpath.
 *
 * @since 0.1.0
 * @module
 */

/**
 * Effectful text preparation and pure projections over the resulting handles.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Text from "./Text/index.js"

/**
 * Canvas measurement, readiness-aware caching, and synthetic regression fixtures.
 *
 * @since 0.2.0
 * @category domains
 */
export * as Browser from "./Browser/index.js"

/**
 * Cache identities and layout projections for React integrations.
 *
 * @since 0.2.0
 * @category domains
 */
export * as React from "./React/index.js"

/**
 * Segmentation, measurement, caching, hyphenation, and engine-profile services.
 *
 * @since 0.1.0
 * @category contracts
 */
export * as Contracts from "./contracts/index.js"

/**
 * Strict-input decoding and preparation-time measurement failures.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Errors from "./Errors/index.js"

/**
 * Unstable profile evaluation, weighted calibration scoring, and resumable search studies.
 *
 * @since 0.1.0
 * @category domains
 */
export * as Experimental from "./experimental/index.js"
