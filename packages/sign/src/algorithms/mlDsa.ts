/**
 * ML-DSA (Module-Lattice Digital Signature Algorithm) post-quantum signatures.
 *
 * Post-quantum signature algorithm standardized as FIPS-204 (formerly
 * known as CRYSTALS-Dilithium). Primary post-quantum signature scheme
 * for long-lived content provenance that must survive quantum computing.
 *
 * Wraps `@noble/post-quantum/ml-dsa` — audited, zero-dependency.
 * Lattice-based construction over Module-LWE (Learning with Errors).
 *
 * Three security levels:
 * - **ML-DSA-44** (NIST Level 2): 1312B pk, 2560B sk, 2420B sig
 * - **ML-DSA-65** (NIST Level 3): 1952B pk, 4032B sk, 3309B sig
 * - **ML-DSA-87** (NIST Level 5): 2592B pk, 4896B sk, 4627B sig
 *
 * ML-DSA-65 is recommended for most applications — it provides
 * 192-bit post-quantum security (NIST Level 3) with moderate key
 * and signature sizes.
 *
 * Security property: EUF-CMA under Module-LWE hardness assumption.
 * Deterministic signing (no random nonce). Signatures are larger
 * than classical (~3.3KB vs 64B for Ed25519) — this is the cost
 * of quantum resistance.
 *
 * @see {@link slhDsa} — alternative post-quantum (hash-based, conservative)
 * @see {@link hybrid} — classical + post-quantum hybrid for transition
 * @see {@link ed25519} — classical alternative (faster, smaller, not quantum-safe)
 *
 * @since 0.1.0
 * @category algorithms
 */
