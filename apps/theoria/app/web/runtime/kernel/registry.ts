import * as Arr from "effect/Array"

import { type EntryId, entryIds } from "../../../contracts/entry/id.js"
import type { EntryRuntimeDescriptor } from "./descriptor.js"
import { entryRuntimeDescriptorFor } from "./entry-runtime-descriptor.js"

export const entryRuntimeDescriptors: ReadonlyArray<EntryRuntimeDescriptor> = Arr.map(
  entryIds,
  entryRuntimeDescriptorFor
)

export const dedicatedEntryIds: ReadonlyArray<EntryId> = entryIds
