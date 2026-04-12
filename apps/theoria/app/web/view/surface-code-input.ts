import { Match } from "effect"

import type { SurfaceVariant } from "../../contracts/presentation/program.js"
import type { SurfaceCodePresentationInput } from "../../contracts/presentation/surface-code.js"
import type { SurfaceState } from "../state/surface/state.js"

export const surfaceCodePresentationInput = (
  state: SurfaceState,
  variant: SurfaceVariant
): SurfaceCodePresentationInput => ({
  preparedProgram: Match.value(state.preload).pipe(
    Match.tag("PreloadReady", ({ data }) => data.program),
    Match.orElse(() => null)
  ),
  runProgram: state.run.session.program,
  selectedFileIndex: state.programFileIndex,
  selectedSourceScope: state.programSourceScope,
  variant
})
