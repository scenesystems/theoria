/**
 * Minimal single-integer slot scenario for testing search space mechanics.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import * as SearchSpace from "../../SearchSpace/index.js"

/**
 * @since 0.1.0
 * @category schemas
 */
export const SlotConfigSchema = Schema.Struct({
  slot: Schema.Int
})

/**
 * @since 0.1.0
 * @category type-level
 */
export type SlotConfig = Schema.Schema.Type<typeof SlotConfigSchema>

/**
 * @since 0.1.0
 * @category utils
 */
export const decodeSlotConfig = Schema.decodeUnknownSync(SlotConfigSchema)

/**
 * Scenario-owned constructor for the single-integer slot search space.
 *
 * @since 0.1.0
 * @category constructors
 */
export const SlotSpace = {
  make: (maxSlot: number) =>
    SearchSpace.unsafeMake({
      slot: SearchSpace.int(0, maxSlot)
    })
}
