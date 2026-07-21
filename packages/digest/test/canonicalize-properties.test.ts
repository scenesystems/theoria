/**
 * Generated canonicalize laws for the strict RFC 8785 domain.
 */

import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Exit, FastCheck as fc, Order, Record as Rec, Schema } from "effect"

import { canonicalize } from "../src/canonicalize.js"
import { digest } from "../src/digest.js"
import type { DigestAlgorithm } from "../src/schemas/DigestAlgorithm.js"
import { CanonicalizationError, UnsupportedValue } from "../src/schemas/errors.js"

type ReflectionTrap = "getPrototypeOf" | "getOwnPropertyDescriptor" | "ownKeys"

const wellFormedString = fc.fullUnicodeString({ maxLength: 64 })
const finiteNumber = fc.double({ noNaN: true, noDefaultInfinity: true })
const admittedValue = fc.anything({
  key: wellFormedString,
  values: [fc.constant(null), fc.boolean(), finiteNumber, wellFormedString],
  maxDepth: 5,
  maxKeys: 8,
  withNullPrototype: true
})
const distinctKeys = fc.uniqueArray(wellFormedString, { maxLength: 10 })
const distinctEntries = fc.uniqueArray(fc.tuple(wellFormedString, admittedValue), {
  selector: ([key]) => key,
  maxLength: 10
})
const distinctIntegers = fc.uniqueArray(fc.integer(), { minLength: 2, maxLength: 16 })
const digestAlgorithm = fc.constantFrom<DigestAlgorithm>("blake3-256", "sha256")
const reflectionTraps: ReadonlyArray<ReflectionTrap> = ["ownKeys", "getPrototypeOf", "getOwnPropertyDescriptor"]
const safeSecret = fc.stringMatching(/^[A-Za-z0-9]{1,24}$/)
const JsonString = Schema.parseJson(Schema.String)
const JsonUnknown = Schema.parseJson(Schema.Unknown)

const toRecord = (
  entries: ReadonlyArray<readonly [string, unknown]>
): Record<string, unknown> => Rec.fromEntries(entries)

const nullEntry = (key: string): readonly [string, null] => [key, null]

const throwingReflection = (trap: ReflectionTrap): object => {
  const revoked = Proxy.revocable({}, {})
  revoked.revoke()
  const target = { value: true }

  if (trap === "getPrototypeOf") {
    return new Proxy(target, {
      getPrototypeOf: () => Reflect.getPrototypeOf(revoked.proxy)
    })
  }
  if (trap === "getOwnPropertyDescriptor") {
    return new Proxy(target, {
      getOwnPropertyDescriptor: (_proxied, key) => Reflect.getOwnPropertyDescriptor(revoked.proxy, key)
    })
  }
  return new Proxy(target, {
    ownKeys: () => Reflect.ownKeys(revoked.proxy)
  })
}

describe("canonicalize — generated domain laws", () => {
  it.effect.prop(
    "is invariant to record insertion order",
    [distinctEntries],
    ([entries]) =>
      Effect.gen(function*() {
        const forward = yield* canonicalize(toRecord(entries))
        const reverse = yield* canonicalize(toRecord(Arr.reverse(entries)))

        expect(reverse).toBe(forward)
      }),
    { fastCheck: { numRuns: 200 } }
  )

  it.effect.prop(
    "sorts every generated object key by UTF-16 code units",
    [distinctKeys],
    ([keys]) =>
      Effect.gen(function*() {
        const sorted = Arr.sort(keys, Order.string)
        const encodedKeys = yield* Effect.forEach(sorted, (key) => Schema.encode(JsonString)(key))
        const expected = `{${Arr.map(encodedKeys, (key) => `${key}:null`).join(",")}}`

        expect(yield* canonicalize(toRecord(Arr.map(keys, nullEntry)))).toBe(expected)
      }),
    { fastCheck: { numRuns: 200 } }
  )

  it.effect.prop(
    "is idempotent after Schema JSON decoding",
    [admittedValue],
    ([value]) =>
      Effect.gen(function*() {
        const first = yield* canonicalize(value)
        const decoded = yield* Schema.decodeUnknown(JsonUnknown)(first)
        const second = yield* canonicalize(decoded)

        expect(second).toBe(first)
      }),
    { fastCheck: { numRuns: 200 } }
  )

  it.effect.prop(
    "is total over every generated admitted value",
    [admittedValue],
    ([value]) =>
      Effect.gen(function*() {
        expect(Exit.isSuccess(yield* Effect.exit(canonicalize(value)))).toBe(true)
      }),
    { fastCheck: { numRuns: 200 } }
  )

  it.effect.prop(
    "preserves significant array order",
    [distinctIntegers],
    ([values]) =>
      Effect.gen(function*() {
        const forward = yield* canonicalize(values)
        const reverse = yield* canonicalize(Arr.reverse(values))

        expect(reverse).not.toBe(forward)
      }),
    { fastCheck: { numRuns: 200 } }
  )

  it.effect.prop(
    "emits the algorithm-tagged 256-bit digest grammar",
    [digestAlgorithm, admittedValue],
    ([algorithm, value]) =>
      Effect.gen(function*() {
        const tagged = yield* digest(algorithm, value)

        expect(tagged).toMatch(new RegExp(`^${algorithm}:[A-Za-z0-9_-]{43}$`))
      }),
    { fastCheck: { numRuns: 200 } }
  )
})

describe("canonicalize — bounded hostile diagnostics", () => {
  it.effect.prop(
    "never serializes secret values, keys, or symbol descriptions",
    [safeSecret, fc.boolean()],
    ([token, injectHigh]) => {
      const secret = `SECRET_${token}_END`
      const malformed = `${secret}${injectHigh ? "\uD800" : "\uDC00"}`
      const symbolKey = Object.defineProperty({}, Symbol(secret), { value: true, enumerable: true })
      const cyclic: Record<string, unknown> = { value: secret }
      Object.defineProperty(cyclic, "cycle", { value: cyclic, enumerable: true })
      const inputs: ReadonlyArray<unknown> = [
        malformed,
        { [malformed]: true },
        Symbol(secret),
        symbolKey,
        cyclic
      ]

      return Effect.asVoid(
        Effect.forEach(inputs, (input) =>
          Effect.gen(function*() {
            const error = yield* Effect.flip(canonicalize(input))
            const encoded = yield* Schema.encode(CanonicalizationError)(error)
            const decoded = yield* Schema.decodeUnknown(CanonicalizationError)(encoded)
            const diagnostic = yield* Schema.encode(JsonUnknown)(encoded)

            expect(decoded).toStrictEqual(error)
            expect(diagnostic).not.toContain(secret)
            expect(diagnostic.length).toBeLessThanOrEqual(128)
          }))
      )
    },
    { fastCheck: { numRuns: 100 } }
  )

  it.effect.each(reflectionTraps)(
    "closes a throwing %s Proxy trap to reflection-failure",
    (trap) =>
      Effect.gen(function*() {
        const exit = yield* Effect.exit(canonicalize(throwingReflection(trap)))

        expect(exit).toStrictEqual(
          Exit.fail(new UnsupportedValue({ reason: "reflection-failure" }))
        )
      })
  )
})
