---
description: Rules for requested target-state working plans
globs: "**/*.md"
alwaysApply: true
---

# Target-State Working Plans

Files here are gitignored working plans, not mandatory PR tracking artifacts.
Create one only when the user requests a plan that needs this representation.
Keep durable public API design and supported use in the relevant package/source
documentation. Do not force-add ignored plans or copy internal documents into
this open-source repository.

## Rules

1. **Describe the target.** State the requested outcome, researched decisions,
   exact public API, provider/consumer composition, necessary delivery order,
   and observable behavioral acceptance. Use concise explanatory prose and
   examples where they make implementation decisions clear. Do not substitute
   a file inventory or checked boxes for design.

2. **Implement and verify behavior.** Declare the target API, then drive each
   implementation slice red–green–refactor through its public behavior with
   native Effect. Name a credible defect and the lowest complete boundary that
   catches it. Real provider claims require real providers. No tests about
   tests, guidance, construction facts, or inventories; a green command or
   `completed` token does not establish behavior it never exercised.

3. **Maintain meaning in place.** Revise only when outcome, design, acceptance,
   delivery order, or a material blocker changes. An implementation step,
   commit, push, check, or handoff does not require a plan edit. No progress
   matrices, remaining-work ledgers, per-wave files, command transcripts,
   completion diaries, cost/log/thread inventories, or copied CI summaries.
   Keep current decisions that affect execution; integrate their resolution
   into the design rather than appending history.

4. **No proprietary context.** Theoria is MIT-licensed open source. Never
   reference proprietary codebases, internal architecture, internal research
   documents, or private infrastructure. Reconstruct from understanding, never
   copy or cite proprietary sources.

5. **Use the existing evidence systems.** Git carries committed change history;
   tests, CI, and runtime observations establish behavior. Coordinate in the
   working conversation. Do not mirror those records into plans, PR bodies,
   archives, or handoff files. Preserve unique durable rationale in its proper
   design section when removing a diary. A separate audit/retention record
   requires an explicit user deliverable or identified adopted external
   requirement, never agent-invented process.

6. **Preserve human scope.** An audit or agent proposal does not authorize a new
   product program, reporting format, or permanent artifact. Engineering
   decisions needed for the requested outcome remain work; so do encountered
   prohibited implementations and banned tests and their necessary native
   corrections. Respect access, concurrent work, and approval boundaries.
   Reducing bookkeeping never weakens native Effect, testing, or verification.
