import { Atom } from "@effect-atom/atom"

import { DemoClient } from "../services/DemoClient.js"

export const appRuntime = Atom.runtime(DemoClient.Default)
