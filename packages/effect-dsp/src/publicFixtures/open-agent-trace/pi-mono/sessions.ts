import { assistantUsage } from "./core.js"

export const piMonoChatContinuationRowFixture = {
  harness: "pi",
  session_id: "99e99531-f376-4820-92f4-3c88afca3af9",
  file_name: "2026-01-16T02-44-55-123Z_99e99531-f376-4820-92f4-3c88afca3af9.jsonl",
  traces: [
    {
      type: "session",
      version: 3,
      id: "99e99531-f376-4820-92f4-3c88afca3af9",
      timestamp: "2026-01-16T02:44:55.123Z",
      cwd: "/Users/badlogic/workspaces/pi-mono",
      parentSession: "/Users/badlogic/.pi/agent/sessions/original.jsonl"
    },
    {
      type: "message",
      id: "00000011",
      parentId: null,
      timestamp: "2026-01-16T02:44:55.200Z",
      message: {
        role: "user",
        content: "Continue the chat handoff route experiment",
        timestamp: 1705373095200
      }
    },
    {
      type: "message",
      id: "00000012",
      parentId: "00000011",
      timestamp: "2026-01-16T02:44:55.300Z",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "I'll continue from the handoff route experiment." }],
        api: "anthropic",
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        usage: assistantUsage,
        stopReason: "stop",
        timestamp: 1705373095300
      }
    }
  ]
}

export const piSessionV1Fixture = [
  {
    type: "session",
    id: "v1-session",
    timestamp: "2026-01-01T00:00:00.000Z",
    cwd: "/Users/badlogic/workspaces/pi-mono"
  },
  {
    type: "message",
    timestamp: "2026-01-01T00:00:01.000Z",
    message: {
      role: "user",
      content: "Legacy v1 prompt",
      timestamp: 1704067201000
    }
  },
  {
    type: "compaction",
    timestamp: "2026-01-01T00:00:02.000Z",
    summary: "Legacy compacted context",
    firstKeptEntryIndex: 1,
    tokensBefore: 64
  },
  {
    type: "custom_message",
    timestamp: "2026-01-01T00:00:03.000Z",
    customType: "legacy-note",
    content: "Legacy injected note",
    display: true
  },
  {
    type: "label",
    timestamp: "2026-01-01T00:00:04.000Z",
    targetId: "legacy-0001",
    label: "legacy-checkpoint"
  },
  {
    type: "session_info",
    timestamp: "2026-01-01T00:00:05.000Z",
    name: "Legacy linear session"
  }
]

export const piSessionV2Fixture = [
  {
    type: "session",
    version: 2,
    id: "v2-session",
    timestamp: "2026-01-02T00:00:00.000Z",
    cwd: "/Users/badlogic/workspaces/pi-mono"
  },
  {
    type: "message",
    id: "v2-0001",
    parentId: null,
    timestamp: "2026-01-02T00:00:01.000Z",
    message: {
      role: "hookMessage",
      customType: "v2-hook",
      content: "Hook message becomes custom",
      display: true,
      timestamp: 1704153601000
    }
  },
  {
    type: "model_change",
    id: "v2-0002",
    parentId: "v2-0001",
    timestamp: "2026-01-02T00:00:02.000Z",
    provider: "anthropic",
    modelId: "claude-sonnet-4-5"
  },
  {
    type: "thinking_level_change",
    id: "v2-0003",
    parentId: "v2-0002",
    timestamp: "2026-01-02T00:00:03.000Z",
    thinkingLevel: "medium"
  },
  {
    type: "branch_summary",
    id: "v2-0004",
    parentId: "v2-0001",
    timestamp: "2026-01-02T00:00:04.000Z",
    fromId: "v2-0003",
    summary: "v2 branch summary"
  },
  {
    type: "custom",
    id: "v2-0005",
    parentId: "v2-0004",
    timestamp: "2026-01-02T00:00:05.000Z",
    customType: "v2-state",
    data: { foo: "bar" }
  }
]

export const piSessionV3Fixture = [
  {
    type: "session",
    version: 3,
    id: "v3-session",
    timestamp: "2026-01-03T00:00:00.000Z",
    cwd: "/Users/badlogic/workspaces/pi-mono"
  },
  {
    type: "message",
    id: "v3-0001",
    parentId: null,
    timestamp: "2026-01-03T00:00:01.000Z",
    message: {
      role: "assistant",
      content: [{ type: "text", text: "v3 assistant" }],
      api: "anthropic",
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      usage: assistantUsage,
      stopReason: "stop",
      timestamp: 1704240001000
    }
  }
]
