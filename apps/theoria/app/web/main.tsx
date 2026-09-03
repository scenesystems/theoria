import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App } from "./App.js"

const mountNode = document.getElementById("root")

if (mountNode !== null) {
  createRoot(mountNode).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}
