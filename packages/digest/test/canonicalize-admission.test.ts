import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Data, DateTime, Effect, Equal, Exit, Hash, HashSet, Schema } from "effect"

import { canonicalize } from "../src/canonicalize.js"
import { canonicalJsonBytes } from "../src/convenience.js"
import { CyclicValue, InvalidUnicode, UnsupportedValue } from "../src/schemas/errors.js"

const expectUnsupported = (value: unknown, reason: UnsupportedValue["reason"]): Effect.Effect<void> =>
  Effect.gen(function*() {
    const exit = yield* Effect.exit(canonicalize(value))
    expect(exit).toStrictEqual(Exit.fail(new UnsupportedValue({ reason })))
  })

class UnsupportedInstance {}

const revokedHashTarget = Proxy.revocable({}, {})
revokedHashTarget.revoke()

class ThrowingHashArray extends Array<number> {
  [Hash.symbol](): number {
    return Reflect.ownKeys(revokedHashTarget.proxy).length
  }

  [Equal.symbol](other: unknown): boolean {
    return this === other
  }
}

const unsupportedValueCases: ReadonlyArray<readonly [string, unknown, UnsupportedValue["reason"]]> = [
  ["undefined", undefined, "undefined"],
  ["NaN", Number.NaN, "nan"],
  ["positive infinity", Number.POSITIVE_INFINITY, "non-finite-number"],
  ["negative infinity", Number.NEGATIVE_INFINITY, "non-finite-number"],
  ["bigint", BigInt(1), "bigint"],
  ["function", () => 1, "function"],
  ["symbol", Symbol("value"), "symbol"],
  ["Date", DateTime.toDateUtc(DateTime.unsafeMake("2026-01-01T00:00:00.000Z")), "date"],
  ["RegExp", /value/u, "regexp"],
  ["typed array", new Uint16Array([1]), "typed-array"],
  ["DataView", new DataView(new ArrayBuffer(8)), "typed-array"],
  ["Map", Schema.decodeSync(Schema.Map({ key: Schema.String, value: Schema.Number }))([["value", 1]]), "map"],
  ["Set", Schema.decodeSync(Schema.Set(Schema.Number))([1]), "set"],
  ["class instance", new UnsupportedInstance(), "unsupported-prototype"]
]

