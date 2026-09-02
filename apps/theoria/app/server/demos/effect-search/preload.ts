import type { Effect } from "effect"

import type { Program } from "../../../contracts/presentation.js"

import { programForDemo, type ProgramSourceReadError, type ProgramSources } from "../program-sources.js"

export const preloadProgram: Effect.Effect<Program, ProgramSourceReadError, ProgramSources> = programForDemo(
  "effect-search"
)
