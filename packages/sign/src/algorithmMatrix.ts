/**
 * Canonical support matrix for the released algorithm surface.
 *
 * This file is the package-owned governance authority for algorithm names,
 * family classification, standards references, and release status. Schema
 * literals, dispatch surfaces, README tables, and governance tests all consume
 * this matrix instead of re-inventing the support story ad hoc.
 *
 * @since 0.2.0
 * @category algorithms
 */
import { Data } from "effect"

class AlgorithmSupportDescriptor extends Data.Class<{
  readonly algorithm: string
  readonly family: "signature" | "agreement" | "kem"
  readonly algorithmClass: "classical" | "post-quantum" | "hybrid"
  readonly standard: string
  readonly releaseStatus: "stable"
}> {}

/**
 * Released signature algorithms and their standards authority.
 *
 * @since 0.2.0
 * @category algorithms
 */
export const SignatureSupportMatrix: ReadonlyArray<AlgorithmSupportDescriptor> = [
  new AlgorithmSupportDescriptor({
    algorithm: "ed25519",
    family: "signature",
    algorithmClass: "classical",
    standard: "RFC 8032",
    releaseStatus: "stable"
  }),
  new AlgorithmSupportDescriptor({
    algorithm: "secp256k1-ecdsa",
    family: "signature",
    algorithmClass: "classical",
    standard: "RFC 6979",
    releaseStatus: "stable"
  }),
  new AlgorithmSupportDescriptor({
    algorithm: "secp256k1-schnorr",
    family: "signature",
    algorithmClass: "classical",
    standard: "BIP-340",
    releaseStatus: "stable"
  }),
  new AlgorithmSupportDescriptor({
    algorithm: "ml-dsa-44",
    family: "signature",
    algorithmClass: "post-quantum",
    standard: "FIPS 204",
    releaseStatus: "stable"
  }),
  new AlgorithmSupportDescriptor({
    algorithm: "ml-dsa-65",
    family: "signature",
    algorithmClass: "post-quantum",
    standard: "FIPS 204",
    releaseStatus: "stable"
  }),
  new AlgorithmSupportDescriptor({
    algorithm: "ml-dsa-87",
    family: "signature",
    algorithmClass: "post-quantum",
    standard: "FIPS 204",
    releaseStatus: "stable"
  }),
  new AlgorithmSupportDescriptor({
    algorithm: "slh-dsa-sha2-128f",
    family: "signature",
    algorithmClass: "post-quantum",
    standard: "FIPS 205",
    releaseStatus: "stable"
  }),
  new AlgorithmSupportDescriptor({
    algorithm: "slh-dsa-sha2-128s",
    family: "signature",
    algorithmClass: "post-quantum",
    standard: "FIPS 205",
    releaseStatus: "stable"
  }),
  new AlgorithmSupportDescriptor({
    algorithm: "slh-dsa-sha2-192f",
    family: "signature",
    algorithmClass: "post-quantum",
    standard: "FIPS 205",
    releaseStatus: "stable"
  }),
  new AlgorithmSupportDescriptor({
    algorithm: "slh-dsa-sha2-256f",
    family: "signature",
    algorithmClass: "post-quantum",
    standard: "FIPS 205",
    releaseStatus: "stable"
  })
]

/**
 * Released agreement algorithms and their standards authority.
 *
 * @since 0.2.0
 * @category algorithms
 */
export const AgreementSupportMatrix: ReadonlyArray<AlgorithmSupportDescriptor> = [
  new AlgorithmSupportDescriptor({
    algorithm: "x25519",
    family: "agreement",
    algorithmClass: "classical",
    standard: "RFC 7748",
    releaseStatus: "stable"
  })
]

/**
 * Released KEM algorithms and their standards authority.
 *
 * @since 0.2.0
 * @category algorithms
 */
export const KemSupportMatrix: ReadonlyArray<AlgorithmSupportDescriptor> = [
  new AlgorithmSupportDescriptor({
    algorithm: "xwing",
    family: "kem",
    algorithmClass: "hybrid",
    standard: "X-Wing / CFRG hybrid KEM",
    releaseStatus: "stable"
  })
]

/**
 * The full released algorithm story across signature, agreement, and KEM.
 *
 * @since 0.2.0
 * @category algorithms
 */
export const AlgorithmSupportMatrix = [
  ...SignatureSupportMatrix,
  ...AgreementSupportMatrix,
  ...KemSupportMatrix
]
