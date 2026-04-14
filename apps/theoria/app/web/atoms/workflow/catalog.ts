import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import { publishedWorkflowCatalogEntries } from "../../../contracts/study/workflow/catalog-policy.js"
import { mergeWorkflowCatalogEntries, type WorkflowCatalogEntry } from "../../../contracts/study/workflow/catalog.js"

import { importedCatalogAtom } from "./open-agent-trace.js"

export const workflowCatalogAtom: AtomType.Atom<ReadonlyArray<WorkflowCatalogEntry>> = Atom.make(
  (get: AtomType.Context) =>
    mergeWorkflowCatalogEntries({
      catalog: publishedWorkflowCatalogEntries,
      importedRegistry: get(importedCatalogAtom).registry
    })
)
