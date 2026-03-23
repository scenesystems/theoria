/**
 * SLH-DSA (Stateless Hash-Based Digital Signature Algorithm) post-quantum signatures.
 *
 * Conservative post-quantum signature algorithm standardized as
 * FIPS-205 (formerly known as SPHINCS+). Hash-based construction
 * — security relies only on hash function properties, not lattice
 * assumptions. The most conservative post-quantum choice.
 *
 * Wraps `@noble/post-quantum/slh-dsa` — audited, zero-dependency.
 * Merkle-tree based with FORS (Forest of Random Subsets) few-time
 * signature scheme.
 *
 * Parameter sets (f = fast verification, s = small signatures):
 * - **SLH-DSA-SHA2-128f**: 32B pk, 64B sk, 17088B sig (NIST Level 1)
 * - **SLH-DSA-SHA2-128s**: 32B pk, 64B sk, 7856B sig (NIST Level 1)
 * - **SLH-DSA-SHA2-192f**: 48B pk, 96B sk, 35664B sig (NIST Level 3)
 * - **SLH-DSA-SHA2-256f**: 64B pk, 128B sk, 49856B sig (NIST Level 5)
 *
 * Signatures are significantly larger than ML-DSA (~17KB vs ~3.3KB
 * for Level 1/3), but security assumptions are more conservative —
 * hash functions are better understood than lattice problems.
 *
 * Use SLH-DSA when:
 * - Maximum conservatism is required (hash-only security assumption)
 * - Content must remain verifiable for decades
 * - Signature size is not a critical constraint
 *
 * Security property: EUF-CMA under hash function security (PRF, SPR).
 * Stateless — no counter or state management required.
 *
 * @see {@link mlDsa} — alternative post-quantum (lattice-based, smaller sigs)
 * @see {@link hybrid} — classical + post-quantum hybrid for transition
 *
 * @since 0.1.0
 * @category algorithms
 */
