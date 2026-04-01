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
  executableProgramFile(new URL("../../../contracts/demo/power.ts", import.meta.url).href),
  executableProgramFile(new URL("../../../web/atoms/power-animation.ts", import.meta.url).href)
]).pipe(
  Effect.map(([serverFile, kernelFile, animationFile]) => multiFileProgram([serverFile, kernelFile, animationFile]))
)
