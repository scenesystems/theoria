/**
 * BLAKE3 multi-mode algorithm contract tests.
 *
 * ### Default hash mode (`blake3Hash`)
 * - Deterministic output for identical inputs
 * - 32-byte Uint8Array output shape
 * - Known test vector correctness (BLAKE3 reference)
 * - Empty input handling
 * - UTF-8 encoding consistency
 *
 * ### Keyed MAC mode (`blake3Mac`)
 * - 32-byte key requirement enforced (rejects shorter/longer keys)
 * - Different keys produce different MACs for same message
 * - Same key + same message is deterministic
 * - Output is 32 bytes regardless of message length
 * - Key material is not recoverable from MAC output
 *
 * ### Derive key mode (`blake3DeriveKey`)
 * - Context string provides domain separation: different contexts
 *   produce different derived keys for identical input
 * - Deterministic: same context + same input always produces
 *   same derived key
 * - Custom dkLen produces output of exactly that length
 * - Default dkLen is 32 bytes
 * - Context is ASCII (Noble enforces this)
 * - Empty input produces valid derived key
 * - Replaces salt concatenation: `blake3DeriveKey("domain", x)`
 *   is collision-resistant where `hash(domain + ":" + x)` is not
 */
