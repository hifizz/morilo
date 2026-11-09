## Summary

<!-- Why is this change needed? One or two sentences of motivation, not a
restatement of the diff. -->

## Changelog

- [ ] User-facing change: recorded in `CHANGELOG.md` under
      `## [Unreleased]` (renamed to `## [<version>] - <date>` at release;
      builds fail when the released version has no section)
- [ ] Internal change only (CI, tooling, docs, refactoring) — no entry needed

## Test plan

<!-- How was this verified? Check what applies, add commands/output. -->

- [ ] `go test ./...`
- [ ] `npm --prefix frontend run test:markdown` (if chat rendering changed)
- [ ] UI change verified with `MYGO_SELFTEST=1 npx mygo dev` screenshot or
      manual check
