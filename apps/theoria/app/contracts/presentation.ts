import { Schema } from "effect"

export const SurfaceVariant = Schema.Literals(["compact", "expanded"])

export type SurfaceVariant = typeof SurfaceVariant.Type
