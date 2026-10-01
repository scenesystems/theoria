import { Array as Arr, Boolean as B, Number as N, Option } from "effect"

const hintOffset = 3_248
const hintIndexBytes = 55
const hintEndpointOffset = N.sum(hintOffset, hintIndexBytes)
const hintEndpointBytes = 6

/**
 * True when the ML-DSA-65 hint block is malformed: an endpoint out of range or
 * decreasing, a segment whose indices are not strictly increasing, or non-zero
 * padding. A signature that does not carry all six endpoint bytes is malformed
 * too; a partial endpoint block is never inspected.
 */
export const hasInvalidMlDsa65HintEncoding = (signature: Uint8Array): boolean => {
  const bytes = Arr.fromIterable(signature)
  const endpoints = Arr.take(Arr.drop(bytes, hintEndpointOffset), hintEndpointBytes)
  return B.match(N.Equivalence(Arr.length(endpoints), hintEndpointBytes), {
    onFalse: () => true,
    onTrue: () =>
      Option.match(Arr.last(endpoints), {
        onNone: () => true,
        onSome: (lastEndpoint) => {
          // Equal endpoints are empty segments; index ordering restarts for each segment.
          const segments = Arr.zip(Arr.prepend(Arr.dropRight(endpoints, 1), 0), endpoints)
          const invalidEndpoint = Arr.some(segments, ([start, endpoint]) =>
            B.or(N.greaterThan(endpoint, hintIndexBytes), N.lessThan(endpoint, start)))
          return B.match(invalidEndpoint, {
            onTrue: () =>
              true,
            onFalse: () => {
              const invalidSegment = Arr.some(segments, ([start, endpoint]) => {
                const segment = Arr.take(Arr.drop(bytes, N.sum(hintOffset, start)), N.subtract(endpoint, start))
                return Arr.some(Arr.zip(segment, Arr.drop(segment, 1)), ([previous, next]) =>
                  N.lessThanOrEqualTo(next, previous))
              })
              const padding = Arr.take(
                Arr.drop(bytes, N.sum(hintOffset, lastEndpoint)),
                N.subtract(hintIndexBytes, lastEndpoint)
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
