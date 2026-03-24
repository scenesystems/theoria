/**
 * Internal barrel re-exporting the raw `(re, im)` kernel modules
 * used by the public `Complex → Complex` operation surface.
 *
 * @since 0.1.0
 * @category internal
 */
export * as Arithmetic from "./arithmetic.js"
export * as Polar from "./polar.js"
export * as Trigonometric from "./trigonometric.js"
