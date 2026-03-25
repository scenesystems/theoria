import { expect } from "@effect/vitest"
import { Array as Arr, Option } from "effect"

const firstDifferenceIndex = (expected: string, actual: string): Option.Option<number> => {
  const sharedLength = Math.min(expected.length, actual.length)
  const sharedDifference = sharedLength === 0
    ? Option.none<number>()
    : Arr.findFirst(Arr.range(0, sharedLength - 1), (index) => expected[index] !== actual[index])

  return Option.orElse(
    sharedDifference,
    () => expected.length === actual.length ? Option.none<number>() : Option.some(sharedLength)
  )
}

const charAt = (value: string, index: Option.Option<number>): string =>
  Option.match(index, {
    onNone: () => "<none>",
    onSome: (i) => i < value.length ? `'${value[i]}'` : "<end>"
  })

const formatDiagnostics = (
  fixtureId: string,
  algorithm: string,
  sourceId: string,
  sourceUrl: string,
  fixturePath: string,
  expected: string,
  actual: string
): string => {
  const index = firstDifferenceIndex(expected, actual)
  const indexLabel = Option.match(index, {
    onNone: () => "none",
    onSome: (i) => `${i}`
  })

  return [
    "Digest conformance mismatch",
    `fixture: ${fixtureId}`,
    `algorithm: ${algorithm}`,
    `source: ${sourceId}`,
    `origin: ${sourceUrl}`,
    `fixturePath: ${fixturePath}`,
    `firstDifferenceIndex: ${indexLabel}`,
    `expectedChar: ${charAt(expected, index)}`,
    `actualChar: ${charAt(actual, index)}`
  ].join("\n")
}

export const expectStringMatch = (
  fixtureId: string,
  algorithm: string,
  sourceId: string,
  sourceUrl: string,
  fixturePath: string,
  actual: string,
  expected: string
): void =>
  expect(actual, formatDiagnostics(fixtureId, algorithm, sourceId, sourceUrl, fixturePath, expected, actual)).toBe(
    expected
  )