describe("canonicalize — exact strict admission", () => {
  it.effect.each(unsupportedValueCases)("rejects %s with %s", ([, value, reason]) => expectUnsupported(value, reason))

  it.effect("neither reads nor traverses hidden array symbol data and preserves exact bytes", () => {
    const plain = [1, "scene", { b: 2, a: true }]
    const symbol = Symbol("metadata")
    const metadata = Proxy.revocable({}, {})
    metadata.revoke()
    const target = [1, "scene", { b: 2, a: true }]
    Object.defineProperty(target, symbol, {
      value: metadata.proxy,
      enumerable: false
    })
    const probe = { reads: 0 }
    const decorated = new Proxy(target, {
      get: (owner, key, receiver) => {
        if (key === symbol) probe.reads += 1
        return Reflect.get(owner, key, receiver)
      }
    })
    return Effect.gen(function*() {
      const plainText = yield* canonicalize(plain)
      const decoratedText = yield* canonicalize(decorated)
      const plainBytes = yield* canonicalJsonBytes(plain)
      const decoratedBytes = yield* canonicalJsonBytes(decorated)

      expect(plainText).toBe("[1,\"scene\",{\"a\":true,\"b\":2}]")
      expect(decoratedText).toBe(plainText)
      expect(decoratedBytes).toStrictEqual(plainBytes)
      expect(probe.reads).toBe(0)
    })
  })

  it.effect("admits an immutable Effect array after its structural hash is cached", () => {
    const value = Data.array([1, "scene", true])
    Hash.hash(value)
    Object.freeze(value)

    return Effect.gen(function*() {
      expect(yield* canonicalize(value)).toBe("[1,\"scene\",true]")
    })
  })

  it.effect("rejects enumerable array symbol data", () =>
    expectUnsupported(
      Object.defineProperty([1], Symbol("metadata"), { value: true, enumerable: true }),
      "symbol-property"
    ))

  it.effect("rejects a hidden array symbol accessor without invoking it", () => {
    const probe = { calls: 0 }
    const value = Object.defineProperty([1], Symbol("metadata"), {
      enumerable: false,
      get: () => {
        probe.calls += 1
        return "secret"
      }
    })
    return Effect.gen(function*() {
      yield* expectUnsupported(value, "accessor-property")
      expect(probe.calls).toBe(0)
    })
  })

  it.effect("rejects an enumerable array symbol accessor without invoking it", () => {
    const probe = { calls: 0 }
    const value = Object.defineProperty([1], Symbol("metadata"), {
      enumerable: true,
      get: () => {
        probe.calls += 1
        return "secret"
      }
    })
    return Effect.gen(function*() {
      yield* expectUnsupported(value, "accessor-property")
      expect(probe.calls).toBe(0)
    })
  })

  it.effect("rejects hidden record symbol data", () =>
    expectUnsupported(
      Object.defineProperty({}, Symbol("metadata"), { value: true, enumerable: false }),
      "symbol-property"
    ))

  it.effect("maps an absent array symbol descriptor to reflection-failure", () => {
    const symbol = Symbol("metadata")
    const value = new Proxy([1], {
      ownKeys: (target) => [...Reflect.ownKeys(target), symbol],
      getOwnPropertyDescriptor: (target, key) =>
        key === symbol ? undefined : Reflect.getOwnPropertyDescriptor(target, key)
    })
    return expectUnsupported(value, "reflection-failure")
  })

  it.effect("maps a throwing array symbol descriptor to reflection-failure", () => {
    const symbol = Symbol("metadata")
    const revoked = Proxy.revocable({}, {})
    revoked.revoke()
    const value = new Proxy([1], {
      ownKeys: (target) => [...Reflect.ownKeys(target), symbol],
      getOwnPropertyDescriptor: (target, key) =>
        key === symbol
          ? Reflect.getOwnPropertyDescriptor(revoked.proxy, key)
          : Reflect.getOwnPropertyDescriptor(target, key)
    })
    return expectUnsupported(value, "reflection-failure")
  })

  it.effect("rejects a symbol own key before other property defects", () => {
    const value = Object.defineProperties({}, {
      [Symbol("secret")]: { value: 1, enumerable: true },
      accessor: { get: () => 1, enumerable: false }
    })
    return expectUnsupported(value, "symbol-property")
  })

  it.effect("rejects a captured symbol before a throwing descriptor trap", () => {
    const symbol = Symbol("first")
    const revoked = Proxy.revocable({}, {})
    revoked.revoke()
    const value = new Proxy({}, {
      ownKeys: () => ["broken", symbol],
      getOwnPropertyDescriptor: () => Reflect.getOwnPropertyDescriptor(revoked.proxy, "broken")
    })
    return expectUnsupported(value, "symbol-property")
  })

  it.effect("rejects an accessor before non-enumerable properties", () => {
    const value = Object.defineProperties({}, {
      accessor: { get: () => 1, enumerable: false },
      hidden: { value: 1, enumerable: false }
    })
    return expectUnsupported(value, "accessor-property")
  })

  it.effect("rejects a non-enumerable record property", () =>
    expectUnsupported(
      Object.defineProperty({}, "hidden", { value: 1, enumerable: false }),
      "non-enumerable-property"
    ))

  it.effect("rejects a non-enumerable array index before holes and extras", () => {
    const value = Object.defineProperties([1, 2], {
      0: { value: 1, enumerable: false },
      extra: { value: true, enumerable: true }
    })
    return expectUnsupported(value, "non-enumerable-property")
  })

  it.effect("rejects a sparse array before an extra string property", () => {
    const value = Object.defineProperty(Arr.allocate<number>(2), "extra", { value: true, enumerable: true })
    Object.defineProperty(value, "0", { value: 1, enumerable: true })
    return expectUnsupported(value, "sparse-array")
  })

  it.effect("rejects a huge sparse array without proportional allocation", () =>
    expectUnsupported(Arr.allocate(2 ** 32 - 1), "sparse-array"))

  it.effect("rejects an array extra property", () =>
    expectUnsupported(
      Object.defineProperty([1], "extra", { value: true, enumerable: true }),
      "array-extra-property"
    ))

  it.effect("treats a non-enumerable numeric key at or above captured length as an array extra", () => {
    const target = [1]
    const value = new Proxy(target, {
      ownKeys: () => ["0", "1", "length"],
      getOwnPropertyDescriptor: (proxied, key) =>
        key === "1"
          ? { configurable: true, enumerable: false, value: 2, writable: true }
          : Reflect.getOwnPropertyDescriptor(proxied, key)
    })
    return expectUnsupported(value, "array-extra-property")
  })

  it.effect("maps throwing reflection to reflection-failure", () => {
    const revoked = Proxy.revocable({}, {})
    revoked.revoke()
    const value = new Proxy(
      Object.defineProperty({}, Symbol("secret"), { value: 1 }),
      { ownKeys: () => Reflect.ownKeys(revoked.proxy) }
    )
    return expectUnsupported(value, "reflection-failure")
  })

  it.effect("maps throwing active-set hashing to reflection-failure", () => {
    const value = ThrowingHashArray.from([1])
    return expectUnsupported(value, "reflection-failure")
  })

  it.effect("keeps first child failure independent of record insertion order", () =>
    Effect.gen(function*() {
      const first = yield* Effect.exit(canonicalize({ z: undefined, a: Number.NaN }))
      const second = yield* Effect.exit(canonicalize({ a: Number.NaN, z: undefined }))
      const expected = Exit.fail(new UnsupportedValue({ reason: "nan" }))
      expect(first).toStrictEqual(expected)
      expect(second).toStrictEqual(expected)
    }))
})

