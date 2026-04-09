import { Schema } from "effect"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const HomeHeroCopy = Schema.Struct({
  title: NonEmptyString,
  body: NonEmptyString
})

export type HomeHeroCopy = typeof HomeHeroCopy.Type

export const homeHeroCopy: HomeHeroCopy = {
  title: "One study system for Effect-native computation, inference, and evidence",
  body:
    "Bring workflows, traces, shared capabilities, and proof surfaces into one integrated environment for inspection, optimization, and delivery."
}
