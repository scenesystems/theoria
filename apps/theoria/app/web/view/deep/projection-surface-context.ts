import { Data } from "effect"

import type { EntryId } from "../../../contracts/entry/id.js"
import type { ProgramSourceScope } from "../../../contracts/presentation/program.js"
import type { DeepDiveSurfaceFrameViewModel } from "../../../contracts/presentation/surface-presentation.js"

export class DeepDiveProjectionSurfaceContext extends Data.Class<DeepDiveProjectionSurfaceContext.Shape> {
  static make(context: DeepDiveProjectionSurfaceContext.Shape): DeepDiveProjectionSurfaceContext {
    return new DeepDiveProjectionSurfaceContext(context)
  }
}

export namespace DeepDiveProjectionSurfaceContext {
  export interface Shape {
    readonly frameViewModel: DeepDiveSurfaceFrameViewModel
    readonly id: EntryId
    readonly onSelectFile: (fileIndex: number) => void
    readonly onSelectSourceScope: (scope: ProgramSourceScope) => void
    readonly projectionIndex: number | null
    readonly onToggleSourceExplorerVisible: () => void
    readonly sourceExplorerVisible: boolean
  }
}
