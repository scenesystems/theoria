import { Atom } from "@effect-atom/atom"

import { EntryClient } from "../services/EntryClient.js"

export const appRuntime = Atom.runtime(EntryClient.Default)
