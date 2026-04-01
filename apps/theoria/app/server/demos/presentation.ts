import { basename } from "node:path"

import type { Program, ProgramFile } from "../../contracts/presentation.js"

export const programFile = (entry: string, source: string): ProgramFile => ({
  language: "ts",
  entry,
  name: basename(entry),
  source
})

export const program = (entry: string, source: string): Program => ({
  files: [programFile(entry, source)]
})

export const multiFileProgram = (files: readonly [ProgramFile, ...ReadonlyArray<ProgramFile>]): Program => ({
  files
})
