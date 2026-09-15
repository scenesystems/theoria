import { Array as Arr, Boolean as B, Number as N, Option } from "effect"

export const ML_DSA_65_PUBLIC_KEY_BYTES = 1_952
export const ML_DSA_65_SECRET_KEY_BYTES = 4_032
export const ML_DSA_65_SIGNATURE_BYTES = 3_309
export const ML_DSA_65_ENTROPY_BYTES = 32

const HINT_OFFSET = 3_248
const HINT_INDEX_BYTES = 55
const HINT_ENDPOINT_OFFSET = N.sum(HINT_OFFSET, HINT_INDEX_BYTES)
const HINT_ENDPOINT_BYTES = 6

/**
 * True when the ML-DSA-65 hint block is malformed: an endpoint out of range or
 * decreasing, a segment whose indices are not strictly increasing, or non-zero
 * padding. A signature that does not carry all six endpoint bytes is malformed
 * too; a partial endpoint block is never inspected.
 */
export const hasInvalidMlDsa65HintEncoding = (signature: Uint8Array): boolean => {
  const bytes = Arr.fromIterable(signature)
  const endpoints = Arr.take(Arr.drop(bytes, HINT_ENDPOINT_OFFSET), HINT_ENDPOINT_BYTES)
  return B.match(N.Equivalence(Arr.length(endpoints), HINT_ENDPOINT_BYTES), {
    onFalse: () => true,
    onTrue: () =>
      Option.match(Arr.last(endpoints), {
        onNone: () => true,
        onSome: (lastEndpoint) => {
          // Equal endpoints are empty segments; index ordering restarts for each segment.
          const segments = Arr.zip(Arr.prepend(Arr.dropRight(endpoints, 1), 0), endpoints)
          const invalidEndpoint = Arr.some(segments, ([start, endpoint]) =>
            B.or(N.greaterThan(endpoint, HINT_INDEX_BYTES), N.lessThan(endpoint, start)))
          return B.match(invalidEndpoint, {
            onTrue: () =>
              true,
            onFalse: () => {
              const invalidSegment = Arr.some(segments, ([start, endpoint]) => {
                const segment = Arr.take(Arr.drop(bytes, N.sum(HINT_OFFSET, start)), N.subtract(endpoint, start))
                return Arr.some(Arr.zip(segment, Arr.drop(segment, 1)), ([previous, next]) =>
                  N.lessThanOrEqualTo(next, previous))
              })
              const padding = Arr.take(
                Arr.drop(bytes, N.sum(HINT_OFFSET, lastEndpoint)),
                N.subtract(HINT_INDEX_BYTES, lastEndpoint)
              )
              return B.or(
                invalidSegment,
                Arr.some(padding, (value) =>
                  B.not(N.Equivalence(value, 0)))
              )
            }
          })
        }
      })
  })
}