describe("canonicalize — descriptor snapshots", () => {
  it.effect("never invokes record getters", () => {
    const probe = { calls: 0 }
    const value = Object.defineProperty({}, "value", {
      enumerable: true,
      get: () => {
        probe.calls += 1
        return "secret"
      }
    })
    return Effect.gen(function*() {
      yield* expectUnsupported(value, "accessor-property")
      expect(probe.calls).toBe(0)
    })
  })

  it.effect("never invokes array getters", () => {
    const probe = { calls: 0 }
    const value = Object.defineProperty([1], "0", {
      enumerable: true,
      get: () => {
        probe.calls += 1
        return "secret"
      }
    })
    return Effect.gen(function*() {
      yield* expectUnsupported(value, "accessor-property")
      expect(probe.calls).toBe(0)
    })
  })

  it.effect("serializes each descriptor snapshot once during cooperative mutation", () => {
    const target = { value: 1 }
    const probe = { calls: 0 }
    const value = new Proxy(target, {
      getOwnPropertyDescriptor: (proxied, key) => {
        const descriptor = Reflect.getOwnPropertyDescriptor(proxied, key)
        probe.calls += 1
        Reflect.set(proxied, key, 9)
        return descriptor
      }
    })
    return Effect.gen(function*() {
      expect(yield* canonicalize(value)).toBe("{\"value\":1}")
      expect(probe.calls).toBe(1)
    })
  })
})

describe("canonicalize — Unicode and object graph laws", () => {
  it.effect("admits null-prototype records", () => {
    const value: Record<string, unknown> = Object.setPrototypeOf({ b: 2, a: 1 }, null)
    return Effect.gen(function*() {
      expect(yield* canonicalize(value)).toBe("{\"a\":1,\"b\":2}")
    })
  })

  it.effect("rejects malformed nested values", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(canonicalize({ nested: ["ok", "\ud800"] }))
      expect(exit).toStrictEqual(
        Exit.fail(new InvalidUnicode({ kind: "lone-high-surrogate", codeUnitIndex: 0 }))
      )
    }))

  it.effect("rejects malformed object keys", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(canonicalize({ ["a\udc00"]: true }))
      expect(exit).toStrictEqual(
        Exit.fail(new InvalidUnicode({ kind: "lone-low-surrogate", codeUnitIndex: 1 }))
      )
    }))

  it.effect("preserves valid astral strings and keys without normalization", () =>
    Effect.gen(function*() {
      expect(yield* canonicalize("😀é é")).toBe("\"😀é é\"")
      expect(yield* canonicalize({ ["😀"]: "value" })).toBe("{\"😀\":\"value\"}")
    }))

  it.effect("sorts astral keys by UTF-16 code units before higher BMP keys", () =>
    Effect.gen(function*() {
      expect(yield* canonicalize({ ["\ue000"]: "bmp", ["😀"]: "astral" })).toBe(
        "{\"😀\":\"astral\",\"\":\"bmp\"}"
      )
    }))

  it.effect("fails direct and indirect cycles", () =>
    Effect.gen(function*() {
      const direct: Record<string, unknown> = {}
      direct.self = direct
      const first: Record<string, unknown> = {}
      const second: Record<string, unknown> = { first }
      first.second = second

      expect(yield* Effect.exit(canonicalize(direct))).toStrictEqual(Exit.fail(new CyclicValue()))
      expect(yield* Effect.exit(canonicalize(first))).toStrictEqual(Exit.fail(new CyclicValue()))
    }))

  it.effect("admits shared acyclic references", () => {
    const shared = { value: 1 }
    return Effect.gen(function*() {
      expect(yield* canonicalize({ left: shared, right: shared })).toBe(
        "{\"left\":{\"value\":1},\"right\":{\"value\":1}}"
      )
    })
  })

  it.effect("does not confuse structurally equal siblings with cycles", () =>
    Effect.gen(function*() {
      expect(yield* canonicalize({ left: { value: 1 }, right: { value: 1 } })).toBe(
        "{\"left\":{\"value\":1},\"right\":{\"value\":1}}"
      )
    }))

  it.effect("uses identity for ordinary mutable objects in the active set", () =>
    Effect.sync(() => {
      const left = { value: 1 }
      const right = { value: 1 }
      const active = HashSet.make(left)
      expect(HashSet.has(active, left)).toBe(true)
      expect(HashSet.has(active, right)).toBe(false)
    }))
})
