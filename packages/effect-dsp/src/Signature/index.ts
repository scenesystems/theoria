/**
 * Defines module input and output contracts from Effect Schema field records.
 *
 * @remarks
 * A signature retains the schemas used for runtime decoding and derives field
 * metadata for prompt construction. Field descriptions come from `describe`;
 * missing descriptions remain absent rather than being generated.
 *
 * @since 0.1.0
 */

export * from "./annotations.js"

export * from "./constructors.js"

export * from "./instructions.js"

export * from "./model.js"
