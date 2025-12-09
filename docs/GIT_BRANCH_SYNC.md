Handling deleted remote branches (git-sync)
==========================================

Problem
-------
Developers sometimes try to run:

```
git pull --tags origin <branch>
```

and see an error: "fatal: couldn't find remote ref <branch>" — this happens when the branch was deleted on the remote (merged + auto-deleted or removed manually) while the local branch still exists.

Solution
--------
We've added a small helper script `scripts/git-sync.sh` that takes care of this situation automatically:

- If the remote branch exists: it will run `git pull --rebase` for you.
- If the remote branch does not exist: it pushes the current branch to origin and sets upstream for future syncs.

Usage
-----
From your feature branch run:

```bash
./scripts/git-sync.sh
```

This will ensure your branch is synced with origin and will create a remote branch when missing.

Why this helps
---------------
- Avoids the confusing "couldn't find remote ref" error.
- Makes the common branch sync workflow robust for teams that sometimes delete head branches after merging.

If you'd like a Git alias instead of a script, add this to your global gitconfig:

```
[alias]
    sync = !sh scripts/git-sync.sh
```
