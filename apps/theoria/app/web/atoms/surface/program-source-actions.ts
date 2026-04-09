import { Atom } from "@effect-atom/atom"

import type { EntryId } from "../../../contracts/entry/id.js"
import type { ProgramSourceScope } from "../../../contracts/presentation/program.js"

import { modifySurface } from "./internal.js"

type ProgramFileSelection = { readonly id: EntryId; readonly fileIndex: number }

type ProgramSourceScopeSelection = { readonly id: EntryId; readonly scope: ProgramSourceScope }

export const selectProgramFileAtom = Atom.fnSync<ProgramFileSelection>()(
  ({ id, fileIndex }, ctx) => {
    modifySurface(ctx.registry, id, (surface) => ({
      ...surface,
      programFileIndex: fileIndex
    }))
  }
)

export const selectProgramSourceScopeAtom = Atom.fnSync<ProgramSourceScopeSelection>()(
  ({ id, scope }, ctx) => {
    modifySurface(ctx.registry, id, (surface) => ({
      ...surface,
      programSourceScope: scope,
      programFileIndex: 0
    }))
  }
)
