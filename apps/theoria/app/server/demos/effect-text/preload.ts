import type { FileSystem, Path } from "@effect/platform"
import { Effect } from "effect"

import type { Program } from "../../../contracts/presentation.js"

import { multiFileProgram } from "../presentation.js"
import { executableProgramFile, type ProgramSourceReadError } from "../program-source.js"

export const preloadProgram: Effect.Effect<
  Program,
  ProgramSourceReadError,
  FileSystem.FileSystem | Path.Path
> = Effect.all([
  executableProgramFile(new URL("./run.ts", import.meta.url).href),
  executableProgramFile(new URL("./package-story.ts", import.meta.url).href),
  executableProgramFile(new URL("../../../web/text/browserTextLayout.ts", import.meta.url).href),
  executableProgramFile(new URL("../../../web/view/text/authority.ts", import.meta.url).href),
  executableProgramFile(new URL("../../../web/atoms/text.ts", import.meta.url).href),
  executableProgramFile(new URL("../../../web/atoms/reflow.ts", import.meta.url).href)
]).pipe(
  Effect.map(
    ([runFile, packageStoryFile, browserLayerFile, authorityFile, textAtomFile, reflowAtomFile]) =>
      multiFileProgram([runFile, packageStoryFile, browserLayerFile, authorityFile, textAtomFile, reflowAtomFile])
  )
)
