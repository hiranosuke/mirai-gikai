# 議会資料アーカイブ（assembly-archive）progress

Plan: docs/superpowers/plans/2026-06-20-assembly-archive.md
Branch: saitama/assembly-archive-spec
Base: 8be5888

Task 1: complete (commit 8be5888..07a9943, deps+types+constants, review clean)
Task 2: complete (commit 07a9943..067fc25, parseFolderList, 3/3 tests, review clean)
  Minor (final-review triage): parse-folder-list.ts class="img" filter uses strict equality; fragile if extra classes appear.
Task 3: complete (commit 067fc25..2533ea4, parseDocView, 3/3 tests, review clean)
Task 4: complete (commit 2533ea4..c4a1f22, parseFolderPath, 2/2 tests, review clean)
Task 5: complete (commit c4a1f22..d2fc1ea, discussCabinetClient, 2/2 tests, review clean)
Task 6: complete (commit d2fc1ea..4b8109b, loaders, 2/2 tests, review clean)
Task 7: complete (commit 4b8109b..db26aa1, Server Actions, typecheck pass, review clean)
Task 8: complete (commit db26aa1..2add0a4, routes/nav/page, routes.test pass, review clean)
Task 9: complete (commit 2add0a4..ba8c610, client components, tsc+admin build pass, review clean)
  Resolved (by-design, not a defect): entry-URL link w/o docid deep-link — spec §2 mandates this (POST-based nav can't deep-link).
  Minor (final-review triage): copy button has no setCopied(false) reset timeout (stays "コピーしました" until next selection); <pre> bg-muted has no explicit text-muted-foreground.
Task 10: complete (lint exit0 after biome fmt commit, typecheck 7/7, test web 837 + admin 483, build OK /assembly-archive present)

Final whole-branch review (opus): Ready to merge = Yes (no Critical/Major).
Applied 3 minor fixes (commit d1f9c3e): #1 error-message leak (instanceof DiscussCabinetParseError branch), #2 20s AbortSignal.timeout (spec §4), #5 dead FolderNode re-export. Plus lint fix 4c6810e (useOptionalChain).
Deferred (acceptable/by-design): session warm-up per request, same-doc refetch, positional row parsing brittleness, bodyText whitespace collapse.
ALL TASKS COMPLETE. Gates: lint exit0 / typecheck 7/7 / test web837+admin483 / build OK.
