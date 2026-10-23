import { execFileSync } from 'node:child_process'

/** Refresh remote refs and tags without deleting local branches or pruning tags. */
export function cleanRepository(): void {
  execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'pipe' })
  execFileSync('git', ['fetch', '--all', '--prune', '--tags', '--no-prune-tags'], { stdio: 'inherit' })
}
