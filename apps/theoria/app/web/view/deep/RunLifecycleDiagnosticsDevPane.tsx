import { useAtomValue } from "@effect-atom/atom-react"

import type { SurfaceId } from "../../../contracts/id.js"
import { surfaceRunLifecycleDiagnosticsViewModelAtom } from "../../atoms/run-diagnostics.js"
import { RunLifecycleDiagnosticsPanel } from "../primitives/RunLifecycleDiagnosticsPanel.js"

const RunLifecycleDiagnosticsDevPane = ({ id }: { readonly id: SurfaceId }) => {
  const diagnostics = useAtomValue(surfaceRunLifecycleDiagnosticsViewModelAtom(id))

  return <RunLifecycleDiagnosticsPanel sections={diagnostics?.sections ?? []} />
}

export default RunLifecycleDiagnosticsDevPane
