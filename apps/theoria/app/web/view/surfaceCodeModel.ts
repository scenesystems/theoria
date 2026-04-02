import { Match } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import {
  type Program,
  type ProgramSourceScope,
  type SourceFileTab,
  type SourceWorkspaceTab,
  type SurfaceVariant
} from "../../contracts/presentation.js"
import { programFromRunState, type SurfaceState } from "../state/types.js"

import type { SurfaceCodeModel } from "./surfaceModel.js"

const compactCodeLineLimit = 14
const fallbackProgram: Program = {
  files: [{ language: "ts", entry: "pending", name: "pending", source: "// Program preview not loaded yet." }]
}

type ResolvedCodeProgram = {
  readonly scope: ProgramSourceScope
  readonly originHint: string
  readonly originLabel: string
  readonly program: Program
}

const resolvedProgram = ({
  originHint,
  originLabel,
  program,
  scope
}: {
  readonly originHint: string
  readonly originLabel: string
  readonly program: Program
  readonly scope: ProgramSourceScope
}): ResolvedCodeProgram => ({
  originHint,
  originLabel,
  program,
  scope
})

const loadingCodeProgram: ResolvedCodeProgram = resolvedProgram({
  originHint: "Prepared source is still loading.",
  originLabel: "Preparing",
  program: fallbackProgram,
  scope: "prepared"
})

const selectedFile = (program: Program, fileIndex: number) => program.files[fileIndex] ?? program.files[0]
const currentProgram = (state: SurfaceState): Program | null => programFromRunState(state.run)

const selectedProgramFileIndex = (program: Program, fileIndex: number): number =>
  fileIndex >= 0 && fileIndex < program.files.length ? fileIndex : 0

const preparedProgram = (state: SurfaceState): Option.Option<ResolvedCodeProgram> =>
  Match.value(state.preload).pipe(
    Match.tag("PreloadReady", ({ data }) =>
      Option.some(resolvedProgram({
        originHint: "Prepared workspace files stay available before and after execution.",
        originLabel: "Prepared",
        program: data.program,
        scope: "prepared"
      }))),
    Match.orElse(() => Option.none())
  )

const runProgram = (state: SurfaceState): Option.Option<ResolvedCodeProgram> =>
  Option.fromNullable(currentProgram(state)).pipe(
    Option.map((program) =>
      resolvedProgram({
        originHint: "This workspace is the exact source attached to the current or last run session.",
        originLabel: "Run Session",
        program,
        scope: "run"
      })
    )
  )

const programsMatch = (left: Program, right: Program): boolean =>
  left.files.length === right.files.length && Arr.every(left.files, (file, index) => {
    const other = right.files[index]

    return Option.fromNullable(other).pipe(
      Option.match({
        onNone: () => false,
        onSome: (resolved) =>
          resolved.entry === file.entry &&
          resolved.name === file.name &&
          resolved.source === file.source &&
          resolved.language === file.language
      })
    )
  })

const availableCodePrograms = (state: SurfaceState): ReadonlyArray<ResolvedCodeProgram> => {
  const run = runProgram(state)
  const prepared = preparedProgram(state)
  const uniquePrepared = Option.all({ prepared, run }).pipe(
    Option.match({
      onNone: () => prepared,
      onSome: ({ prepared, run }) =>
        programsMatch(prepared.program, run.program) ? Option.none() : Option.some(prepared)
    })
  )

  return Arr.filterMap([run, uniquePrepared], (candidate) => candidate)
}

const resolvedCodeProgram = (state: SurfaceState): ResolvedCodeProgram => {
  const programs = availableCodePrograms(state)
  const selected = Arr.findFirst(programs, (program) => program.scope === state.programSourceScope).pipe(
    Option.orElse(() => Arr.head(programs))
  )

  return Option.getOrElse(selected, () => loadingCodeProgram)
}

const sourceWorkspaceTabs = (programs: ReadonlyArray<ResolvedCodeProgram>): ReadonlyArray<SourceWorkspaceTab> =>
  programs.length === 0
    ? [{ label: loadingCodeProgram.originLabel, scope: loadingCodeProgram.scope }]
    : Arr.map(programs, (program) => ({ label: program.originLabel, scope: program.scope }))

const directoryForEntry = (entry: string): string => {
  const segments = entry.split("/")
  const directory = segments.slice(0, -1).join("/")

  return directory.length === 0 ? "workspace" : directory
}

const programFileTabs = (program: Program): ReadonlyArray<SourceFileTab> =>
  Arr.map(program.files, (file, index) => ({
    directory: directoryForEntry(file.entry),
    entry: file.entry,
    index,
    name: file.name
  }))

export const surfaceCodeModel = (state: SurfaceState, variant: SurfaceVariant): SurfaceCodeModel => {
  const workspaces = availableCodePrograms(state)
  const resolved = resolvedCodeProgram(state)
  const selectedFileIndex = selectedProgramFileIndex(resolved.program, state.programFileIndex)
  const file = selectedFile(resolved.program, selectedFileIndex)
  const source = file.source.length === 0 ? "Program preview not loaded yet." : file.source
  const lines = source.split("\n")
  const lineCount = lines.length
  const compact = variant === "compact"
  const preview = compact
    ? {
      source: Arr.join(Arr.take(lines, compactCodeLineLimit), "\n"),
      truncated: lineCount > compactCodeLineLimit
    }
    : {
      source,
      truncated: false
    }
  const lineLabel = lineCount === 1 ? "line" : "lines"

  return {
    entry: file.entry.length === 0 ? "Awaiting preload" : file.entry,
    fileName: file.name,
    selectedSourceScope: resolved.scope,
    sourceTabs: sourceWorkspaceTabs(workspaces),
    source: preview.source,
    lineCount,
    truncated: preview.truncated,
    hint: preview.truncated
      ? `Showing first ${compactCodeLineLimit} of ${lineCount} ${lineLabel}. Open Deep Dive for full source context.`
      : "Scroll to inspect the full source workspace.",
    originHint: resolved.originHint,
    originLabel: resolved.originLabel,
    fileTabs: programFileTabs(resolved.program),
    selectedFileIndex
  }
}
