export default {
  test: {
    include: ['orchestration/project/tests/**/*.test.ts'],
    pool: process.platform === 'win32' ? 'threads' : 'forks',
  },
}
