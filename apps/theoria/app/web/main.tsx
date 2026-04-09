import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { parsePathname } from "../contracts/presentation/path.js"
import { App } from "./App.js"

const mountNode = document.getElementById("root")

if (mountNode !== null) {
  const route = parsePathname(window.location.pathname, window.location.search)

  createRoot(mountNode).render(
    <StrictMode>
      <App route={route} />
    </StrictMode>
  )
}
