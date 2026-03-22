/**
 * Input validation for digest operations.
 *
 * Guards against non-finite numbers, BigInt, Symbol, undefined,
 * and other values that cannot participate in deterministic
 * canonicalization. Used by both the core and schema layers.
 *
 * @internal
 */
