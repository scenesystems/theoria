---
"@scenesystems/effect-dsp": minor
---

Build MIPROv2 demonstration candidates through BootstrapFewShot and TeacherTrace instead of relabeling training examples. Preserve original instructions, teacher settings, metric thresholds, and error budgets without mutating the input program. Use the CPython-compatible MIPRO stream for successive shuffles and demonstration caps, including the shuffled candidate at catalog index one when labeled demonstrations are disabled. Zero-shot mode still collects teacher evidence for instruction proposals.
