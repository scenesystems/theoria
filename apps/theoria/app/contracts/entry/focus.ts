import type { AuthorityId } from "./id.js"
import type { EntryId } from "./id.js"
import { entryDescriptorForId } from "./registry.js"

export const authorityIdsForEntry = (entryId: EntryId): ReadonlyArray<AuthorityId> =>
  entryDescriptorForId(entryId).authorityIds

export const primaryAuthorityIdForEntry = (entryId: EntryId): AuthorityId =>
  entryDescriptorForId(entryId).primaryAuthorityId
