import { execFileSync, execSync } from 'node:child_process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { handleUpdateCommand, updatePackage } from '../src/utils/version-check'

vi.mock('node:child_process', () => ({ execFileSync: vi.fn(), execSync: vi.fn() }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  process.exitCode = 0
  vi.restoreAllMocks()
})

it.each([
  ['npm', ['install', '-g', 'qkpr@latest']],
  ['pnpm', ['add', '-g', 'qkpr@latest']],
  ['yarn', ['global', 'add', 'qkpr@latest']],
  ['bun', ['add', '-g', 'qkpr@latest']],
])('updates with %s when detected', (manager, args) => {
  vi.mocked(execSync).mockImplementation((command) => {
    if (String(command).startsWith(`${manager} `))
      return manager === 'yarn' ? '"qkpr"' : 'qkpr'
    throw new Error('not installed')
  })
  updatePackage('qkpr')
  expect(execFileSync).toHaveBeenCalledWith(manager, args, { stdio: 'inherit' })
})

it('falls back to npm when no manager is detected', () => {
  vi.mocked(execSync).mockImplementation(() => {
    throw new Error('missing')
  })
  updatePackage('qkpr')
  expect(execFileSync).toHaveBeenCalledWith('npm', ['install', '-g', 'qkpr@latest'], { stdio: 'inherit' })
})

it('returns a failure status when installation fails', () => {
  vi.mocked(execSync).mockReturnValue('qkpr')
  vi.mocked(execFileSync).mockImplementation(() => {
    throw new Error('installation failed')
  })
  handleUpdateCommand('qkpr')
  expect(process.exitCode).toBe(1)
  expect(console.error).toHaveBeenCalledWith(expect.stringContaining('installation failed'))
})
