/** Cooperative, stack-safe RFC 8785 canonical serializer. @internal */

export {
  canonicalizeSegments,
  canonicalizeValue,
  canonicalizeWithByteLimit,
  canonicalizeWithByteLimitEither,
  encodeCanonicalSegments
} from "./jcs-machine.js"
