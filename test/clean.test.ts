import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { cleanRepository } from '../src/services/clean'

it('prunes stale remote branches, fetches tags, and preserves local-only tags and branches', () => {
  const root = mkdtempSync(join(tmpdir(), 'qkpr-clean-'))
  const originalCwd = process.cwd()
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  try {
    process.chdir(root)
    git('init', '--bare', 'remote.git')
    git('init', 'source')
    process.chdir(join(root, 'source'))
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '--allow-empty', '-m', 'initial')
    git('remote', 'add', 'origin', join(root, 'remote.git'))
    git('push', 'origin', 'HEAD:refs/heads/main', 'HEAD:refs/heads/stale')
    process.chdir(root)
    git('clone', '--branch', 'main', join(root, 'remote.git'), 'client')
    process.chdir(join(root, 'source'))
    git('push', 'origin', '--delete', 'stale')
    git('tag', 'remote-tag')
    git('push', 'origin', '--tags')
    process.chdir(join(root, 'client'))
    git('tag', 'local-tag')
    git('branch', 'local-branch')
    git('config', 'fetch.pruneTags', 'true')
    cleanRepository()
    expect(git('branch', '-r')).not.toContain('origin/stale')
    expect(git('tag', '--list').split('\n')).toEqual(['local-tag', 'remote-tag'])
    expect(git('branch', '--list', 'local-branch')).toContain('local-branch')
  }
  finally {
    process.chdir(originalCwd)
    rmSync(root, { recursive: true, force: true })
  }
})
