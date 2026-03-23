/**
 * Module discovery via a canonical FiberRef registry lifecycle.
 *
 * @since 0.0.0
 */

/**
 * Registration models — `ModuleRegistration`, `RegisteredSignature`,
 * and canonicalization helpers.
 *
 * @since 0.0.0
 */
export * from "./model.js"

/**
 * Registry lifecycle — `ModuleRegistryRef`, `register`, `registerRuntime`,
 * and `registrySnapshot`.
 *
 * @since 0.0.0
 */
export * from "./registry.js"

/**
 * Collection combinators — `discoverModules`, `discoverModuleGraph`,
 * and `withDiscoveryScope`.
 *
 * @since 0.0.0
 */
export * from "./collect.js"
