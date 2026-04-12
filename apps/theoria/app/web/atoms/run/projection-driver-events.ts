import { Data } from "effect"

export class ProjectionDriverCompletedEvent extends Data.TaggedClass("ProjectionDriverCompleted")<{}> {
  static make(): ProjectionDriverCompletedEvent {
    return new ProjectionDriverCompletedEvent()
  }
}
