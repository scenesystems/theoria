# For triage: what the preview is known to have (don't send to testers)

Preview = branch `feat/homepage-place-acts-0-1` at `1d721dc` (PR #93). The later local commit `42014a7` (hover-intent ownership, Base UI patch removed) was NOT pushed, so the preview still uses Base UI `openOnHover`. Hover flicker / race reports on desktop are expected and already tracked (M1).

Expected reports → already known:

| If a tester says…                                                             | Known as                                                                 |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Desktop 1440×900: can't see the paper/first disc without scrolling            | First-viewport regression; plan is to reduce hero/arrival spacing        |
| Phone: discs hard to tap / hit the wrong one                                  | Touch targets ≈30px, not 44px; unmeasured                                |
| Phone: paper text looks slightly smaller than expected                        | M3 — CSS paints 15/22 under 640px while geometry assumes 16/26           |
| Reduce Motion on: Merge switch knob still slides                              | M4 — unconditional 150ms transform on ToggleSwitch                       |
| Reduce Motion on: a line "draws" itself / values pulse                        | Remaining CSS keyframes `PlaceWalk` (900ms) and `ChangedValue`           |
| Reduce Motion toggled while search running → search restarts                  | Motion preference is a dependency of the search atom                     |
| Writing swap feels slow / two-step                                            | Exit 120ms + arrival 300ms = 420ms vs 300ms target                       |
| Switched scenario fast → explanation describes the wrong place / empty pop-up | M2 — generation-mismatched provenance                                    |
| Phone: flipped Merge, couldn't tell what changed                              | Known UX gap; band only shows disc change                                |
| Band has no version label / just says "Back to the place" to screen readers   | Known a11y follow-up                                                     |
| Clicking a code reference in a pop-up just scrolls to "How it's built"        | Known — should select tab and reveal the credited line                   |
| Windows High Contrast: focus rings, tab underline, knots, discs vanish        | No forced-colors implementation yet                                      |
| Dark mode oddities in open pop-ups / skeleton / band / previews               | Dark matrix only checked for prose                                       |
| Arrange values don't match what the pop-up says about the shown trial         | Known reconcile item                                                     |
| Trace line and dots don't line up                                             | Known Y-domain mismatch                                                  |
| Many borders / shadows still visible                                          | Surface budget not met: 28 bordered (target ≤10), 11 shadows (target ≤4) |

Untested by us, so tester reports here are the most valuable:

- 320px-wide phones: scenario chooser overflow; paper ≥240px wide
- Tablets at 768 / 1024 — which layout it picks, and the moment it switches
- 1920+ / ultrawide
- Real browser zoom at 200% (only a DPR proxy was tested)
- Safari (iOS + macOS) and Firefox — only Chromium was run
- Landscape phone, iOS Safari bottom bar vs band/footer
- Large-text OS settings
- Samsung Internet
- Perceived scroll performance during a search on mid-range phones (dev cost 45–60ms/trial, production unmeasured)
