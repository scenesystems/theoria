import { Array as Arr, Option } from "effect"

export const ML_DSA_65_PUBLIC_KEY_BYTES = 1_952
export const ML_DSA_65_SECRET_KEY_BYTES = 4_032
export const ML_DSA_65_SIGNATURE_BYTES = 3_309
export const ML_DSA_65_ENTROPY_BYTES = 32

const HINT_OFFSET = 3_248
const HINT_INDEX_BYTES = 55
const HINT_ENDPOINT_OFFSET = HINT_OFFSET + HINT_INDEX_BYTES
const HINT_ENDPOINT_BYTES = 6

export const hasInvalidMlDsa65HintEncoding = (signature: Uint8Array): boolean => {
  const endpoints = Arr.fromIterable(
    signature.subarray(HINT_ENDPOINT_OFFSET, HINT_ENDPOINT_OFFSET + HINT_ENDPOINT_BYTES)
  )
  // Each hint segment runs from the previous endpoint (0 for the first) to its own endpoint.
  const segments = Arr.zip([0, ...Arr.dropRight(endpoints, 1)], endpoints)
  const invalidEndpoint = segments.some(([start, endpoint]) => endpoint > HINT_INDEX_BYTES || endpoint < start)
  const invalidSegment = segments.some(([start, endpoint]) => {
    const segment = Arr.fromIterable(signature.subarray(HINT_OFFSET + start, HINT_OFFSET + endpoint))
    return Arr.zip(segment, Arr.drop(segment, 1)).some(([previous, next]) => next <= previous)
  })
  const paddingStart = HINT_OFFSET + Option.getOrElse(Arr.last(endpoints), () => 0)
  const invalidPadding = Arr.fromIterable(signature.subarray(paddingStart, HINT_ENDPOINT_OFFSET))
    .some((value) => value !== 0)

  return invalidEndpoint || invalidSegment || invalidPadding
}
