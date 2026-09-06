import { FetchHttpClient, type HttpClient, type KeyValueStore } from "@effect/platform"
import { BrowserKeyValueStore, Clipboard } from "@effect/platform-browser"
import { Layer } from "effect"

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

export const BrowserLive: Layer.Layer<BrowserServices> = Layer.mergeAll(
  BrowserWindow.layer,
  BrowserDocument.layer,
  BrowserKeyValueStore.layerLocalStorage,
  Clipboard.layer,
  FetchHttpClient.layer
)
