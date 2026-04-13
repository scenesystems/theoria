import { Array as Arr, Effect } from "effect"

import { loadCheckedInAmpFixtureCatalog, loadCheckedInAmpFixtureRoot } from "../../../OpenAgentTrace/amp/catalog.js"
import {
  AMP_PUBLIC_THREAD_ID,
  loadCaptureEvidence as loadRawCaptureEvidence,
  loadPluginAdapterCapture as loadRawPluginAdapterCapture,
  loadPluginCapture as loadRawPluginCapture,
  loadStreamJsonAdapterCapture as loadRawStreamJsonAdapterCapture,
  loadStreamJsonCapture as loadRawStreamJsonCapture
} from "../../../OpenAgentTrace/amp/fixture.js"
import type { AmpFixtureLane } from "../../../OpenAgentTrace/amp/fixtureSupport.js"

export const threadId = AMP_PUBLIC_THREAD_ID

export const loadCatalog = () => loadCheckedInAmpFixtureCatalog()

export const loadThreadIds = () =>
  loadCatalog().pipe(
    Effect.map((entries) => Arr.map(entries, (entry) => entry.threadId))
  )

export const loadCaptureEvidence = (lane: AmpFixtureLane, currentThreadId = AMP_PUBLIC_THREAD_ID) =>
  loadCheckedInAmpFixtureRoot().pipe(
    Effect.flatMap((rootPath) => loadRawCaptureEvidence(rootPath, lane, currentThreadId))
  )

export const loadPluginCapture = (currentThreadId = AMP_PUBLIC_THREAD_ID) =>
  loadCheckedInAmpFixtureRoot().pipe(
    Effect.flatMap((rootPath) => loadRawPluginCapture(rootPath, currentThreadId))
  )

export const loadStreamJsonCapture = (currentThreadId = AMP_PUBLIC_THREAD_ID) =>
  loadCheckedInAmpFixtureRoot().pipe(
    Effect.flatMap((rootPath) => loadRawStreamJsonCapture(rootPath, currentThreadId))
  )

export const loadPluginAdapterCapture = (currentThreadId = AMP_PUBLIC_THREAD_ID) =>
  loadCheckedInAmpFixtureRoot().pipe(
    Effect.flatMap((rootPath) => loadRawPluginAdapterCapture(rootPath, currentThreadId))
  )

export const loadStreamJsonAdapterCapture = (currentThreadId = AMP_PUBLIC_THREAD_ID) =>
  loadCheckedInAmpFixtureRoot().pipe(
    Effect.flatMap((rootPath) => loadRawStreamJsonAdapterCapture(rootPath, currentThreadId))
  )
