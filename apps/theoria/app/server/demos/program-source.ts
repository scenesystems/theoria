import { readFile } from "node:fs/promises"
import { relative, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { Data, Effect } from "effect"

import type { Program, ProgramFile } from "../../contracts/presentation.js"

import { program, programFile } from "./presentation.js"

const appRootEntryPrefix = "app/"
const demoEntryPrefix = "server/demos/"

class ProgramSourceReadError extends Data.TaggedError("ProgramSourceReadError")<{
  readonly entry: string
  readonly reason: string
}> {}

const fileUrlFor = (moduleUrl: string, baseUrl: string | URL = import.meta.url): URL => {
  const resolvedUrl = new URL(moduleUrl, baseUrl)

  if (resolvedUrl.protocol === "file:") {
    return resolvedUrl
  }

  const pathname = resolvedUrl.pathname.startsWith("/@fs/")
    ? resolvedUrl.pathname.slice(4)
    : resolvedUrl.pathname

  return pathToFileURL(decodeURIComponent(pathname))
}

const packageRootUrl = fileUrlFor("../../../", import.meta.url)

const resolvedModuleUrl = (moduleUrl: string): URL => {
  const resolvedUrl = new URL(moduleUrl, packageRootUrl)

  if (resolvedUrl.protocol === "file:") {
    return resolvedUrl
  }

  const pathname = resolvedUrl.pathname.startsWith("/@fs/")
    ? resolvedUrl.pathname.slice(4)
    : resolvedUrl.pathname

  return pathname.startsWith(`/${appRootEntryPrefix}`)
    ? new URL(pathname.slice(1), packageRootUrl)
    : pathToFileURL(decodeURIComponent(pathname))
}

const relativeEntryForModule = (moduleUrl: string): string =>
  relative(fileURLToPath(packageRootUrl), fileURLToPath(resolvedModuleUrl(moduleUrl))).split(sep).join("/")

const entryForModule = (moduleUrl: string): string => {
  const relativeEntry = relativeEntryForModule(moduleUrl)

  if (!relativeEntry.startsWith(appRootEntryPrefix)) {
    return relativeEntry
  }

  const appEntry = relativeEntry.slice(appRootEntryPrefix.length)

  if (!appEntry.startsWith(demoEntryPrefix)) {
    return appEntry
  }

  const demoEntrySegments = appEntry.split("/")

  return ["server", ...demoEntrySegments.slice(3)].join("/")
}

const readSource = (entry: string, moduleUrl: string): Effect.Effect<string, ProgramSourceReadError> =>
  Effect.tryPromise({
    try: () => readFile(resolvedModuleUrl(moduleUrl), "utf8"),
    catch: (cause) =>
      new ProgramSourceReadError({
        entry,
        reason: String(cause)
      })
  })

export const executableProgramFile = (
  moduleUrl: string
): Effect.Effect<ProgramFile, ProgramSourceReadError> => {
  const entry = entryForModule(moduleUrl)

  return readSource(entry, moduleUrl).pipe(Effect.map((source) => programFile(entry, source)))
}

export const executableProgram = (moduleUrl: string): Effect.Effect<Program, ProgramSourceReadError> => {
  const entry = entryForModule(moduleUrl)

  return readSource(entry, moduleUrl).pipe(Effect.map((source) => program(entry, source)))
}
