# Companion action fix ? 2026-11-16

Confirmed that the official deployment still used the old single-wave renderer. This release synchronizes six action choreographies, automatic non-repeating rotation and a dedicated next-action control in the dock. The caption names the current action; the speech bubble is placed beside the robot rather than over its head.

Release revision: 6c668a438b9d04f4. Based on the previously published shared-galaxy page. Unpublished loading-gate changes remain local and are deliberately excluded from this focused release. Recovery snapshots and the previous worker homepage remain available.

Checks: 606 finite articulated poses; six distinct actions per cycle with no immediate repetition; dock button dispatch and caption restoration; 928 local asset hashes; 299 resource responses and 30 protocol checks. Browser UI automation is unavailable, so no new visual browser acceptance is claimed.
