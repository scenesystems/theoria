/**
 * Publishes labels for reserved integration areas that have no public implementation.
 *
 * @remarks
 * This subpath has experimental stability. Its labels may change in a minor
 * package release.
 *
 * @since 0.1.0
 * @module
 */

/**
 * Lists the names currently reserved for experimental integration work.
 *
 * @remarks
 * The exported array is mutable and shared by all importers. Its labels do not
 * correspond to public Schemas or services in this package.
 *
 * @since 0.1.0
 * @category experimental
 */
export const ExperimentalSeams = ["VariantSchema", "Machine", "Persistence"]
