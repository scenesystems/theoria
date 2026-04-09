/**
 * Composition graph failure helpers.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
import { Array as Arr } from "effect"
import type { ModuleId } from "../../contracts/ModuleId.js"
import { CompositionError } from "../../Errors/module.js"

/**
 * Noun-owned composition failure construction for compose graph validation.
 *
 * @since 0.2.0
 * @category constructors
 * @internal
 */
export const ComposeFailure = {
  invalidModuleId: (options: {
    readonly moduleName: string
    readonly owner: string
  }): CompositionError =>
    CompositionError.make({
      message: `Invalid module id '${options.moduleName}' in ${options.owner}`,
      moduleName: options.moduleName
    }),
  rootCollision: (rootId: ModuleId): CompositionError =>
    CompositionError.make({
      message: `Sub-module id '${rootId}' collides with composed module id`,
      moduleName: rootId
    }),
  cycle: (options: {
    readonly stack: ReadonlyArray<ModuleId>
    readonly moduleId: ModuleId
  }): CompositionError =>
    CompositionError.make({
      message: `Composition cycle detected: ${Arr.join(Arr.append(options.stack, options.moduleId), " -> ")}`,
      moduleName: options.moduleId
    }),
  duplicateId: (moduleId: ModuleId): CompositionError =>
    CompositionError.make({
      message: `Multiple module instances share id '${moduleId}' in the same composition graph`,
      moduleName: moduleId
    }),
  declaredIdMismatch: (options: {
    readonly ownerName: string
    readonly declaredId: ModuleId
    readonly actualId: ModuleId
  }): CompositionError =>
    CompositionError.make({
      message:
        `Sub-module '${options.ownerName}' declares child id '${options.declaredId}' but child module resolves to '${options.actualId}'`,
      moduleName: options.ownerName
    })
}
