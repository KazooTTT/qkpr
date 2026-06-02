import { execSync } from 'node:child_process'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMergeBranch, deleteMergeBranches, fastForwardLocalTarget, getMergeBranches, getTargetSyncStatus, isMergeBranchName } from '../src/services/pr'

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}))

const execSyncMock = vi.mocked(execSync)

describe('createMergeBranch', () => {
  beforeEach(() => {
    execSyncMock.mockReset()
  })

  it('bases the merge branch on the local target branch', () => {
    const commands: string[] = []

    execSyncMock.mockImplementation((command: string) => {
      commands.push(command)

      if (command === 'git rev-parse --verify refs/heads/merge/feature-to-main')
        throw new Error('missing merge branch')
      if (command === 'git rev-parse --verify refs/heads/main')
        return ''
      if (command === 'git branch merge/feature-to-main main')
        return ''
      if (command === 'git checkout merge/feature-to-main')
        return ''

      throw new Error(`Unexpected command: ${command}`)
    })

    expect(createMergeBranch('main', 'merge/feature-to-main')).toBe(true)
    expect(commands).toEqual([
      'git rev-parse --verify refs/heads/merge/feature-to-main',
      'git rev-parse --verify refs/heads/main',
      'git branch merge/feature-to-main main',
      'git checkout merge/feature-to-main',
    ])
  })

  it('falls back to origin/target when no local branch exists', () => {
    const commands: string[] = []

    execSyncMock.mockImplementation((command: string) => {
      commands.push(command)

      if (command === 'git rev-parse --verify refs/heads/merge/feature-to-release')
        throw new Error('missing merge branch')
      if (command === 'git rev-parse --verify refs/heads/release')
        throw new Error('missing local ref')
      if (command === 'git rev-parse --verify refs/remotes/origin/release')
        return ''
      if (command === 'git branch merge/feature-to-release origin/release')
        return ''
      if (command === 'git checkout merge/feature-to-release')
        return ''

      throw new Error(`Unexpected command: ${command}`)
    })

    expect(createMergeBranch('release', 'merge/feature-to-release')).toBe(true)
    expect(commands).toEqual([
      'git rev-parse --verify refs/heads/merge/feature-to-release',
      'git rev-parse --verify refs/heads/release',
      'git rev-parse --verify refs/remotes/origin/release',
      'git branch merge/feature-to-release origin/release',
      'git checkout merge/feature-to-release',
    ])
  })

  it('checks out the existing merge branch and hard resets it to the local target base', () => {
    const commands: string[] = []

    execSyncMock.mockImplementation((command: string) => {
      commands.push(command)

      if (command === 'git rev-parse --verify refs/heads/merge/feature-to-main')
        return ''
      if (command === 'git rev-parse --verify refs/heads/main')
        return ''
      if (command === 'git checkout merge/feature-to-main')
        return ''
      if (command === 'git reset --hard main')
        return ''

      throw new Error(`Unexpected command: ${command}`)
    })

    expect(createMergeBranch('main', 'merge/feature-to-main')).toBe(true)
    expect(commands).toEqual([
      'git rev-parse --verify refs/heads/merge/feature-to-main',
      'git rev-parse --verify refs/heads/main',
      'git checkout merge/feature-to-main',
      'git reset --hard main',
    ])
  })
})

