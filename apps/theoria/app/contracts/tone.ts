import { Schema } from "effect"

export const CardTone = Schema.Literal("text", "search", "math", "dsp", "digest", "sign", "seal")

export type CardTone = typeof CardTone.Type
