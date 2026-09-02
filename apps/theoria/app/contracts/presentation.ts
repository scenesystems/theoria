import { Schema } from "effect"

export const SurfaceVariant = Schema.Literal("compact", "expanded")

export type SurfaceVariant = typeof SurfaceVariant.Type
