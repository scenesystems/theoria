/**
 * RFC 8785 JCS canonicalization test vectors.
 *
 * Input/expected pairs verified against the RFC specification
 * and cross-checked with JSON.stringify key ordering behavior.
 *
 * @since 0.1.0
 * @category test-helpers
 */

import { Array as Arr } from "effect"

/**
 * Key sorting vectors — RFC 8785 §3.2.2.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const keySortingVectors = {
  /** Reverse-ordered keys → lexicographic sort */
  reverseKeys: {
    input: { z: 1, a: 2 },
    expected: "{\"a\":2,\"z\":1}"
  },
  /** Multi-key object */
  multiKey: {
    input: { c: 3, a: 1, b: 2 },
    expected: "{\"a\":1,\"b\":2,\"c\":3}"
  },
  /** Nested object keys sorted recursively */
  nested: {
    input: { b: { z: 1, a: 2 }, a: 1 },
    expected: "{\"a\":1,\"b\":{\"a\":2,\"z\":1}}"
  },
  /** Unicode keys sorted by UTF-16 code units */
  unicodeKeys: {
    input: { "\u20ac": "euro", "\u0024": "dollar" },
    expected: "{\"$\":\"dollar\",\"\u20ac\":\"euro\"}"
  }
}

/**
 * Value type vectors.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const valueTypeVectors = {
  /** null preserved */
  nullValue: {
    input: null,
    expected: "null"
  },
  /** Empty object */
  emptyObject: {
    input: {},
    expected: "{}"
  },
  /** Empty array */
  emptyArray: {
    input: Arr.empty<unknown>(),
    expected: "[]"
  },
  /** Array order preserved (not sorted) */
  arrayOrder: {
    input: [3, 1, 2],
    expected: "[3,1,2]"
  },
  /** Boolean values */
  booleans: {
    input: { t: true, f: false },
    expected: "{\"f\":false,\"t\":true}"
  },
  /** String value */
  stringValue: {
    input: "hello",
    expected: "\"hello\""
  }
}

/**
 * Number serialization vectors — RFC 8785 §3.2.2.3.
 *
 * ES2015 canonical number representation.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const numberVectors = {
  /** Integer — no decimal point */
  integer: {
    input: 42,
    expected: "42"
  },
  /** Negative integer */
  negativeInteger: {
    input: -17,
    expected: "-17"
  },
  /** Zero */
  zero: {
    input: 0,
    expected: "0"
  },
  /** Fractional — shortest representation */
  fractional: {
    input: 1.5,
    expected: "1.5"
  }
}
