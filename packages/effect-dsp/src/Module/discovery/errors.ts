/**
 * Discovery registry failure helpers.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
import type { ModuleId } from "../../contracts/ModuleId.js"
import { CompositionError } from "../../Errors/module.js"

/**
 * Noun-owned discovery failure construction for registry and graph projection seams.
 *
 * @since 0.2.0
 * @category constructors
 * @internal
 */
export namespace DiscoveryFailure {
  export const invalidModuleId = (moduleName: string): CompositionError =>
    CompositionError.make({
      message: `Invalid module id '${moduleName}' for discovery registration`,
      moduleName
    })
  export const registrationConflict = (moduleId: ModuleId): CompositionError =>
    CompositionError.make({
      message: `Discovery registration conflict for module id '${moduleId}'`,
      moduleName: moduleId
    })
  export const missingRoot = (rootId: ModuleId): CompositionError =>
    CompositionError.make({
      message: `Discovery root '${rootId}' was not observed in registry snapshot`,
      moduleName: rootId
    })
}
