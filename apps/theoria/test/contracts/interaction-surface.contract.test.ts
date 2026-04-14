import { describe, expect, it } from "@effect/vitest"

import {
  ActionModel,
  InteractionActionItem,
  InteractionMessageItem,
  interactionSurfaceModel,
  MessageActorModel,
  MessageAvatarModel,
  MessageModel,
  MessageTextContent
} from "../../app/contracts/presentation/interactions.js"

const actor = MessageActorModel.make({
  avatar: MessageAvatarModel.make({ fallback: "AS", label: "Assistant" }),
  label: "Assistant",
  role: "assistant"
})

const messageItem = (id: string, text: string) =>
  InteractionMessageItem.make({
    message: MessageModel.make({
      actor,
      alignment: "start",
      content: [MessageTextContent.make({ kind: "body", text })],
      id,
      status: "default"
    })
  })

const actionItem = (id: string, label: string) =>
  InteractionActionItem.make({
    action: ActionModel.make({
      details: [],
      id,
      kind: "runtime",
      label,
      status: "default"
    }),
    actor,
    alignment: "start",
    id
  })

describe("InteractionSurface contracts", () => {
  it("groups action follow-ups into the preceding semantic turn", () => {
    const model = interactionSurfaceModel({
      emptyText: "No interactions",
      items: [
        messageItem("message-1", "I am going to inspect the runtime state."),
        actionItem("action-1", "Shell Execution"),
        actionItem("action-2", "Model Change"),
        messageItem("message-2", "I found the issue.")
      ]
    })

    expect(model.turns).toHaveLength(2)
    expect(model.turns[0]?.items.map((item) => item._tag)).toEqual([
      "InteractionMessageItem",
      "InteractionActionItem",
      "InteractionActionItem"
    ])
    expect(model.turns[1]?.items.map((item) => item._tag)).toEqual(["InteractionMessageItem"])
  })

  it("keeps a leading action-only flow as its own turn", () => {
    const model = interactionSurfaceModel({
      emptyText: "No interactions",
      items: [
        actionItem("action-1", "Shell Execution"),
        actionItem("action-2", "Reasoning Level"),
        messageItem("message-1", "Execution resumed.")
      ]
    })

    expect(model.turns).toHaveLength(2)
    expect(model.turns[0]?.items.map((item) => item._tag)).toEqual([
      "InteractionActionItem",
      "InteractionActionItem"
    ])
    expect(model.turns[1]?.items.map((item) => item._tag)).toEqual(["InteractionMessageItem"])
  })
})
