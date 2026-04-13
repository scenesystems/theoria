---
"effect-dsp": minor
---

Expand `effect-dsp` from the original core DSP toolbox into a fuller workflow package for building and studying agent-style systems.

This release adds three major module patterns: program-of-thought for solving tasks by planning and executing code, multi-chain comparison for choosing between competing reasoning paths, and parallel execution for running the same module across batches of inputs. It also adds the COPRO optimizer for iterative instruction improvement with resumable progress and snapshots.

Beyond the core DSP pieces, this release opens the first public OpenAgentTrace lane in the package. It ships checked-in Amp and pi-mono fixtures, experimental trace tooling, and the workflow contracts used to build downstream study and agent runtime experiences.

It also cleans up older helper names and legacy progress utilities so the released package matches the direction documented for `effect-dsp` 0.2.0. Anyone upgrading from 0.1.x should expect a more capable package, but should also check the release notes for a small set of legacy export cleanups.
