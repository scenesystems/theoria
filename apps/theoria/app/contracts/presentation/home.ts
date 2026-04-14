import { Schema } from "effect"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const HomeHeroCopy = Schema.Struct({
  title: NonEmptyString,
  body: NonEmptyString,
  primaryActionLabel: NonEmptyString,
  secondaryActionLabel: NonEmptyString
})

export type HomeHeroCopy = typeof HomeHeroCopy.Type

export const homeFooterSlogan = "Observation that produces knowledge"

export const homeFooterCopyright = "© 2026 Scene Systems"

export const homeHeroCopy: HomeHeroCopy = {
  title: "Turn workflows, traces, and experiments into knowledge",
  body:
    "Theoria is a study workspace for scientific computing and agent systems. Start with a workflow, compare baseline and optimized runs, and inspect the evidence that explains what changed, what improved, and what to try next.",
  primaryActionLabel: "Open Workflow Study",
  secondaryActionLabel: "Explore Packages"
}
