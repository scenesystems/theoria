import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { PageLocation } from "../contracts/presentation/page-location.js"
import { App } from "./App.js"

const mountNode = document.getElementById("root")

if (mountNode !== null) {
  createRoot(mountNode).render(
    <StrictMode>
      <App location={PageLocation.fromPathnameSearch(window.location.pathname, window.location.search)} />
    </StrictMode>
  )
}
