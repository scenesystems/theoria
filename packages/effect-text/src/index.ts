/**
 * Measured text preparation, pure layout, canvas providers, and calibration.
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
export * as Text from "./Text.js"

/**
 * Advance-width measurement capabilities and deterministic estimates.
 *
 * @since 0.2.0
 * @category domains
 */
export * as TextMeasurer from "./TextMeasurer.js"

/**
 * Scoped measurement memoization and reader lifetime ownership.
 *
 * @since 0.2.0
 * @category domains
 */
export * as MeasurementCache from "./MeasurementCache.js"

/**
 * Dictionary sources, compiled matchers, and locale-aware break opportunities.
 *
 * @since 0.1.0
 * @category contracts
 */
export * as Hyphenation from "./Hyphenation.js"

/**
 * Serialized canvas measurement with host state restoration.
 *
 * @since 0.1.0
 * @category domains
 */
export * as CanvasTextMeasurer from "./CanvasTextMeasurer.js"

/**
 * Canvas font selections paired with text preparation profiles.
 *
 * @since 0.1.0
 * @category domains
 */
export * as CanvasProfile from "./CanvasProfile.js"

/**
 * Structural preparation identities and font-readiness generations.
 *
 * @since 0.5.0
 * @category domains
 */
export * as PreparationKey from "./PreparationKey.js"

/**
 * Profile evaluation, weighted scoring, and resumable calibration studies.
 *
 * @since 0.5.0
 * @category domains
 */
export * as Calibration from "./Calibration.js"
