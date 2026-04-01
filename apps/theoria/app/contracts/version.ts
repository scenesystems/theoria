import { Schema } from "effect"

const NonNegativeNumber = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(0)
)

export const Version = Schema.Struct({
  service: Schema.Literal("theoria"),
  buildSha: Schema.String,
  startedAtMs: NonNegativeNumber
})

export type Version = typeof Version.Type
