/**
 * Non-generic projection of a module instance, used by graph traversal
 * and optimizer discovery to inspect the module tree without generic
 * type parameters.
 *
 * @since 0.1.0
 */
import type { HashMap, Ref } from "effect"
import { Schema } from "effect"
import type { ModuleId } from "./ModuleId.js"
import type { ModuleParams } from "./ModuleParams.js"

/**
 * Stripped-down signature view stored on graph nodes — carries only the
 * human-readable `description` and the derived `instructions` text, without
 * the full generic Schema fields. Sufficient for optimizer introspection and
 * prompt rendering.
 *
 * @see {@link Signature} — the full generic signature model
 * @see {@link ModuleNode} — the graph node that carries this projection
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleNodeSignature extends Schema.Class<ModuleNodeSignature>("ModuleNodeSignature")({
  description: Schema.String,
  instructions: Schema.String
}) {}

/**
 * Runtime projection of one node in the module composition tree. Provides
 * identity, signature summary, mutable parameters, and a recursive map of
 * child sub-modules. The optimizer walks this tree to discover all
 * learnable parameter surfaces.
 *
 * @see {@link ModuleId} — the branded identity key
 * @see {@link ModuleParams} — the mutable parameter state behind the Ref
 * @see {@link ModuleGraph} — the serializable graph built from ModuleNode trees
 *
 * @since 0.1.0
 * @category models
 */
export type ModuleNode = Readonly<{
  readonly moduleId: ModuleId
  readonly name: string
  readonly signature: ModuleNodeSignature
  readonly params: Ref.Ref<ModuleParams>
  readonly subModules: HashMap.HashMap<ModuleId, ModuleNode>
}>
