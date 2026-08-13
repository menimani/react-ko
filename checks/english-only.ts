// Verifies that what the project produces is written in English, by reporting characters
// outside ASCII that are not on the list of ones English legitimately uses.
//
// Looking for Japanese specifically missed more than it caught. Full-width parentheses
// typed by a Japanese IME, a 203B reference mark sitting in the English documentation, and
// zero-width spaces pasted in from a translation tool are all invisible to a
// hiragana/katakana/kanji range. Starting from "not ASCII" and subtracting what English
// needs catches those, and Cyrillic and Chinese with them.
//
// Run from the repository root: node checks/english-only.ts
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Letters English borrows for proper nouns — São Paulo, café. Latin only: this range
// admits no CJK, Cyrillic or Greek.
const LATIN_DIACRITICS = /[À-ɏ]/

// Typography and symbols the documentation and the sources actually use. Each is here
// because it appears in the tree, not in case it might: an addition should be a decision.
const PUNCTUATION: Set<string> = new Set([
  '—', '–', '…', '·', '«', '»', '’', '‘', '“', '”',  // prose
  '→', '←', '↑', '↓',                                // direction
  '×', '±', '≥', '≤', '≠',                           // arithmetic
  '✓', '✗', '•',                                     // interface glyphs
  '─', '│', '├', '└', '┌', '┐', '┘', '┴', '┬', '┤', '┼',  // directory trees in the docs
])

// Emoji carry no language, so the pictograph planes are allowed wholesale. The range
// stops short of the BMP symbol blocks deliberately: those hold the glyphs listed above,
// and covering them by range would admit several hundred more without anyone deciding to.
const PICTOGRAPH = /[\u{1F300}-\u{1FAFF}\u{FE0F}]/u

// Generated or agent-written output mirrors the sources, so it would double every hit.
const SKIP_DIRS: Set<string> = new Set([
  'node_modules', 'dist', 'coverage', 'build', '.git',
  // Orchestration writes these; they are agent output rather than sources.
  'tasks', 'status', 'logs', 'worktrees', 'queue', 'templates',
  // Written by a local Playwright run. Git ignores both, and a bundled report carries
  // the characters this check looks for.
  'playwright-report', 'test-results', '.work',
])

// The Japanese documentation, and the sources this repository does not own.
const ALLOWED: string[] = [
  // This file necessarily contains the characters it looks for. Matched on the full
  // path so a future file merely named for the rule is still examined.
  'checks/english-only.ts',
  // Documentation is the one thing published in both languages. Every Japanese page
  // pairs with an English one that says the same thing.
  'README.ja.md',
  'docs/ja/',
  // A vendored `git subtree`: these sources belong to menimani/orchestration-core and
  // carry that repository's copy of this rule, so the rule enforced here does not reach
  // them. The remaining orchestration/ paths are this repository's own and stay checked.
  'orchestration/ts/',
  // Rendered copies of the shared orchestration skills, written by the core's sync step
  // rather than by hand here. `.claude/skills/verify-changes` is this repository's own
  // and is checked: it is not part of the synced set.
  '.agents/skills/',
]

const permitted = (ch: string): boolean =>
  ch.codePointAt(0)! < 128 ||
  PUNCTUATION.has(ch) ||
  LATIN_DIACRITICS.test(ch) ||
  PICTOGRAPH.test(ch)

const normalizedPath = (file: string): string => file.replaceAll('\\', '/')

const isGeneratedOutputPath = (file: string): boolean =>
  normalizedPath(file).split('/').some((part) => SKIP_DIRS.has(part))

/** Whether a path is intentionally excluded from the repository language check. */
export const isJapaneseAllowedPath = (file: string): boolean => {
  const normalized = normalizedPath(file)
  return isGeneratedOutputPath(normalized)
    || ALLOWED.some((allowed) => normalized.includes(allowed))
}

export type TextViolation = {
  line: number
  codePoints: string[]
  text: string
}

/** Finds the non-English characters on each violating line of source text. */
export const scanText = (content: string): TextViolation[] =>
  content.split('\n').flatMap((line, index) => {
    const offenders = [...new Set([...line].filter((ch) => !permitted(ch)))]
    if (offenders.length === 0) return []
    return [{
      line: index + 1,
      codePoints: offenders.map((ch) =>
        `U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`),
      text: line.trim().slice(0, 76),
    }]
  })

const CHECKED_SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|sh|html|css|md|json|yml|yaml)$/

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (isGeneratedOutputPath(full)) return []
    if (entry.isDirectory()) return walk(full)
    return CHECKED_SOURCE.test(entry.name) ? [full] : []
  })

// Directories are walked whole rather than listed one by one: naming sub-directories
// meant a new one was never checked. Files at the repository root are named explicitly
// because walking the root would pull in every untracked working file with it.
const ROOTS: string[] = [
  'src', 'starter', 'e2e', 'orchestration', 'checks', '.claude', '.github', '.githooks',
]
const ROOT_FILES: string[] = ['README.md', 'README.ja.md', 'CLAUDE.md', 'AGENTS.md']

const main = (): number => {
  let hits = 0

  const files = [
    ...ROOTS.filter((root) => existsSync(root) && statSync(root).isDirectory()).flatMap(walk),
    ...ROOT_FILES.filter((file) => existsSync(file)),
  ]

  for (const file of files) {
    if (isJapaneseAllowedPath(file)) continue
    for (const violation of scanText(readFileSync(file, 'utf8'))) {
      // Name the code points: a zero-width space is invisible in the report as well.
      console.log(`${file}:${violation.line}: ${violation.codePoints.join(' ')}`)
      console.log(`    ${violation.text}`)
      hits++
    }
  }

  console.log(hits === 0
    ? 'Everything outside the Japanese documentation is English.'
    : `${hits} lines`)
  return hits === 0 ? 0 : 1
}

if (process.argv[1] && resolve(process.argv[1]) === resolve('checks/english-only.ts')) {
  process.exit(main())
}
