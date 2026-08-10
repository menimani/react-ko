import { spawn } from 'node:child_process'
import { openSync } from 'node:fs'
import type { Runner, RunnerStartOptions } from './runner.ts'

// The spec file is streamed to codex over stdin — `codex exec` reads its
// instructions there when no prompt argument is given. Passing the spec as an
// argv entry truncated prompts on Windows, where node serializes argv into a
// command line that MSYS bash re-parses: scan 025 received its checklist cut
// mid-sentence that way. The final message lands in --output-last-message,
// which is the only place the core reads completion markers from. Effort maps
// to the codex-specific `model_reasoning_effort` config key here, not in the
// core.
function buildArgs(options: RunnerStartOptions): string[] {
  const args = [
    'exec',
    '--dangerously-bypass-approvals-and-sandbox',
    '--output-last-message', options.finalMessageFile,
  ]
  if (options.model !== undefined && options.model !== '') {
    args.push('--model', options.model)
  }
  args.push('--config', `model_reasoning_effort=${options.effort}`)
  return args
}

export function createCodexRunner(): Runner {
  return {
    start(options: RunnerStartOptions): Promise<number> {
      const args = buildArgs(options)
      // startTask clears this file before setup; append so setup output remains ahead
      // of the runner transcript instead of being silently truncated here.
      const logFd = openSync(options.logFile, 'a')
      // A file descriptor rather than a pipe: the child is detached and must
      // keep reading the spec after this process lets go of it.
      const specFd = openSync(options.specFile, 'r')

      // On Windows the `codex` on PATH is an npm .cmd shim, which Node cannot spawn
      // without a shell. Git Bash is already a hard requirement of this repository,
      // so route through `bash -c` with positional arguments; every remaining
      // argument is short ASCII, and the prompt itself never touches argv.
      const viaBash = process.platform === 'win32'
      const command = viaBash ? 'bash' : 'codex'
      const commandArgs = viaBash
        ? ['-c', 'exec codex "$@"', 'codex', ...args]
        : args

      return new Promise((resolve, reject) => {
        const child = spawn(command, commandArgs, {
          cwd: options.worktree,
          detached: true,
          stdio: [specFd, logFd, logFd],
          windowsHide: true,
        })
        child.once('error', reject)
        child.once('spawn', () => {
          child.unref()
          if (child.pid === undefined) {
            reject(new Error('codex spawned without a PID'))
            return
          }
          resolve(child.pid)
        })
      })
    },
  }
}
