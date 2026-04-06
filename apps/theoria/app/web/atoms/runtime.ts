import { Atom } from "@effect-atom/atom"
import { Layer } from "effect"

import { DemoClient } from "../services/DemoClient.js"
import { WorkflowComparisonClient } from "../services/WorkflowComparisonClient.js"

export const appRuntime = Atom.runtime(Layer.merge(DemoClient.Default, WorkflowComparisonClient.Default))
