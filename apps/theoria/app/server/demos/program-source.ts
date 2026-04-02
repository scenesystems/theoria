import { FileSystem, Path } from "@effect/platform"
import { Data, Effect } from "effect"

import { program, programFile } from "./presentation.js"

const appRootEntryPrefix = "app/"
const demoEntryPrefix = "server/demos/"

export class ProgramSourceReadError extends Data.TaggedError("ProgramSourceReadError")<{
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

  return new URL(`file://${pathname}`)
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
    : new URL(`file://${pathname}`)
}

const relativeEntryForModule = (moduleUrl: string) =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const rootPath = yield* path.fromFileUrl(packageRootUrl)
    const modulePath = yield* path.fromFileUrl(resolvedModuleUrl(moduleUrl))

    return path.relative(rootPath, modulePath).split(path.sep).join("/")
  })

const entryForModule = (moduleUrl: string) =>
  relativeEntryForModule(moduleUrl).pipe(
    Effect.map((relativeEntry) => {
      if (!relativeEntry.startsWith(appRootEntryPrefix)) {
        return relativeEntry
      }

      const appEntry = relativeEntry.slice(appRootEntryPrefix.length)

      if (!appEntry.startsWith(demoEntryPrefix)) {
        return appEntry
      }

      const demoEntrySegments = appEntry.split("/")

      return ["server", ...demoEntrySegments.slice(3)].join("/")
    })
  )

const readSource = (moduleUrl: string) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const filePath = yield* path.fromFileUrl(resolvedModuleUrl(moduleUrl))

    return yield* fs.readFileString(filePath)
  })

export const executableProgramFile = (moduleUrl: string) =>
  Effect.gen(function*() {
    const entry = yield* entryForModule(moduleUrl)
    const source = yield* readSource(moduleUrl)

    return programFile(entry, source)
  }).pipe(
    Effect.mapError((cause) =>
      new ProgramSourceReadError({
        entry: moduleUrl,
        reason: String(cause)
      })
    )
  )

export const executableProgram = (moduleUrl: string) =>
  Effect.gen(function*() {
    const entry = yield* entryForModule(moduleUrl)
    const source = yield* readSource(moduleUrl)

    return program(entry, source)
  }).pipe(
    Effect.mapError((cause) =>
      new ProgramSourceReadError({
        entry: moduleUrl,
        reason: String(cause)
      })
    )
  )
