/**
 * Structural identities for application-owned prepared-text caches.
 *
 * @since 0.5.0
 * @module
 */
import { Data, Number, Schema } from "effect"

import type * as CanvasProfile from "./CanvasProfile.js"
import type * as Text from "./Text.js"

/**
 * Non-negative font-readiness generation.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Revision = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))

/**
 * A font-readiness generation.
 *
 * @since 0.5.0
 * @category models
 */
export type Revision = typeof Revision.Type

/**
 * Initial font-readiness generation.
 *
 * @since 0.5.0
 * @category revisions
 */
export const initialRevision: Revision = 0

/**
 * Advances a font-readiness generation.
 *
 * @since 0.5.0
 * @category revisions
 */
export const nextRevision = (revision: Revision): Revision => Number.increment(revision)

/**
 * Inputs that determine whether a prepared text value can be reused.
 *
 * @since 0.5.0
 * @category models
 */
export class Options extends Data.Class<{
  readonly prepare: Text.Input
  readonly engineProfile: Text.Profile
  readonly supportProfileId: CanvasProfile.Id
  readonly fontReadinessRevision: Revision
}> {}

/**
 * Structural cache identity for one preparation input and its environment.
 *
 * @remarks
 * Equal keys hash alike and can be used directly in `HashMap`. Omitted font
 * weight remains distinct from explicit weight `400`.
 *
 * @since 0.5.0
 * @category models
 */
export class PreparationKey extends Data.Class<Options> {}

/**
 * Captures preparation inputs and generation state as one structural key.
 *
 * @since 0.5.0
 * @category constructors
 */
export const make = (options: Options): PreparationKey =>
  new PreparationKey({
    prepare: Data.struct({ ...options.prepare, font: Data.struct(options.prepare.font) }),
    engineProfile: Data.struct(options.engineProfile),
    supportProfileId: options.supportProfileId,
    fontReadinessRevision: options.fontReadinessRevision
  })

/**
 * Recovers the canonical preparation input represented by a key.
 *
 * @since 0.5.0
 * @category conversions
 */
export const toInput = (key: PreparationKey): Text.Input => ({ ...key.prepare, font: { ...key.prepare.font } })
