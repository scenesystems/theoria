import { Schema } from "effect"

export const Id = Schema.String.pipe(Schema.minLength(1))

export type Id = typeof Id.Type
