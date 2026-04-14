import fixtureJson from "../fixtures/parallel/concurrency.basic.json" with { type: "json" }

import { Array as Arr, Option, Schema } from "effect"

const ParallelBranchFixtureSchema = Schema.Struct({
  question: Schema.String,
  answer: Schema.String,
  yieldCount: Schema.Number
})

export const ParallelConcurrencyFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("effect-dsp.parallel.concurrency.basic"),
  payload: Schema.Struct({
    concurrency: Schema.Number,
    failurePolicy: Schema.Literal("fail-fast", "collect-all"),
    branches: Schema.NonEmptyArray(ParallelBranchFixtureSchema),
    expectedOutputAnswers: Schema.Array(Schema.String),
    expectedMaxConcurrency: Schema.Number,
    expectedCallCount: Schema.Number,
    expectedCachedCount: Schema.Number
  })
})

export type ParallelConcurrencyFixture = Schema.Schema.Type<typeof ParallelConcurrencyFixtureSchema>

export const loadParallelConcurrencyFixture = Schema.decodeUnknown(ParallelConcurrencyFixtureSchema)(fixtureJson)

export const branchForPrompt = (
  fixture: ParallelConcurrencyFixture,
  prompt: string
) => {
  const fallbackBranch = fixture.payload.branches[0]

  return Arr.findFirst(fixture.payload.branches, (branch) => prompt.includes(branch.question)).pipe(
    Option.getOrElse(() => fallbackBranch)
  )
}
