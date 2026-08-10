## Known pitfalls — check your diff against every line before committing

<!-- Curation: at most 20 entries. A pattern earns a line only after reviews flagged it
     twice. At the cap, drop the lowest-impact entry to admit a new one; if a dropped
     pattern recurs, restore its line and let the list exceed the cap. -->

- Verify each claim against the current source or config before writing it down; run every code example against the exported API in your head, checking it compiles and binds.
- README.md and README.ja.md are translations of each other: a section added, changed, or deleted in one changes in the other in the same commit.
- Search for the value being changed and update every document that states it.
- Describe behaviour as it is, not as a commit intended it to be.
