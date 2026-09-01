/**
 * Typed I/O signatures for modules — Schema IS the signature.
 *
 * @since 0.1.0
 */

/**
 * Attaches field descriptions without changing a schema's decoded, encoded,
 * or context types, allowing prompt rendering to recover caller metadata.
 *
 * @since 0.1.0
 */
export * from "./annotations.js"

/**
 * Validated {@link make} constructor for building Signatures from Schema fields.
 *
 * @since 0.1.0
 */
export * from "./constructors.js"

/**
 * {@link deriveInstruction} — default prompt text from description + fields.
 *
 * @since 0.1.0
 */
export * from "./instructions.js"

/**
 * {@link Signature} model, {@link FieldInfo}, and type-level extractors.
 *
 * @since 0.1.0
 */
export * from "./model.js"
