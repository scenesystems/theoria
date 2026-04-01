import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App } from "./App.js"
import { parsePathname } from "./services/path.js"

const mountNode = document.getElementById("root")

if (mountNode !== null) {
  const route = parsePathname(window.location.pathname)

  createRoot(mountNode).render(
    <StrictMode>
      <App route={route} />
    </StrictMode>
  )
}
