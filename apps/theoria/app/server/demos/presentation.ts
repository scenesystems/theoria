import type { Program, ProgramFile } from "../../contracts/presentation.js"

const basenameOf = (entry: string): string => {
  const lastSlash = entry.lastIndexOf("/")

  return lastSlash === -1 ? entry : entry.slice(lastSlash + 1)
}

export const programFile = (entry: string, source: string): ProgramFile => ({
  language: "ts",
  entry,
  name: basenameOf(entry),
  source
})

export const program = (entry: string, source: string): Program => ({
  files: [programFile(entry, source)]
})

export const multiFileProgram = (files: readonly [ProgramFile, ...ReadonlyArray<ProgramFile>]): Program => ({
  files
})
