import { BrowserRuntime } from "@effect/platform-browser"
import { Effect, Option } from "effect"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App } from "./App.js"
import * as BrowserDocument from "./platform/BrowserDocument.js"

/** Mounts the app into the shell's root element; a shell without one has nothing to render into. */
const main = BrowserDocument.elementById("root").pipe(
  Effect.map(Option.match({
    onNone: () => {},
    onSome: (mountNode) => {
      createRoot(mountNode).render(
        <StrictMode>
          <App />
        </StrictMode>
      )
    }
  })),
  Effect.provide(BrowserDocument.layer)
)

BrowserRuntime.runMain(main)
