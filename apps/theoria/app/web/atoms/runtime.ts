import { Atom } from "@effect-atom/atom"

import { BrowserLive } from "../platform/browser.js"

/**
 * Effect runtime bridge for atoms that talk to the browser: the window and
 * document services, the persisted preference store, the clipboard and the
 * HTTP client. Feature runtimes that need a client of their own build it on
 * top, for example `placeRuntime` in `imagined-place.ts`.
 */
export const appRuntime = Atom.runtime(BrowserLive)
