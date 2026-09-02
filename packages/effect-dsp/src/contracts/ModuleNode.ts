/**
 * Non-generic runtime views used for module discovery and graph projection.
 *
 * @since 0.1.0
 */
import type { HashMap, Ref } from "effect"
import { Schema } from "effect"
import type { ModuleId } from "./ModuleId.js"
import type { ModuleParams } from "./ModuleParams.js"

/**
 * Retains prompt metadata without a signature's generic field schemas.
 *
 * @remarks
 * This projection is suitable for discovery and optimizer inspection. It cannot
 * decode module inputs or outputs.
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleNodeSignature extends Schema.Class<ModuleNodeSignature>("ModuleNodeSignature")({
  /** Task description from the owning signature. */
  description: Schema.String,
  /** Default instruction text derived from the owning signature. */
  instructions: Schema.String
}) {}

/**
 * Exposes the mutable parameter and child ownership surface of one module.
 *
 * @remarks
 * The recursive child map contains live nodes and parameter refs. It is a runtime
 * discovery view rather than a serializable graph value.
 *
 * @since 0.1.0
 * @category models
 */
export type ModuleNode = Readonly<{
  /** Branded identity used as the node's graph key. */
  readonly moduleId: ModuleId
  /** Public module name retained for diagnostics and parameter persistence. */
  readonly name: string
  /** Prompt metadata without input and output schemas. */
  readonly signature: ModuleNodeSignature
  /** Mutable parameter state owned by this node. */
  readonly params: Ref.Ref<ModuleParams>
  /** Immediate child nodes keyed by their branded identities. */
  readonly subModules: HashMap.HashMap<ModuleId, ModuleNode>
}>

/**
 * Retains the supplied live module-node references without copying or validation.
 *
 * @param options - Live node record returned unchanged.
 * @returns The same record by identity.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeModuleNode = (options: ModuleNode): ModuleNode => options

/**
 * Creates prompt metadata for a discovered module node.
 *
 * @param description - Task description from the full signature.
 * @param instructions - Default instruction text from the full signature.
 * @returns A schema-class value containing those strings.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeModuleNodeSignature = (
  description: string,
  instructions: string
): ModuleNodeSignature =>
  new ModuleNodeSignature({
    description,
    instructions
  })
