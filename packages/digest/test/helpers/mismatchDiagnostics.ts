import { expect } from "@effect/vitest"
import { Array as Arr, String as Str } from "effect"

/** Includes the independent source when a conformance vector disagrees. */
const field = (label: string, value: string): string => Str.concat(Str.concat(label, ": "), value)

const formatDiagnostics = (
  fixtureId: string,
  algorithm: string,
  sourceId: string,
  sourceLocator: string,
  fixturePath: string
): string =>
  Arr.join(
    Arr.make(
      "Digest conformance mismatch",
      field("fixture", fixtureId),
      field("algorithm", algorithm),
      field("source", sourceId),
      field("origin", sourceLocator),
      field("fixturePath", fixturePath)
    ),
    "\n"
  )

export const expectStringMatch = (
  fixtureId: string,
  algorithm: string,
  sourceId: string,
  sourceLocator: string,
  fixturePath: string,
  actual: string,
  expected: string
): void =>
  expect(actual, formatDiagnostics(fixtureId, algorithm, sourceId, sourceLocator, fixturePath)).toBe(
    expected
  )
