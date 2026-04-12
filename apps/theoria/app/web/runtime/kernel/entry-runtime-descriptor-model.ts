import { Data } from "effect"

import { type AuthorityCatalogDescriptor, authorityCatalogForId } from "../../../contracts/capability/catalog.js"
import type { EntryId } from "../../../contracts/entry/id.js"
import { type AnyEntryDescriptor, EntryRegistry } from "../../../contracts/entry/registry.js"

import type { EntryRuntimeDescriptorProvenance } from "./entry-runtime-provenance.js"
import type { SurfaceRuntime } from "./kind.js"
import type { SurfaceViewExtension } from "./surface-view-extension.js"

const entryRegistry = EntryRegistry.current()

export class EntryRuntimeAuthorityDescriptor extends Data.Class<EntryRuntimeAuthorityDescriptor.Shape> {
  static make(descriptor: EntryRuntimeAuthorityDescriptor.Shape): EntryRuntimeAuthorityDescriptor {
    return new EntryRuntimeAuthorityDescriptor(descriptor)
  }

  static fromCatalog(catalog: AuthorityCatalogDescriptor): EntryRuntimeAuthorityDescriptor {
    return EntryRuntimeAuthorityDescriptor.make({
      authorityId: catalog.authorityId,
      catalog
    })
  }
}

export namespace EntryRuntimeAuthorityDescriptor {
  export interface Shape {
    readonly authorityId: AuthorityCatalogDescriptor["authorityId"]
    readonly catalog: AuthorityCatalogDescriptor
  }
}

export class EntryRuntimeDescriptor extends Data.Class<EntryRuntimeDescriptor.Shape> {
  static make(descriptor: EntryRuntimeDescriptor.Shape): EntryRuntimeDescriptor {
    return new EntryRuntimeDescriptor(descriptor)
  }

  static resolve({
    entryId,
    provenance,
    runtime,
    surface
  }: {
    readonly entryId: EntryId
    readonly provenance: EntryRuntimeDescriptorProvenance
    readonly runtime: SurfaceRuntime
    readonly surface: SurfaceViewExtension
  }): EntryRuntimeDescriptor {
    const entry = entryRegistry.descriptorForId(entryId)

    return EntryRuntimeDescriptor.make({
      entryId: entry.entryId,
      entry,
      authority: EntryRuntimeAuthorityDescriptor.fromCatalog(authorityCatalogForId(entry.primaryAuthorityId)),
      provenance,
      runtime,
      surface
    })
  }
}

export namespace EntryRuntimeDescriptor {
  export interface Shape {
    readonly entryId: EntryId
    readonly entry: AnyEntryDescriptor
    readonly authority: EntryRuntimeAuthorityDescriptor
    readonly provenance: EntryRuntimeDescriptorProvenance
    readonly runtime: SurfaceRuntime
    readonly surface: SurfaceViewExtension
  }
}
