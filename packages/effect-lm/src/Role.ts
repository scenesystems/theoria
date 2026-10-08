/**
 * Semantic roles used to select model runtimes.
 * @since 0.1.0
 * @module
 */
import { Schema } from "effect"

/** Model invocation role. @since 0.1.0 @category schemas */
export const Role = Schema.Literals(["task", "teacher", "proposer", "evaluator", "critic"])
  .annotate({ identifier: "@scenesystems/effect-lm/Role" })
/** Decoded invocation role. @since 0.1.0 @category models */
export type Role = typeof Role.Type
