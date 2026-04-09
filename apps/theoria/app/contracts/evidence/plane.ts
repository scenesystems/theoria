import { Schema } from "effect"

export const EvidencePlaneFilter = Schema.Literal("all", "results", "data", "context")

export type EvidencePlaneFilter = typeof EvidencePlaneFilter.Type

export const EvidencePlaneOrder = Schema.Literal("live", "narrative")

export type EvidencePlaneOrder = typeof EvidencePlaneOrder.Type

export const EvidencePlanePreferences = Schema.Struct({
  filter: EvidencePlaneFilter,
  order: EvidencePlaneOrder,
  sectionKey: Schema.NullOr(Schema.String)
})

export type EvidencePlanePreferences = typeof EvidencePlanePreferences.Type

export const defaultEvidencePlanePreferences: EvidencePlanePreferences = {
  filter: "all",
  order: "narrative",
  sectionKey: null
}
