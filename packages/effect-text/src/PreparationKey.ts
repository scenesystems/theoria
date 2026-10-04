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
export const Revision = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))

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

class FontKey extends Data.Class<Text.Font> {}
class InputKey extends Data.Class<Text.Input> {}
class ProfileKey extends Data.Class<Text.Profile> {}

/**
 * Structural cache identity for one preparation input and its environment.
 *
 * @remarks
 * Equal keys hash alike and can be used directly in `HashMap`. Omitted font
 * weight remains distinct from explicit weight `400`. Construction captures
 * nested inputs with structural `Data.Class` values; callers need not pre-normalize them.
 *
 * @since 0.5.0
 * @category models
 */
export class PreparationKey extends Data.Class<ConstructorParameters<typeof Options>[0]> {
  constructor(options: Options) {
    super({
      prepare: new InputKey({ ...options.prepare, font: new FontKey(options.prepare.font) }),
      engineProfile: new ProfileKey(options.engineProfile),
      supportProfileId: options.supportProfileId,
      fontReadinessRevision: options.fontReadinessRevision
    })
  }
}

/**
 * Recovers the canonical preparation input represented by a key.
 *
 * @since 0.5.0
 * @category conversions
 */
export const toInput = (key: PreparationKey): Text.Input => ({ ...key.prepare, font: { ...key.prepare.font } })
