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
  executableProgramFile(new URL("../../../contracts/demo/text.ts", import.meta.url).href),
  executableProgramFile(new URL("../../../web/atoms/animation.ts", import.meta.url).href)
]).pipe(
  Effect.map(([serverFile, contractFile, animationFile]) => multiFileProgram([serverFile, contractFile, animationFile]))
)
