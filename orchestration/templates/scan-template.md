# {{SCAN_ID}}

## Purpose

Investigate the codebase and report improvements as NEXT_TASK. **No code changes**.

{{SCAN_SCOPE}}

## Final message contract — read this before anything else

Your final message is parsed by a machine, line by line, and it is the ONLY
thing read from this task. Work that is not encoded in it is lost. The final
message consists of nothing but:

1. One line per finding, each starting exactly with `NEXT_TASK: ` or
   `DECISION_REQUIRED: ` — never a heading, a bullet list, a table, or a
   numbered summary. A finding wrapped in any other shape is silently
   discarded, and past scans have lost every finding this way.
2. `NO_FINDINGS` on its own line instead, when there is nothing to report.
3. `TASK_COMPLETE` as the last line, always. Without it this task is recorded
   as failed even when the investigation succeeded.

Surveys, section-by-section notes, and prose belong in your working output,
not in the final message.

## Investigation procedure

Perform in the following order. Run the commands and check the results before reading each section.

### 1. Automatic check

```bash
npm run test 2>&1 | tail -40
```
```bash
npm run build 2>&1 | tail -30
```
```bash
cd orchestration/ts && npm run typecheck 2>&1 | tail -20
```

If there are build errors or test failures, record them as NEXT_TASK. The build is also
the type gate: tsup emits declarations, so a type error surfaces there, not in a lint.

---

### 2. Bug investigation

Read every file under `src/` and look for bugs in the React–Knockout boundary. The
library's whole job is keeping two frameworks' lifecycles honest with each other, so the
shapes worth searching for by shape are boundary shapes:

- **A DOM node both frameworks think they own.** Knockout's `foreach`, `if` and
  `template` bindings remove, clone, or re-create child nodes; React holds fibers for the
  originals. Any component that puts React-rendered children inside such a binding can
  break on React re-render or unmount. Say which binding, which child, and what sequence
  breaks it.
- **A binding that never applies.** `ko.applyBindings` runs once at the root's mount.
  A `data-bind` node that React mounts later (conditional render, route change, a row
  added by a React-driven list) is silently unbound. Check every path that can mount a
  scope after the root has bound.
- **A registration without its cleanup.** `ko.computed` and subscriptions created in a
  component need disposal on unmount; keys written into the root ViewModel need deletion;
  `ko.cleanNode` where Knockout was given DOM. StrictMode double-invokes effects in
  development, so registration and cleanup must be idempotent.
- **A dependency Knockout cannot see.** `with: $root['<key>']` reads a plain property:
  replacing the viewModel prop after binding re-registers the key but nothing re-binds.
  Report places where a prop change looks like it updates the binding but does not.

Checks:
- null/undefined access without `?.`, missing null check
- Missing error handling of async/await (no catch, crushed error)
- Empty array/undefined case processing omission (unprocessed for map/find/filter result)
- Type inconsistency (abuse of type assertion `as X`, `unknown[]` where a generic fits)

---

### 3. Public API and type-safety investigation

Read `src/index.ts` and every exported signature as a consumer would.

Checks:
- Props typed looser than the implementation requires (`unknown[]` items, `any`
  leaks, missing generics where the caller loses its element type)
- Exports that are implementation details rather than API
- Signatures that TypeScript and JavaScript consumers experience differently
- Accepted prop shapes that are undocumented, or documented shapes not accepted
  (`Observable` vs `Computed` vs plain value)

---

### 4. Investigation of missing capabilities

Read the components and the READMEs to find capability gaps a user hits early.

The design premise is in `CLAUDE.md` and it constrains what counts as a finding here:
the library absorbs Knockout into JSX without multiplying components, and `data-bind`
stays the user-facing surface. A proposal that adds a parallel React-side API
(exported hooks exposing observables as React state, observer wrappers) contradicts a
recorded decision — report the tension as a finding only if the code has started to
contradict the decision, and propose nothing that quietly crosses it.

Checks:
- Knockout control-flow bindings with no structural component counterpart (`with`,
  `using`, `let`) where users plainly need one
- Components whose children cannot contain other React components without breaking —
  a composition limit is a capability gap, not a style choice
- Error behaviour: what a user sees when a binding string is wrong, and whether the
  library could fail louder without new API

---

### 5. Test code investigation

Read test files under `tests/` and look for unnecessary or problematic tests.

Checks:
- Meaningless tests that always pass (`expect(true).toBe(true)`, etc.)
- Deviation from implementation (tests that pass even if implementation is changed, too many mocks, nothing tested)
- Testing the same content over and over again
- Testing removed features/non-existent components
- Assertions on Knockout internals (comment nodes, generated scope keys) instead of
  rendered DOM

---

### 6. Untested behavior survey

There is no coverage gate; enumerate instead. List every export from `src/index.ts`,
find its tests under `tests/`, and compare what the tests exercise against what the
component does.

**Counting lines is not the goal.** What you should report is "untested behavior",
not "uncovered lines".

Perspectives you may report:
- A prop that accepts observable, computed, and plain value, with only one variant tested
- Unmount and cleanup paths (subscription disposal, scope key deletion) with no test
- Reactive updates (array push/splice, condition toggling) tested only for initial render
- The deprecated compat components, which must keep working until v2.0.0, with no test
  pinning that

What not to report:
- Re-export lines in `index.ts`, type-only declarations
- Assignments to the effect that "file is N%, so raise it"

---

