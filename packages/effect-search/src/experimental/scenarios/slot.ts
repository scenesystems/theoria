/**
 * Defines a single-integer fixture for search-space tests.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import * as SearchSpace from "../../SearchSpace/index.js"

/**
 * Decodes an integer slot without enforcing the fixture's sampling range.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SlotConfigSchema = Schema.Struct({
  /** Integer slot; standalone decoding does not enforce an upper or lower bound. */
  slot: Schema.Int
})

/**
 * Carries an integer slot without a sampling-range guarantee.
 *
 * @since 0.1.0
 * @category type-level
 */
export type SlotConfig = Schema.Schema.Type<typeof SlotConfigSchema>

/**
 * Decodes an unknown slot configuration and throws on a schema violation.
 *
 * @since 0.1.0
 * @category utils
 */
export const decodeSlotConfig = Schema.decodeUnknownSync(SlotConfigSchema)

/**
 * Builds an integer slot space from `0` through `maxSlot`.
 *
 * @remarks
 * The call defects when `maxSlot` is not a finite, non-negative integer because
 * the fixture uses `SearchSpace.unsafeMake`.
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
