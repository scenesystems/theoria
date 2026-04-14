import { Schema } from "effect"

export const EvidencePlaneFilter = Schema.Literal("all", "results", "data", "context")

export type EvidencePlaneFilter = typeof EvidencePlaneFilter.Type

export const EvidencePlaneOrder = Schema.Literal("live", "narrative")

export type EvidencePlaneOrder = typeof EvidencePlaneOrder.Type

export class EvidencePlanePreferences extends Schema.Class<EvidencePlanePreferences>("EvidencePlanePreferences")({
  filter: EvidencePlaneFilter,
  order: EvidencePlaneOrder,
  sectionKey: Schema.NullOr(Schema.String)
}) {
  static defaults(): EvidencePlanePreferences {
    return EvidencePlanePreferences.make({
      filter: "all",
      order: "narrative",
      sectionKey: null
    })
  }

  static withFilter(
    preferences: EvidencePlanePreferences,
    filter: EvidencePlaneFilter
  ): EvidencePlanePreferences {
    return EvidencePlanePreferences.make({
      ...preferences,
      filter,
      sectionKey: null
    })
  }

  static withOrder(
    preferences: EvidencePlanePreferences,
    order: EvidencePlaneOrder
  ): EvidencePlanePreferences {
    return EvidencePlanePreferences.make({
      ...preferences,
      order
    })
  }

  static withSectionKey(
    preferences: EvidencePlanePreferences,
    sectionKey: string | null
  ): EvidencePlanePreferences {
    return EvidencePlanePreferences.make({
      ...preferences,
      sectionKey
    })
  }
}
