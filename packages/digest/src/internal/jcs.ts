/**
 * RFC 8785 JCS implementation internals.
 *
 * Canonical JSON serialization: deterministic key ordering,
 * ES2015 number formatting, no whitespace. The public surface
 * is `canonicalize.ts` — this module holds the recursive
 * serialization engine.
 *
 * @internal
 */