describe('getTargetSyncStatus', () => {
  beforeEach(() => {
    execSyncMock.mockReset()
  })

  it('reports the local target as fast-forwardable when it is strictly behind origin', () => {
    const commands: string[] = []

    execSyncMock.mockImplementation((command: string) => {
      commands.push(command)

      if (command === 'git fetch origin refs/heads/main:refs/remotes/origin/main')
        return ''
      if (command === 'git rev-parse --verify refs/heads/main')
        return ''
      if (command === 'git rev-parse --verify refs/remotes/origin/main')
        return ''
      if (command === 'git rev-list --count refs/heads/main..refs/remotes/origin/main')
        return '2'
      if (command === 'git rev-list --count refs/remotes/origin/main..refs/heads/main')
        return '0'

      throw new Error(`Unexpected command: ${command}`)
    })

    expect(getTargetSyncStatus('main')).toEqual({
      hasLocal: true,
      hasRemote: true,
      behind: 2,
      ahead: 0,
      canFastForward: true,
    })
    expect(commands).toEqual([
      'git fetch origin refs/heads/main:refs/remotes/origin/main',
      'git rev-parse --verify refs/heads/main',
      'git rev-parse --verify refs/remotes/origin/main',
      'git rev-list --count refs/heads/main..refs/remotes/origin/main',
      'git rev-list --count refs/remotes/origin/main..refs/heads/main',
    ])
  })

  it('marks a diverged target as not fast-forwardable', () => {
    execSyncMock.mockImplementation((command: string) => {
      if (command === 'git fetch origin refs/heads/main:refs/remotes/origin/main')
        return ''
      if (command === 'git rev-parse --verify refs/heads/main')
        return ''
      if (command === 'git rev-parse --verify refs/remotes/origin/main')
        return ''
      if (command === 'git rev-list --count refs/heads/main..refs/remotes/origin/main')
        return '1'
      if (command === 'git rev-list --count refs/remotes/origin/main..refs/heads/main')
        return '3'

      throw new Error(`Unexpected command: ${command}`)
    })

    expect(getTargetSyncStatus('main')).toEqual({
      hasLocal: true,
      hasRemote: true,
      behind: 1,
      ahead: 3,
      canFastForward: false,
    })
  })

  it('skips commit counting when the remote branch is missing', () => {
    const commands: string[] = []

    execSyncMock.mockImplementation((command: string) => {
      commands.push(command)

      if (command === 'git fetch origin refs/heads/feature:refs/remotes/origin/feature')
        throw new Error('no upstream')
      if (command === 'git rev-parse --verify refs/heads/feature')
        return ''
      if (command === 'git rev-parse --verify refs/remotes/origin/feature')
        throw new Error('missing remote ref')

      throw new Error(`Unexpected command: ${command}`)
    })

    expect(getTargetSyncStatus('feature')).toEqual({
      hasLocal: true,
      hasRemote: false,
      behind: 0,
      ahead: 0,
      canFastForward: false,
    })
    expect(commands).toEqual([
      'git fetch origin refs/heads/feature:refs/remotes/origin/feature',
      'git rev-parse --verify refs/heads/feature',
      'git rev-parse --verify refs/remotes/origin/feature',
    ])
  })
})

describe('fastForwardLocalTarget', () => {
  beforeEach(() => {
    execSyncMock.mockReset()
  })

  it('fast-forwards the local target via a fetch refspec', () => {
    const commands: string[] = []

    execSyncMock.mockImplementation((command: string) => {
      commands.push(command)
      if (command === 'git fetch origin main:main')
        return ''
      throw new Error(`Unexpected command: ${command}`)
    })

    expect(fastForwardLocalTarget('main')).toBe(true)
    expect(commands).toEqual(['git fetch origin main:main'])
  })

  it('returns false when the fast-forward fetch fails', () => {
    execSyncMock.mockImplementation((command: string) => {
      if (command === 'git fetch origin main:main')
        throw new Error('non-fast-forward')
      throw new Error(`Unexpected command: ${command}`)
    })

    expect(fastForwardLocalTarget('main')).toBe(false)
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
      localDeleted: ['merge/feature-to-main'],
      remoteDeleted: [],
      localFailed: ['feature/not-allowed'],
      remoteFailed: [],
    })
    expect(commands).toEqual(['git branch -D merge/feature-to-main'])
  })

  it('can delete both local and remote merge branches and report each side separately', () => {
    const commands: string[] = []

    execSyncMock.mockImplementation((command: string) => {
      commands.push(command)

      if (command === 'git branch -D merge/feature-to-main')
        return ''
      if (command === 'git push origin --delete merge/feature-to-main')
        return ''
      if (command === 'git branch -D merge/feature-to-pre')
        throw new Error('missing local branch')
      if (command === 'git push origin --delete merge/feature-to-pre')
        return ''

      throw new Error(`Unexpected command: ${command}`)
    })

    expect(deleteMergeBranches(
      ['merge/feature-to-main', 'merge/feature-to-pre'],
      { remote: true },
    )).toEqual({
      localDeleted: ['merge/feature-to-main'],
      remoteDeleted: ['merge/feature-to-main', 'merge/feature-to-pre'],
      localFailed: ['merge/feature-to-pre'],
      remoteFailed: [],
    })
    expect(commands).toEqual([
      'git branch -D merge/feature-to-main',
      'git push origin --delete merge/feature-to-main',
      'git branch -D merge/feature-to-pre',
      'git push origin --delete merge/feature-to-pre',
    ])
  })
})
