/** Cooperative, stack-safe RFC 8785 canonical serializer. @internal */

export { encodeCanonicalSegments } from "./jcs-byte-machine.js"
export {
  canonicalizeSegments,
  canonicalizeValue,
  canonicalizeWithByteLimit,
  canonicalizeWithByteLimitEither
} from "./jcs-machine.js"