### 7. Documentation accuracy

`README.md` and `README.ja.md` are the product surface. When the code moves and a README
does not, the page starts actively misleading whoever reads it next.

Checks:
- Every code example against the current API — copy it into a scratch file mentally and
  ask whether it compiles and binds
- Claimed peer versions against `package.json` (`react`, `react-dom`, `knockout`)
- The deprecation notice against the exported compat components
- The folder-structure listing against the actual tree — a listing that duplicates what
  the repository already enumerates drifts by construction; report it for deletion
  rather than for updating when it cannot be maintained
- `orchestration/CLAUDE.md` and `orchestration/ts/SPEC.md` claims against the
  orchestration source, where the diff has touched it

Report a mismatch as `[DOCS]` naming the page, the claim, and what the source actually
says. Do not report a page merely for being brief.

---

### 8. Language and README parity

Code, comments, tests, commit messages, and documentation are written in English.
Japanese belongs only in `README.ja.md`.

`README.md` and `README.ja.md` are translations of each other: read them side by side
and report any section present, changed, or deleted in one but not the other. Parity of
meaning is the requirement, not word-for-word alignment.

Do not use `grep` with CJK character ranges to hunt for Japanese: Git Bash on Windows
mishandles them and reports every em dash and emoji as a hit. Read the files.

Report violations as `[DOCS]`, grouped by file where one file has several.

---

### 9. Dependency advisories

Dependabot watches the lockfiles and raises an alert per advisory. Read the open ones and
decide which of them this repository actually has to act on.

```bash
gh api 'repos/{owner}/{repo}/dependabot/alerts' --jq '[.[] | select(.state=="open") | {number, severity: .security_advisory.severity, pkg: .dependency.package.name, manifest: .dependency.manifest_path, current: .security_vulnerability.vulnerable_version_range, patched: .security_vulnerability.first_patched_version.identifier, summary: .security_advisory.summary}]'
```

The endpoint has no leading slash on purpose. Git Bash on Windows rewrites a leading `/`
into a filesystem path, and `gh` then fails with `invalid API endpoint`.

`gh api 'repos/{owner}/{repo}/dependabot/alerts/<number>' --jq .security_advisory.description`
gives the full advisory text for one alert, which is where the conditions are stated.

**Every open alert is a finding.** This package ships no runtime dependencies, so most
alerts land in devDependencies — that lowers urgency, not whether to report. Say in the
finding whether the vulnerable path can reach a consumer of the published package
(usually it cannot) or only this repository's own toolchain.

- **Inside the same major version** it is a routine bump. Report it as `NEXT_TASK`.
- **Across a major version** it is a migration whose breaking changes are not yours to
  accept. Report it as `DECISION_REQUIRED` and change nothing. Give whoever decides what
  they need: the advisory, the versions involved, whether the vulnerable path is
  reachable here, the breaking changes the release notes list, and the tests that cover
  the call sites.

```bash
npm audit 2>&1 | tail -30
```

Judge those the same way. Do not report a transitive advisory whose only fix is
`npm audit fix --force`, which downgrades or breaks the direct dependency — say what it
would do instead.

---

### 10. Redundancy — keep only what is needed

Read source comments, documentation pages, and exported code looking for material whose
deletion loses nothing. The scan must look for things to delete, not only things to fix.

Checks:
- Comments that restate what the adjacent code already says, or narrate history such as
  "changed X to Y" instead of stating a constraint the code cannot show
- Dead code: unused exports, unreachable branches, test helpers nothing imports
- README sections that record no decision and duplicate what the source states
- Over-long implementations where a plainly simpler equivalent already exists in the
  same file's own idiom

A deletion finding must name the evidence that nothing references the item, including
the grep or usage search performed. Redundant tests belong to section 5, not here, and
comments that state real constraints stay. Report findings as `NEXT_TASK` with category
`DOCS` for documentation and comments, and `BUG` for dead code. Phrase every finding as
a deletion — for example, "remove X because nothing references it" — never as a rewrite.

---

## Output

After completing the investigation, output **actual issues only** found in the following format (one line per issue).
Format: `NEXT_TASK: [category] specific description → fix approach`
The category is `BUG` / `API` / `FEATURE` / `TEST` / `DOCS` / `SECURITY`.

**Rules:**
- Write all NEXT_TASK and DECISION_REQUIRED findings in English
- Report only what is definitely determined to be a problem (do not report guesses or possibilities)
- Write each explanation concretely to the level that the implementer can implement it without asking questions (clarify file path, method name, and modification method)
- Up to 8 items in order of priority
- No code changes
- Do not output format examples or placeholders. Outputs only the issues actually discovered.

If no problem is found, print `NO_FINDINGS` on its own line and do not output any
`NEXT_TASK` lines. If a problem is found, output its `NEXT_TASK` line(s) and do not print
`NO_FINDINGS`.

### Findings that are not yours to act on

A `NEXT_TASK` becomes work an agent carries out. Where the finding is a choice rather than
a defect — a major version upgrade, a public API change, anything crossing the design
decisions `CLAUDE.md` records — report it on its own line instead, and make no change:

`DECISION_REQUIRED: what the choice is, what each way costs, and what you would need to know to make it`

These are logged and carried into the pull request rather than queued, so a person decides
and nothing is upgraded on their behalf. Same rules as above: one line each, no format
examples, only what you actually found.

## Completion marker

Finally print the following on its own line:
TASK_COMPLETE
