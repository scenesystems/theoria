import { Array as Arr, Option } from "effect"

export const ML_DSA_65_PUBLIC_KEY_BYTES = 1_952
export const ML_DSA_65_SECRET_KEY_BYTES = 4_032
export const ML_DSA_65_SIGNATURE_BYTES = 3_309
export const ML_DSA_65_ENTROPY_BYTES = 32

const HINT_OFFSET = 3_248
const HINT_INDEX_BYTES = 55
const HINT_ENDPOINT_OFFSET = HINT_OFFSET + HINT_INDEX_BYTES
const HINT_ENDPOINT_BYTES = 6

/**
 * True when the ML-DSA-65 hint block is malformed: an endpoint out of range or
 * decreasing, a segment whose indices are not strictly increasing, or non-zero
 * padding. A signature that does not carry all six endpoint bytes is malformed
 * too; a partial endpoint block is never inspected.
 */
export const hasInvalidMlDsa65HintEncoding = (signature: Uint8Array): boolean => {
  const endpoints = Arr.fromIterable(
    signature.subarray(HINT_ENDPOINT_OFFSET, HINT_ENDPOINT_OFFSET + HINT_ENDPOINT_BYTES)
  )
  return endpoints.length !== HINT_ENDPOINT_BYTES || Option.match(Arr.last(endpoints), {
    onNone: () => true,
    onSome: (lastEndpoint) => {
      // Each hint segment runs from the previous endpoint (0 for the first) to its own endpoint.
      const segments = Arr.zip([0, ...Arr.dropRight(endpoints, 1)], endpoints)
      const invalidEndpoint = segments.some(([start, endpoint]) => endpoint > HINT_INDEX_BYTES || endpoint < start)
      const invalidSegment = segments.some(([start, endpoint]) => {
        const segment = Arr.fromIterable(signature.subarray(HINT_OFFSET + start, HINT_OFFSET + endpoint))
        return Arr.zip(segment, Arr.drop(segment, 1)).some(([previous, next]) => next <= previous)
      })
      const invalidPadding = Arr.fromIterable(signature.subarray(HINT_OFFSET + lastEndpoint, HINT_ENDPOINT_OFFSET))
        .some((value) => value !== 0)
      return invalidEndpoint || invalidSegment || invalidPadding
    }
  })
}
