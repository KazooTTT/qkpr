import { execSync } from 'node:child_process'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMergeBranch, deleteMergeBranches, getMergeBranches, isMergeBranchName } from '../src/services/pr'

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}))

const execSyncMock = vi.mocked(execSync)

describe('createMergeBranch', () => {
  beforeEach(() => {
    execSyncMock.mockReset()
  })

  it('prefers the refreshed remote target branch over a stale local branch', () => {
    const commands: string[] = []

    execSyncMock.mockImplementation((command: string) => {
      commands.push(command)

      if (command === 'git fetch origin refs/heads/main:refs/remotes/origin/main')
        return ''
      if (command === 'git rev-parse --verify refs/remotes/origin/main')
        return ''
      if (command === 'git branch merge/feature-to-main origin/main')
        return ''
      if (command === 'git checkout merge/feature-to-main')
        return ''

      throw new Error(`Unexpected command: ${command}`)
    })

    expect(createMergeBranch('main', 'merge/feature-to-main')).toBe(true)
    expect(commands).toEqual([
      'git fetch origin refs/heads/main:refs/remotes/origin/main',
      'git rev-parse --verify refs/remotes/origin/main',
      'git branch merge/feature-to-main origin/main',
      'git checkout merge/feature-to-main',
    ])
  })

  it('falls back to the local target branch when the remote branch is unavailable', () => {
    const commands: string[] = []

    execSyncMock.mockImplementation((command: string) => {
      commands.push(command)

      if (command === 'git fetch origin refs/heads/release:refs/remotes/origin/release')
        throw new Error('fetch failed')
      if (command === 'git rev-parse --verify refs/remotes/origin/release')
        throw new Error('missing remote ref')
      if (command === 'git rev-parse --verify refs/heads/release')
        return ''
      if (command === 'git branch merge/feature-to-release release')
        return ''
      if (command === 'git checkout merge/feature-to-release')
        return ''

      throw new Error(`Unexpected command: ${command}`)
    })

    expect(createMergeBranch('release', 'merge/feature-to-release')).toBe(true)
    expect(commands).toEqual([
      'git fetch origin refs/heads/release:refs/remotes/origin/release',
      'git rev-parse --verify refs/remotes/origin/release',
      'git rev-parse --verify refs/heads/release',
      'git branch merge/feature-to-release release',
      'git checkout merge/feature-to-release',
    ])
  })
})

describe('merge branch cleanup', () => {
  beforeEach(() => {
    execSyncMock.mockReset()
  })

  it('identifies merge branches correctly', () => {
    expect(isMergeBranchName('merge/foo-to-main')).toBe(true)
    expect(isMergeBranchName('feature/foo')).toBe(false)
  })

  it('filters merge branches and excludes the current branch', () => {
    execSyncMock.mockReturnValue(`
  feature/foo
* merge/current-to-main
  merge/feature-to-main
  remotes/origin/main
`)

    expect(getMergeBranches('merge/current-to-main')).toEqual(['merge/feature-to-main'])
  })

  it('deletes only merge branches and reports failures for others', () => {
    const commands: string[] = []

    execSyncMock.mockImplementation((command: string) => {
      commands.push(command)

      if (command === 'git branch -D merge/feature-to-main')
        return ''

      throw new Error(`Unexpected command: ${command}`)
    })

    expect(deleteMergeBranches(['merge/feature-to-main', 'feature/not-allowed'])).toEqual({
      deleted: ['merge/feature-to-main'],
      failed: ['feature/not-allowed'],
    })
    expect(commands).toEqual(['git branch -D merge/feature-to-main'])
  })
})
