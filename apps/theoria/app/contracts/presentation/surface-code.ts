import { Schema } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import { type Program, ProgramSourceScope, SourceFileTab, SourceWorkspaceTab, type SurfaceVariant } from "./program.js"

const compactCodeLineLimit = 14
const fallbackProgram: Program = {
  files: [{ language: "ts", entry: "pending", name: "pending", source: "// Program preview not loaded yet." }]
}

export type SurfaceCodePresentationInput = {
  readonly preparedProgram: Program | null
  readonly runProgram: Program | null
  readonly selectedFileIndex: number
  readonly selectedSourceScope: typeof ProgramSourceScope.Type
  readonly variant: SurfaceVariant
}

type ResolvedSurfaceCodeProgram = {
  readonly originHint: string
  readonly originLabel: string
  readonly program: Program
  readonly scope: typeof ProgramSourceScope.Type
}

const resolvedProgram = ({
  originHint,
  originLabel,
  program,
  scope
}: ResolvedSurfaceCodeProgram): ResolvedSurfaceCodeProgram => ({
  originHint,
  originLabel,
  program,
  scope
})

const loadingCodeProgram: ResolvedSurfaceCodeProgram = resolvedProgram({
  originHint: "Prepared source is still loading.",
  originLabel: "Preparing",
  program: fallbackProgram,
  scope: "prepared"
})

const selectedProgramFileIndex = (program: Program, fileIndex: number): number =>
  fileIndex >= 0 && fileIndex < program.files.length ? fileIndex : 0

const selectedFile = (program: Program, fileIndex: number) => program.files[fileIndex] ?? program.files[0]

const programsMatch = (left: Program, right: Program): boolean =>
  left.files.length === right.files.length && Arr.every(left.files, (file, index) => {
    const other = right.files[index]

    return Option.fromNullable(other).pipe(
      Option.match({
        onNone: () => false,
        onSome: (resolved) =>
          resolved.entry === file.entry
          && resolved.name === file.name
          && resolved.source === file.source
          && resolved.language === file.language
      })
    )
  })

const availablePrograms = (
  { preparedProgram, runProgram }: SurfaceCodePresentationInput
): ReadonlyArray<ResolvedSurfaceCodeProgram> => {
  const run = Option.fromNullable(runProgram).pipe(
    Option.map((program) =>
      resolvedProgram({
        originHint: "This workspace is the exact source attached to the current or last run session.",
        originLabel: "Run Session",
        program,
        scope: "run"
      })
    )
  )
  const prepared = Option.fromNullable(preparedProgram).pipe(
    Option.map((program) =>
      resolvedProgram({
        originHint: "Prepared workspace files stay available before and after execution.",
        originLabel: "Prepared",
        program,
        scope: "prepared"
      })
    )
  )
  const uniquePrepared = Option.all({ prepared, run }).pipe(
    Option.match({
      onNone: () => prepared,
      onSome: ({ prepared, run }) =>
        programsMatch(prepared.program, run.program) ? Option.none() : Option.some(prepared)
    })
  )

  return Arr.filterMap([run, uniquePrepared], (candidate) => candidate)
}

const resolvedCodeProgram = (input: SurfaceCodePresentationInput): ResolvedSurfaceCodeProgram => {
  const programs = availablePrograms(input)
  const selected = Arr.findFirst(programs, (program) => program.scope === input.selectedSourceScope).pipe(
    Option.orElse(() => Arr.head(programs))
  )

  return Option.getOrElse(selected, () => loadingCodeProgram)
}

const sourceWorkspaceTabs = (
  programs: ReadonlyArray<ResolvedSurfaceCodeProgram>
): ReadonlyArray<typeof SourceWorkspaceTab.Type> =>
  programs.length === 0
    ? [{ label: loadingCodeProgram.originLabel, scope: loadingCodeProgram.scope }]
    : Arr.map(programs, (program) => ({ label: program.originLabel, scope: program.scope }))

const directoryForEntry = (entry: string): string => {
  const segments = entry.split("/")
  const directory = segments.slice(0, -1).join("/")

  return directory.length === 0 ? "workspace" : directory
}

const programFileTabs = (program: Program): ReadonlyArray<typeof SourceFileTab.Type> =>
  Arr.map(program.files, (file, index) => ({
    directory: directoryForEntry(file.entry),
    entry: file.entry,
    index,
    name: file.name
  }))

export class SurfaceCodeModel extends Schema.Class<SurfaceCodeModel>("SurfaceCodeModel")({
  entry: Schema.String,
  fileName: Schema.String,
  selectedSourceScope: ProgramSourceScope,
  sourceTabs: Schema.Array(SourceWorkspaceTab),
  source: Schema.String,
  lineCount: Schema.Number,
  truncated: Schema.Boolean,
  hint: Schema.String,
  originHint: Schema.String,
  originLabel: Schema.String,
  fileTabs: Schema.Array(SourceFileTab),
  selectedFileIndex: Schema.Number
}) {
  static project(input: SurfaceCodePresentationInput): SurfaceCodeModel {
    const workspaces = availablePrograms(input)
    const resolved = resolvedCodeProgram(input)
    const selectedFileIndex = selectedProgramFileIndex(resolved.program, input.selectedFileIndex)
    const file = selectedFile(resolved.program, selectedFileIndex)
    const source = file.source.length === 0 ? "Program preview not loaded yet." : file.source
    const lines = source.split("\n")
    const lineCount = lines.length
    const compact = input.variant === "compact"
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

    return SurfaceCodeModel.make({
      entry: file.entry.length === 0 ? "Awaiting preload" : file.entry,
      fileName: file.name,
      selectedSourceScope: resolved.scope,
      sourceTabs: sourceWorkspaceTabs(workspaces),
      source: preview.source,
      lineCount,
      truncated: preview.truncated,
      hint: preview.truncated
        ? `Showing first ${compactCodeLineLimit} of ${lineCount} ${lineLabel}.`
        : "Scroll to inspect the full source workspace.",
      originHint: resolved.originHint,
      originLabel: resolved.originLabel,
      fileTabs: programFileTabs(resolved.program),
      selectedFileIndex
    })
  }
}
