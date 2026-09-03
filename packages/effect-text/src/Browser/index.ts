/**
 * Connects text preparation to canvas measurement, font-readiness revisions,
 * browser support profiles, and synthetic regression artifacts.
 *
 * @remarks
 * Use the browser measurement Layers when prepared widths must follow a
 * canvas context. After preparation succeeds, line layout remains in the pure
 * `Text` module and does not require browser services.
 *
 * @since 0.2.0
 */

/**
 * Marks browser measurement Layers, profiles, and synthetic artifacts as provisional.
 *
 * @since 0.2.0
 * @category stability
 */
export const BrowserStability = "provisional"

/**
 * Browser-backed measurement layers.
 *
 * @since 0.2.0
 */
export * from "./layers.js"

/**
 * Monotonic generations that invalidate widths after browser fonts become ready.
 *
 * @since 0.2.0
 */
export * from "./fontReadiness.js"

/**
 * Shipped canvas profiles, font-selection policies, cache freshness, and
 * synthetic scenario coverage.
 *
 * @since 0.2.0
 */
export * from "./supportManifest.js"

/**
 * Synthetic canvas scenarios and checked-in regression artifact rendering.
 *
 * @since 0.2.0
 */
export * from "./parity.js"
