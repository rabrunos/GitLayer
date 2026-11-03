# Catálogo Git — revisão v2

**Baseline upstream herdado: v2.56.0. Não pressupõe a versão instalada no computador.**

161 entradas de comandos/ferramentas; 33 entradas de guias/interfaces/formatos. Todos os nomes do catálogo mantêm ligação a roteiros, inclusive os atualmente documentais/adiados. Nenhuma ligação prova suporte.

Fonte fixada: [command-list.txt](https://github.com/git/git/blob/v2.56.0/command-list.txt). Blob registrado no v1: `63ae2a67c9405547f0e982567c06708099e60900`. Conferir ambiente real e fichas de opções antes da execução.

## Comandos

| Nome | Categoria upstream | Escopo desta rodada | IDs de roteiro |
|---|---|---|---|
| `git-add` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INIT-001, INIT-002, INDEX-001, INDEX-002, INDEX-003, INDEX-004, INDEX-005, INDEX-006, INDEX-007, INDEX-008, INDEX-009, INDEX-010, INDEX-011, INDEX-016, INDEX-017, INDEX-018, INDEX-020, COMMIT-014, MERGE-010, PATH-001, PATH-002, PATH-003, PATH-004, PATH-005, PATH-006, PATH-007, PATH-008, PATH-009, PATH-010, PATH-011, PATH-012, PATH-013, PATH-014, PATH-015, TOOLS-010, TOOLS-012, LAYER-001, LAYER-008, RECOVERY-003, RECOVERY-011, HARNESS-006, HARNESS-009, HOOK-012, MODEL-006, MODEL-007 |
| `git-am` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PATCH-005, PATCH-006 |
| `git-annotate` | ancillaryinterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-007 |
| `git-apply` | plumbingmanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PATCH-001, PATCH-002, PATCH-003, PATCH-004 |
| `git-archimport` | foreignscminterface | OFFICIAL_BRIDGE_INVENTORY_ONLY | LEGACY-007 |
| `git-archive` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PATCH-008, PROTO-008 |
| `git-backfill` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INIT-009 |
| `git-bisect` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | TOOLS-005 |
| `git-blame` | ancillaryinterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-007 |
| `git-branch` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | BRANCH-001, BRANCH-009, BRANCH-010, BRANCH-011, BRANCH-012, BRANCH-015, BRANCH-019, STASH-013, LAYER-015 |
| `git-bugreport` | ancillaryinterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-014 |
| `git-bundle` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PATCH-009 |
| `git-cat-file` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INIT-009, INDEX-019, COMMIT-001, COMMIT-007, COMMIT-008, COMMIT-014, MERGE-002, MERGE-014, MERGE-015, REWRITE-004, REWRITE-008, STASH-003, REMOTE-010, REMOTE-016, PATH-009, INSPECT-012, OBJECT-001, OBJECT-002, OBJECT-004, OBJECT-005, OBJECT-010, LAYER-003, LAYER-010, LAYOUT-009, LAYOUT-012, HARNESS-005, MODEL-005, MODEL-010 |
| `git-check-attr` | purehelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | BRANCH-014, PATH-007, PATH-008, PATH-012, PATH-013 |
| `git-check-ignore` | purehelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INDEX-005, BRANCH-005, WORKTREE-006, PATH-014, HARNESS-006 |
| `git-check-mailmap` | purehelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-010 |
| `git-check-ref-format` | purehelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | BRANCH-012, REF-005 |
| `git-checkout` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | BRANCH-002, BRANCH-004, BRANCH-005, BRANCH-006, BRANCH-008, BRANCH-013, BRANCH-016, BRANCH-018, BRANCH-020, MERGE-010, TOOLS-012, HOOK-005, MODEL-007 |
| `git-checkout-index` | plumbingmanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | OBJECT-008, RECOVERY-007 |
| `git-cherry` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-013 |
| `git-cherry-pick` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REWRITE-007, REWRITE-008, REWRITE-009 |
| `git-citool` | mainporcelain | OFFICIAL_GUI_INVENTORY_ONLY | TOOLS-002 |
| `git-clean` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | STASH-010, STASH-011, STASH-012, HARNESS-006, MODEL-007 |
| `git-clone` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INIT-005, INIT-006, INIT-007, INIT-008, INIT-009, INIT-010, LAYOUT-010 |
| `git-column` | purehelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | TOOLS-007 |
| `git-commit` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INIT-001, INDEX-011, INDEX-017, COMMIT-001, COMMIT-002, COMMIT-003, COMMIT-004, COMMIT-005, COMMIT-006, COMMIT-007, COMMIT-008, COMMIT-009, COMMIT-010, COMMIT-011, COMMIT-012, COMMIT-014, LAYER-001, RECOVERY-003, HOOK-001, HOOK-002, HOOK-003, HOOK-010, HOOK-011, HOOK-012, MODEL-006 |
| `git-commit-graph` | plumbingmanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REF-013 |
| `git-commit-tree` | plumbingmanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | OBJECT-004 |
| `git-config` | ancillarymanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | ENV-006, ENV-007, ENV-008, ENV-009, ENV-012, ENV-014, INIT-011, REMOTE-001, WORKTREE-006, PATH-012, HARNESS-004, HARNESS-022, HOOK-010 |
| `git-count-objects` | ancillaryinterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INIT-010, REF-015, HARNESS-010 |
| `git-credential` | purehelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PROTO-010 |
| `git-credential-cache` | purehelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PROTO-011 |
| `git-credential-store` | purehelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PROTO-012 |
| `git-cvsexportcommit` | foreignscminterface | OFFICIAL_BRIDGE_INVENTORY_ONLY | LEGACY-005 |
| `git-cvsimport` | foreignscminterface | OFFICIAL_BRIDGE_INVENTORY_ONLY | LEGACY-005 |
| `git-cvsserver` | foreignscminterface | OFFICIAL_BRIDGE_INVENTORY_ONLY | LEGACY-006 |
| `git-daemon` | synchingrepositories | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PROTO-003 |
| `git-describe` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-009 |
| `git-diagnose` | ancillaryinterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-014 |
| `git-diff` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INDEX-008, INDEX-009, INDEX-010, INDEX-013, INDEX-015, COMMIT-004, MERGE-007, STASH-005, WORKTREE-012, PATH-005, PATH-013, INSPECT-002, INSPECT-003, INSPECT-004, PATCH-001, PATCH-004 |
| `git-diff-files` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-002 |
| `git-diff-index` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-002 |
| `git-diff-pairs` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | OBJECT-011 |
| `git-diff-tree` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-002 |
| `git-difftool` | ancillaryinterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | TOOLS-001 |
| `git-fast-export` | ancillarymanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PATCH-010 |
| `git-fast-import` | ancillarymanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PATCH-010 |
| `git-fetch` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INIT-008, REMOTE-002, REMOTE-003, REMOTE-004, REMOTE-013, REMOTE-015, PATCH-009, PROTO-003, PROTO-004, PROTO-009 |
| `git-fetch-pack` | synchingrepositories | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PROTO-001 |
| `git-filter-branch` | ancillarymanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PATCH-011 |
| `git-fmt-merge-msg` | purehelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | TOOLS-008 |
| `git-for-each-ref` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | BRANCH-019, REF-001, LAYOUT-009, LAYOUT-012, HARNESS-005 |
| `git-for-each-repo` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REF-014 |
| `git-format-patch` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PATCH-005, LEGACY-001 |
| `git-format-rev` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-009 |
| `git-fsck` | ancillaryinterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INIT-010, STASH-013, REF-008, REF-010, REF-015, LAYOUT-005, RECOVERY-014, MODEL-009 |
| `git-gc` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REF-008, RECOVERY-013 |
| `git-get-tar-commit-id` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PATCH-008 |
| `git-grep` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-008 |
| `git-gui` | mainporcelain | OFFICIAL_GUI_INVENTORY_ONLY | TOOLS-002 |
| `git-hash-object` | plumbingmanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PATH-009, OBJECT-001, LAYER-004, LAYER-013, RECOVERY-005, RECOVERY-007, RECOVERY-008, RECOVERY-010, MODEL-001, MODEL-003, MODEL-008 |
| `git-help` | ancillaryinterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | ENV-001, ENV-002, ENV-008, ENV-011, TOOLS-011, LEGACY-008, HARNESS-014 |
| `git-history` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REWRITE-015 |
| `git-hook` | purehelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | COMMIT-012, HOOK-001, HOOK-002, HOOK-003, HOOK-004, HOOK-005, HOOK-006, HOOK-007, HOOK-008, HOOK-009, HOOK-010, HOOK-012 |
| `git-http-backend` | synchingrepositories | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PROTO-004 |
| `git-http-fetch` | synchelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PROTO-005 |
| `git-http-push` | synchelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PROTO-006 |
| `git-imap-send` | foreignscminterface | OFFICIAL_HEADLESS_WHEN_AVAILABLE | LEGACY-002 |
| `git-index-pack` | plumbingmanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REF-011 |
| `git-init` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | ENV-004, ENV-012, INIT-001, INIT-002, INIT-003, INIT-004, INIT-011, REF-006 |
| `git-instaweb` | ancillaryinterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | TOOLS-003 |
| `git-interpret-trailers` | purehelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | COMMIT-010, INSPECT-010 |
| `git-last-modified` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-007 |
| `git-log` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-005, INSPECT-006 |
| `git-ls-files` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INDEX-001, INDEX-002, INDEX-006, INDEX-007, INDEX-010, INDEX-012, INDEX-014, INDEX-018, INDEX-019, INDEX-020, BRANCH-016, MERGE-004, MERGE-005, MERGE-006, MERGE-008, MERGE-009, REWRITE-002, REWRITE-009, REWRITE-011, STASH-004, STASH-007, REMOTE-006, WORKTREE-002, WORKTREE-007, WORKTREE-010, WORKTREE-011, WORKTREE-014, PATH-001, PATH-004, PATH-010, PATH-011, PATCH-002, PATCH-003, OBJECT-006, OBJECT-007, OBJECT-009, LAYER-002, LAYER-003, LAYER-005, LAYER-006, LAYER-007, LAYER-008, LAYER-009, LAYER-010, LAYER-011, LAYER-013, LAYER-016, LAYOUT-009, LAYOUT-011, RECOVERY-001, RECOVERY-002, HARNESS-001, HARNESS-005, MODEL-001, MODEL-002, MODEL-003, MODEL-004, MODEL-005, MODEL-010 |
| `git-ls-remote` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REMOTE-002, REMOTE-007, REMOTE-008, REMOTE-009, REMOTE-010, REMOTE-016 |
| `git-ls-tree` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | COMMIT-014, REMOTE-016, OBJECT-003, LAYER-002, LAYER-005, LAYER-006 |
| `git-mailinfo` | purehelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PATCH-007 |
| `git-mailsplit` | purehelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PATCH-007 |
| `git-maintenance` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REF-014, TOOLS-004 |
| `git-merge` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | MERGE-001, MERGE-002, MERGE-003, MERGE-004, MERGE-005, MERGE-006, MERGE-007, MERGE-008, MERGE-009, MERGE-010, MERGE-011, MERGE-012, MERGE-013, MERGE-014, TOOLS-013, HOOK-004, HOOK-005 |
| `git-merge-base` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | TOOLS-005, TOOLS-006 |
| `git-merge-file` | plumbingmanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | OBJECT-012 |
| `git-merge-index` | plumbingmanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | OBJECT-012 |
| `git-merge-one-file` | purehelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | OBJECT-012 |
| `git-merge-tree` | ancillaryinterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | MERGE-015 |
| `git-mergetool` | ancillarymanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | TOOLS-001 |
| `git-mktag` | plumbingmanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | OBJECT-005 |
| `git-mktree` | plumbingmanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | OBJECT-003 |
| `git-multi-pack-index` | plumbingmanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REF-013 |
| `git-mv` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INDEX-013, PATH-002, LAYER-009 |
| `git-name-rev` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-009 |
| `git-notes` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-011 |
| `git-p4` | foreignscminterface | OFFICIAL_BRIDGE_INVENTORY_ONLY | LEGACY-004 |
| `git-pack-objects` | plumbingmanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REF-011 |
| `git-pack-redundant` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REF-012 |
| `git-pack-refs` | ancillarymanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REF-001, RECOVERY-013, HARNESS-008 |
| `git-patch-id` | purehelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PATCH-007 |
| `git-prune` | ancillarymanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REF-010 |
| `git-prune-packed` | plumbingmanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REF-009 |
| `git-pull` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REMOTE-005, REMOTE-006 |
| `git-push` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REMOTE-007, REMOTE-008, REMOTE-009, REMOTE-010, REMOTE-011, REMOTE-012, REMOTE-013, REMOTE-015, REMOTE-016, PROTO-004, HOOK-006, HOOK-007 |
| `git-quiltimport` | foreignscminterface | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PATCH-012 |
| `git-range-diff` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-006 |
| `git-read-tree` | plumbingmanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INDEX-016, INDEX-019, OBJECT-006 |
| `git-rebase` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | COMMIT-009, REWRITE-001, REWRITE-002, REWRITE-003, REWRITE-004, REWRITE-005, REWRITE-006, HOOK-003, HOOK-004 |
| `git-receive-pack` | synchelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REMOTE-012, PROTO-002, HOOK-007 |
| `git-reflog` | ancillarymanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | COMMIT-013, STASH-013, REF-008 |
| `git-refs` | ancillarymanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REF-005, REF-006 |
| `git-remote` | ancillarymanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REMOTE-001, REMOTE-014 |
| `git-repack` | ancillarymanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REF-009 |
| `git-replace` | ancillarymanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REF-007 |
| `git-replay` | plumbingmanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REWRITE-014 |
| `git-repo` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | ENV-012, REF-014 |
| `git-request-pull` | foreignscminterface | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PATCH-012 |
| `git-rerere` | ancillaryinterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | MERGE-012 |
| `git-reset` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INDEX-015, REWRITE-012, REWRITE-013, MODEL-007 |
| `git-restore` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INDEX-014, MERGE-010, PATH-006, MODEL-006 |
| `git-rev-list` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | COMMIT-005, MERGE-001, REWRITE-001, REWRITE-005, REWRITE-014, REWRITE-015, REMOTE-005, INSPECT-006, REF-007, REF-013, RECOVERY-006, HARNESS-007 |
| `git-rev-parse` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | ENV-003, ENV-004, ENV-005, ENV-010, ENV-011, ENV-014, INIT-004, INIT-008, INIT-012, BRANCH-011, WORKTREE-001, WORKTREE-004, WORKTREE-009, REF-004, LAYOUT-001, LAYOUT-002, LAYOUT-003, LAYOUT-004, LAYOUT-005, LAYOUT-007, LAYOUT-008, LAYOUT-012, HARNESS-013 |
| `git-revert` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REWRITE-010, REWRITE-011 |
| `git-rm` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INDEX-012, LAYER-008 |
| `git-send-email` | foreignscminterface | OFFICIAL_HEADLESS_WHEN_AVAILABLE | LEGACY-001 |
| `git-send-pack` | synchingrepositories | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PROTO-002 |
| `git-sh-i18n` | purehelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | TOOLS-009 |
| `git-sh-setup` | purehelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | TOOLS-009 |
| `git-shell` | synchelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PROTO-007 |
| `git-shortlog` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-010 |
| `git-show` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INDEX-011, COMMIT-003, REWRITE-010, PATH-007, INSPECT-005 |
| `git-show-branch` | ancillaryinterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-013 |
| `git-show-index` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REF-011 |
| `git-show-ref` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INIT-003, INIT-005, INIT-006, INIT-007, COMMIT-013, COMMIT-014, BRANCH-010, BRANCH-016, BRANCH-019, STASH-008, REMOTE-003, REMOTE-004, REMOTE-011, INSPECT-011, PATCH-011, REF-001, REF-002, REF-003, REF-006, TOOLS-014, LAYER-002, LAYER-014, LAYER-016, LAYOUT-004, LAYOUT-010, MODEL-002, MODEL-004, MODEL-009, MODEL-010 |
| `git-sparse-checkout` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | WORKTREE-010, WORKTREE-011 |
| `git-stage` | unclassified-in-upstream | OFFICIAL_HEADLESS_WHEN_AVAILABLE | TOOLS-010 |
| `git-stash` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REWRITE-006, STASH-001, STASH-002, STASH-003, STASH-004, STASH-005, STASH-006, STASH-007, STASH-008, STASH-009 |
| `git-status` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | ENV-003, ENV-005, ENV-009, ENV-011, ENV-013, INIT-002, INIT-012, INDEX-003, INDEX-004, COMMIT-002, BRANCH-003, BRANCH-006, BRANCH-017, MERGE-003, MERGE-011, REWRITE-003, REWRITE-007, REWRITE-012, REWRITE-013, STASH-001, STASH-002, STASH-006, WORKTREE-008, WORKTREE-013, PATH-003, PATH-015, INSPECT-001, PATCH-006, LAYER-001, LAYER-004, LAYER-007, LAYER-011, LAYER-012, RECOVERY-002, RECOVERY-004, RECOVERY-008, RECOVERY-009, RECOVERY-014, HARNESS-001, HARNESS-002, HARNESS-008, HARNESS-009, HARNESS-010, MODEL-006 |
| `git-stripspace` | purehelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | TOOLS-007 |
| `git-submodule` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | WORKTREE-007, WORKTREE-008, WORKTREE-009 |
| `git-svn` | foreignscminterface | OFFICIAL_BRIDGE_INVENTORY_ONLY | LEGACY-003 |
| `git-switch` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | BRANCH-002, BRANCH-003, BRANCH-004, BRANCH-007, BRANCH-008, BRANCH-013, BRANCH-014, BRANCH-017, BRANCH-018, BRANCH-020, RECOVERY-012 |
| `git-symbolic-ref` | plumbingmanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | BRANCH-001, BRANCH-007, BRANCH-009, BRANCH-016, BRANCH-017, BRANCH-020, WORKTREE-003, WORKTREE-014, REF-004 |
| `git-tag` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-012, HOOK-011 |
| `git-unpack-file` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | OBJECT-010 |
| `git-unpack-objects` | plumbingmanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REF-011 |
| `git-update-index` | plumbingmanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | WORKTREE-011, WORKTREE-012, WORKTREE-013, PATH-010, OBJECT-009, LAYOUT-011 |
| `git-update-ref` | plumbingmanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REF-002, REF-003, LAYER-014, LAYER-015, RECOVERY-001, RECOVERY-003, RECOVERY-006, RECOVERY-011, RECOVERY-013, HOOK-008, MODEL-008 |
| `git-update-server-info` | synchingrepositories | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PROTO-005 |
| `git-upload-archive` | synchelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PROTO-008 |
| `git-upload-pack` | synchelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | PROTO-001, PROTO-009 |
| `git-url-parse` | purehelpers | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REMOTE-014 |
| `git-var` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | ENV-006, ENV-010, COMMIT-006 |
| `git-verify-commit` | ancillaryinterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | COMMIT-011, HOOK-011 |
| `git-verify-pack` | plumbinginterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | REF-009, REF-012 |
| `git-verify-tag` | ancillaryinterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-012, HOOK-011 |
| `git-version` | ancillaryinterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | ENV-001, ENV-002, ENV-013, BRANCH-018, TOOLS-011, LAYOUT-006, HARNESS-003, HARNESS-011, HARNESS-012, HARNESS-022 |
| `git-whatchanged` | ancillaryinterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INSPECT-014 |
| `git-worktree` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | WORKTREE-001, WORKTREE-002, WORKTREE-003, WORKTREE-004, WORKTREE-005, WORKTREE-006, WORKTREE-014, LAYOUT-008 |
| `git-write-tree` | plumbingmanipulators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | INDEX-016, INDEX-019, INDEX-020, OBJECT-007, LAYOUT-011 |
| `gitk` | mainporcelain | OFFICIAL_GUI_INVENTORY_ONLY | TOOLS-002 |
| `gitweb` | ancillaryinterrogators | OFFICIAL_HEADLESS_WHEN_AVAILABLE | TOOLS-003 |
| `scalar` | mainporcelain | OFFICIAL_HEADLESS_WHEN_AVAILABLE | TOOLS-004 |

## Guias

`gitcore-tutorial`, `gitcredentials`, `gitcvs-migration`, `gitdatamodel`, `gitdiffcore`, `giteveryday`, `gitfaq`, `gitglossary`, `gitnamespaces`, `gitremote-helpers`, `gitsubmodules`, `gittutorial`, `gittutorial-2`, `gitworkflows`


## Interfaces de usuário/repositório

`gitattributes`, `gitcli`, `githooks`, `gitignore`, `gitmailmap`, `gitmodules`, `gitrepository-layout`, `gitrevisions`


## Formatos e protocolos

`gitformat-bundle`, `gitformat-chunk`, `gitformat-commit-graph`, `gitformat-index`, `gitformat-pack`, `gitformat-signature`, `gitprotocol-capabilities`, `gitprotocol-common`, `gitprotocol-http`, `gitprotocol-pack`, `gitprotocol-v2`

## Distinções obrigatórias

Comando oficial opcional indisponível, compatibilidade externa adiada, GUI não executada, teste não implementado e feature ausente do produto são classificações distintas. O relatório deve mantê-las, não agrupar tudo como skip.
Não desenvolver nem certificar outro aplicativo git-layer. Roteiros de segurança de PATH/destino ocupado usam apenas sentinelas de fixture e não significam compatibilidade com terceiros.
