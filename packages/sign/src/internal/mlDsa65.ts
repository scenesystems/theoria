import { Array as Arr } from "effect"

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
  const boundaries = [0, ...endpoints]
  const invalidEndpoint = endpoints.some((endpoint, index) =>
    endpoint > HINT_INDEX_BYTES || endpoint < boundaries[index]!
  )
  const invalidSegment = endpoints.some((endpoint, index) => {
    const start = boundaries[index]!
    return Arr.makeBy(endpoint - start, (offset) => HINT_OFFSET + start + offset)
      .some((position, offset) => offset > 0 && signature[position]! <= signature[position - 1]!)
  })
  const paddingStart = HINT_OFFSET + endpoints[HINT_ENDPOINT_BYTES - 1]!
  const invalidPadding = Arr.fromIterable(signature.subarray(paddingStart, HINT_ENDPOINT_OFFSET))
    .some((value) => value !== 0)

  return invalidEndpoint || invalidSegment || invalidPadding
}
