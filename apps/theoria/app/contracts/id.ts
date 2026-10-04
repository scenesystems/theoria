import { Schema } from "effect"

export const Id = Schema.String.pipe(Schema.check(Schema.isMinLength(1)))

export type Id = typeof Id.Type
