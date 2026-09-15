import { FetchHttpClient, type HttpClient, type KeyValueStore } from "@effect/platform"
import { Clipboard } from "@effect/platform-browser"
import { Layer } from "effect"

import * as BrowserCookies from "./BrowserCookies.js"
import * as BrowserDocument from "./BrowserDocument.js"
import * as BrowserWindow from "./BrowserWindow.js"

/**
 * Every browser capability the app uses, provided once. `appRuntime` in
 * `atoms/runtime.ts` is built from this layer; tests build their own from
 * the same tags with in-memory stores and stub windows.
 *
 * @since 0.2.0
 */
export type BrowserServices =
  | BrowserWindow.BrowserWindow
  | BrowserDocument.BrowserDocument
  | KeyValueStore.KeyValueStore
  | Clipboard.Clipboard
  | HttpClient.HttpClient

/**
 * The `KeyValueStore` is the document's cookies, not local storage: the one
 * preference the app keeps — the colour mode — must reach the Worker with
 * every request so the shell is served already in the reader's mode.
 */
export const BrowserLive: Layer.Layer<BrowserServices> = Layer.mergeAll(
  BrowserWindow.layer,
  BrowserDocument.layer,
  BrowserCookies.layerKeyValueStore.pipe(Layer.provide(BrowserDocument.layer)),
  Clipboard.layer,
  FetchHttpClient.layer
)
