/**
 * Defines the schemas that keep requested model intent, resolved route
 * provenance, provider metadata, and post-execution evidence separate.
 *
 * @remarks
 * Decode these contracts at configuration and persistence boundaries. Use the
 * `Runtime` module to construct and resolve descriptors and to assemble
 * runtime evidence after execution.
 *
 * @since 0.1.0
 */

/** @since 0.1.0 */
export * from "./RouteFamily.js"
/** @since 0.1.0 */
export * from "./ServeMode.js"
/** @since 0.1.0 */
export * from "./AuthMethod.js"
/** @since 0.1.0 */
export * from "./RouteSelectionPolicy.js"
/** @since 0.1.0 */
export * from "./RuntimeFlavor.js"
/** @since 0.1.0 */
export * from "./ModelArtifact.js"
/** @since 0.1.0 */
export * from "./ExecutionRoute.js"
/** @since 0.1.0 */
export * from "./RuntimeCapabilities.js"
/** @since 0.1.0 */
export * from "./CapabilityRequirements.js"
/** @since 0.1.0 */
export * from "./DesiredRuntimeDescriptor.js"
/** @since 0.1.0 */
export * from "./ResolvedRouteDescriptor.js"
/** @since 0.1.0 */
export * from "./NormalizedUsage.js"
/** @since 0.1.0 */
export * from "./ProviderMetadata.js"
/** @since 0.1.0 */
export * from "./ResolvedRuntimeDescriptor.js"
/** @since 0.1.0 */
export * from "./RuntimeEvidence.js"
