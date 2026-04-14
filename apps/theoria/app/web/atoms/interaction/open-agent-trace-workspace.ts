import { Atom } from "@effect-atom/atom"

export type InteractionInspectorMode = "selection" | "trace" | "materials"

export const openAgentTraceActiveEntryIdAtom = Atom.make<string | null>(null)

export const openAgentTraceInspectorModeAtom = Atom.make<InteractionInspectorMode>("selection")

export const openAgentTraceSelectedItemIdAtom = Atom.make<string | null>(null)

export const selectOpenAgentTraceEntryAtom = Atom.fnSync<string>()((entryId, context) => {
  context.set(openAgentTraceActiveEntryIdAtom, entryId)
  context.set(openAgentTraceSelectedItemIdAtom, null)
})

export const selectOpenAgentTraceItemAtom = Atom.fnSync<string>()((itemId, context) => {
  context.set(openAgentTraceSelectedItemIdAtom, itemId)
  context.set(openAgentTraceInspectorModeAtom, "selection")
})

export const setOpenAgentTraceInspectorModeAtom = Atom.fnSync<InteractionInspectorMode>()((mode, context) => {
  context.set(openAgentTraceInspectorModeAtom, mode)
})
