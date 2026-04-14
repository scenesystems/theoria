export const piShareHfManifestFixture = {
  file: "2026-04-04T16-43-06-494Z_aed55f07.jsonl",
  source_hash: "sha256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  redaction_key: "v1:images=preserved:secrets=sha256:review-key",
  redacted_hash: "sha256:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
}

export const piShareHfReviewSidecarFixture = {
  about_project: true,
  shareable: true,
  missed_sensitive_data: false,
  review_key: "review-key-public-corpus",
  prompt_version: 3,
  semantic_review_status: "approved" as const,
  policy_id: "open-agent-trace-public-corpus",
  policy_version: 1
}

export const assistantUsage = {
  input: 120,
  output: 80,
  cacheRead: 16,
  cacheWrite: 4,
  totalTokens: 220,
  cost: {
    input: 0.0012,
    output: 0.0016,
    cacheRead: 0.0001,
    cacheWrite: 0.00004,
    total: 0.00294
  }
}

export const piMonoTaskFirstRowFixture = {
  harness: "pi",
  session_id: "4293a326-81ca-4327-b450-85275e1ca645",
  file_name: "2026-01-16T02-37-34-075Z_4293a326-81ca-4327-b450-85275e1ca645.jsonl",
  traces: [
    {
      type: "session",
      version: 3,
      id: "4293a326-81ca-4327-b450-85275e1ca645",
      timestamp: "2026-01-16T02:37:34.075Z",
      cwd: "/Users/badlogic/workspaces/pi-mono"
    },
    {
      type: "model_change",
      id: "00000001",
      parentId: null,
      timestamp: "2026-01-16T02:37:34.100Z",
      provider: "anthropic",
      modelId: "claude-sonnet-4-5"
    },
    {
      type: "thinking_level_change",
      id: "00000002",
      parentId: "00000001",
      timestamp: "2026-01-16T02:37:34.150Z",
      thinkingLevel: "high"
    },
    {
      type: "message",
      id: "00000003",
      parentId: "00000002",
      timestamp: "2026-01-16T02:37:35.000Z",
      message: {
        role: "user",
        content: "Find the regression in the workspace runtime",
        timestamp: 1705372655000
      }
    },
    {
      type: "message",
      id: "00000004",
      parentId: "00000003",
      timestamp: "2026-01-16T02:37:35.500Z",
      message: {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "I should inspect the runtime state machine first." },
          { type: "text", text: "I'll inspect the runtime state machine first." },
          {
            type: "image",
            mimeType: "image/png",
            data: "runtime-state-machine-preview"
          }
        ],
        api: "anthropic",
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        usage: assistantUsage,
        stopReason: "stop",
        timestamp: 1705372655500
      }
    },
    {
      type: "message",
      id: "00000005",
      parentId: "00000004",
      timestamp: "2026-01-16T02:37:36.000Z",
      message: {
        role: "user",
        content: "Try the alternate branch that batches updates",
        timestamp: 1705372656000
      }
    },
    {
      type: "message",
      id: "00000006",
      parentId: "00000005",
      timestamp: "2026-01-16T02:37:36.500Z",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "The batching branch regresses control locks." }],
        api: "anthropic",
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        usage: assistantUsage,
        stopReason: "stop",
        timestamp: 1705372656500
      }
    },
    {
      type: "branch_summary",
      id: "00000007",
      parentId: "00000004",
      timestamp: "2026-01-16T02:37:37.000Z",
      fromId: "00000006",
      summary: "The abandoned branch batched widget updates and broke the shared control lock state."
    },
    {
      type: "custom",
      id: "00000008",
      parentId: "00000007",
      timestamp: "2026-01-16T02:37:37.050Z",
      customType: "workspace-state",
      data: { branch: "task-first" }
    },
    {
      type: "custom_message",
      id: "00000009",
      parentId: "00000008",
      timestamp: "2026-01-16T02:37:37.100Z",
      customType: "workspace-note",
      content: "Keep the runtime spine authoritative.",
      display: true
    },
    {
      type: "compaction",
      id: "0000000a",
      parentId: "00000009",
      timestamp: "2026-01-16T02:37:37.200Z",
      summary: "Investigated the runtime spine and captured the abandoned batching branch.",
      firstKeptEntryId: "00000004",
      tokensBefore: 12000
    },
    {
      type: "label",
      id: "0000000b",
      parentId: "0000000a",
      timestamp: "2026-01-16T02:37:37.250Z",
      targetId: "00000004",
      label: "checkpoint-a"
    },
    {
      type: "session_info",
      id: "0000000c",
      parentId: "0000000b",
      timestamp: "2026-01-16T02:37:37.300Z",
      name: "Task-first runtime trace"
    },
    {
      type: "message",
      id: "0000000d",
      parentId: "0000000c",
      timestamp: "2026-01-16T02:37:38.000Z",
      message: {
        role: "user",
        content: "Summarize the surviving fix path.",
        timestamp: 1705372658000
      }
    },
    {
      type: "message",
      id: "0000000e",
      parentId: "0000000d",
      timestamp: "2026-01-16T02:37:38.500Z",
      message: {
        role: "assistant",
        content: [{
          type: "text",
          text: "The surviving path keeps server-run authority and removes local control heuristics."
        }],
        api: "anthropic",
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        usage: assistantUsage,
        stopReason: "stop",
        timestamp: 1705372658500
      }
    }
  ]
}
