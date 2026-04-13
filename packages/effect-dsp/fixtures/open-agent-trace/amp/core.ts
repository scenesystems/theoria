import { existsSync } from "node:fs"
import { dirname } from "node:path"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { BunContext } from "@effect/platform-bun"
import { Array as Arr, Effect } from "effect"

import { loadCheckedInAmpFixtureCatalog } from "../../../src/OpenAgentTrace/amp/catalog.js"
import {
  AMP_PUBLIC_THREAD_ID,
  loadCaptureEvidence as loadRawCaptureEvidence,
  loadPluginAdapterCapture as loadRawPluginAdapterCapture,
  loadPluginCapture as loadRawPluginCapture,
  loadStreamJsonAdapterCapture as loadRawStreamJsonAdapterCapture,
  loadStreamJsonCapture as loadRawStreamJsonCapture
} from "../../../src/OpenAgentTrace/amp/fixture.js"

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const ampFixtureRootSegments = ["fixtures", "open-agent-trace", "amp"] as const

const fixtureTreeExists = (rootPath: string): boolean =>
  existsSync(join(rootPath, "raw")) && existsSync(join(rootPath, "derived"))

const resolveAmpFixtureRoot = (directory: string): string => {
  if (fixtureTreeExists(directory)) {
    return directory
  }

  const candidate = join(directory, ...ampFixtureRootSegments)

  if (fixtureTreeExists(candidate)) {
    return candidate
  }

  const parent = dirname(directory)

  return parent === directory
    ? moduleDirectory
    : resolveAmpFixtureRoot(parent)
}

const ampFixtureRoot = resolveAmpFixtureRoot(moduleDirectory)

export const threadId = AMP_PUBLIC_THREAD_ID

export const loadCatalog = () =>
  loadCheckedInAmpFixtureCatalog().pipe(Effect.provide(BunContext.layer))

export const loadThreadIds = () =>
  loadCatalog().pipe(
    Effect.map((entries) => Arr.map(entries, (entry) => entry.threadId))
  )

export const loadCaptureEvidence = (lane: "plugin" | "stream-json", threadId = AMP_PUBLIC_THREAD_ID) =>
  loadRawCaptureEvidence(ampFixtureRoot, lane, threadId).pipe(Effect.provide(BunContext.layer))

export const loadPluginCapture = (threadId = AMP_PUBLIC_THREAD_ID) =>
  loadRawPluginCapture(ampFixtureRoot, threadId).pipe(Effect.provide(BunContext.layer))

export const loadStreamJsonCapture = (threadId = AMP_PUBLIC_THREAD_ID) =>
  loadRawStreamJsonCapture(ampFixtureRoot, threadId).pipe(Effect.provide(BunContext.layer))

export const loadPluginAdapterCapture = (threadId = AMP_PUBLIC_THREAD_ID) =>
  loadRawPluginAdapterCapture(ampFixtureRoot, threadId).pipe(Effect.provide(BunContext.layer))

export const loadStreamJsonAdapterCapture = (threadId = AMP_PUBLIC_THREAD_ID) =>
  loadRawStreamJsonAdapterCapture(ampFixtureRoot, threadId).pipe(Effect.provide(BunContext.layer))
