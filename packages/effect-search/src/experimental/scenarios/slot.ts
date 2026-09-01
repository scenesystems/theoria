/**
 * Minimal single-integer slot scenario for testing search space mechanics.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import * as SearchSpace from "../../SearchSpace/index.js"

/**
 * Schema for a configuration containing one integer slot.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SlotConfigSchema = Schema.Struct({
  slot: Schema.Int
})

/**
 * Decoded configuration for {@link SlotConfigSchema}.
 *
 * @since 0.1.0
 * @category type-level
 */
export type SlotConfig = Schema.Schema.Type<typeof SlotConfigSchema>

/**
 * Decodes an unknown slot configuration or throws a parse error.
 *
 * @since 0.1.0
 * @category utils
 */
export const decodeSlotConfig = Schema.decodeUnknownSync(SlotConfigSchema)

/**
 * Constructs an integer slot space over the inclusive range `[0, maxSlot]`.
 *
 * @param maxSlot - Inclusive upper bound for generated slots.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeSlotSpace = (maxSlot: number) =>
  SearchSpace.unsafeMake({
    slot: SearchSpace.int(0, maxSlot)
  })
