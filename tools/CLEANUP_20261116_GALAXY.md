# Approved interactive galaxy release

Current entry: `index.research.html`. Release revision: `5b574ea126235ddb`.

## Cleanup

- Deleted nine rebuildable Python bytecode caches (98,237 bytes). Publishing commands use `python -B` to avoid recreating them.
- Confirmed the obsolete 2D mask prototype is absent; its recovery archive is outside the website repository.
- Existing shared galaxy modules are in use: one visible page-wide scene; the robot-local scene is a fallback when the page backdrop is unavailable. They are not redundant production files.
- Retained original/saved themes because active links and builders reference them. Retained existing App packs, case media and previously published worker indexes for backward-compatible loading.
- Build outputs, logs, raw downloads, model results, credentials and external recovery archives are not included in the source snapshot or release branch.

## Approved behavior

Continuous full-page galaxy; independent star drift and twinkle; scroll inertia and short trails; pointer attraction; click waves on blank page areas; exploration reveals and waypoints; one shared 3D robot canvas between hero and collapsible companion.

## Verification

927 physical resources verified by hash; 60 cases retained. Galaxy, exploration and leaderboard regression checks passed. The release keeps previous worker homepage blobs and manifests. Browser UI automation remains unavailable; user-reviewed design approval is the visual acceptance evidence.
