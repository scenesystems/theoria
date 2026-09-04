import { Option } from "effect"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App } from "./App.js"

Option.match(Option.fromNullable(document.getElementById("root")), {
  onNone: () => {},
  onSome: (mountNode) => {
    createRoot(mountNode).render(
      <StrictMode>
        <App />
      </StrictMode>
    )
  }
})
