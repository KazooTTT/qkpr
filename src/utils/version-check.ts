import { execSync } from 'node:child_process'
import inquirer from 'inquirer'
import { cyan, dim, green, red, yellow } from 'kolorist'

export interface VersionCheckResult {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string
}

/**
 * Check if there's a newer version available on npm
 */
export async function checkForUpdates(
  packageName: string,
  currentVersion: string,
): Promise<VersionCheckResult> {
  try {
    // Get latest version from npm
    const latestVersion = execSync(`npm view ${packageName} version`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 5000, // Increased timeout
    }).trim()

    const hasUpdate = compareVersions(currentVersion, latestVersion) < 0

    // Debug logging (can be enabled with environment variable)
    if (process.env.DEBUG_QKPR_UPDATE) {
      console.log(`[DEBUG] Package: ${packageName}`)
      console.log(`[DEBUG] Current: ${currentVersion}`)
      console.log(`[DEBUG] Latest: ${latestVersion}`)
      console.log(`[DEBUG] Has update: ${hasUpdate}`)
    }

    return {
      hasUpdate,
      currentVersion,
      latestVersion,
    }
  }
  catch (error) {
    // Log error for debugging but still return a safe result
    if (process.env.DEBUG_QKPR_UPDATE) {
      console.log(`[DEBUG] Update check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // If npm check fails, silently skip the update check
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
    }
  }
}

/**
 * Compare two semantic versions
 * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0
    const part2 = parts2[i] || 0

    if (part1 < part2)
      return -1
    if (part1 > part2)
      return 1
  }

  return 0
}

/**
 * Detect the package manager used to install qkpr globally
 * Returns: 'npm', 'pnpm', 'yarn', or 'bun' (defaults to 'npm')
 */
function detectPackageManager(): string {
  const packageName = 'qkpr'

  try {
    const npmResult = execSync(`npm list -g ${packageName}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    if (npmResult.includes(packageName)) {
      return 'npm'
    }
  }
  catch {
  }

  try {
    const pnpmResult = execSync(`pnpm list -g ${packageName}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    if (pnpmResult.includes(packageName)) {
      return 'pnpm'
    }
  }
  catch {
  }

  try {
    const yarnResult = execSync(`yarn global list`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    if (yarnResult.includes(`"${packageName}"`) || yarnResult.includes(`'${packageName}'`)) {
      return 'yarn'
    }
  }
  catch {
  }

  try {
    const bunResult = execSync(`bun pm ls -g`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    if (bunResult.includes(packageName)) {
      return 'bun'
    }
  }
  catch {
  }

  return 'npm'
}

/**
 * Display update notification and prompt user to update
 */
export async function promptForUpdate(
  packageName: string,
  result: VersionCheckResult,
): Promise<void> {
  if (!result.hasUpdate)
    return

  console.log(yellow('\n╔═══════════════════════════════════════════════════════════════╗'))
  console.log(yellow('║                    📦  Update Available                       ║'))
  console.log(yellow('╚═══════════════════════════════════════════════════════════════╝'))
  console.log(dim(`  Current version: ${result.currentVersion}`))
  console.log(green(`  Latest version:  ${result.latestVersion}\n`))

  const { shouldUpdate } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'shouldUpdate',
      message: 'Would you like to update now?',
      default: true,
    },
  ])

  if (shouldUpdate) {
    try {
      const packageManager = detectPackageManager()
      console.log(cyan(`\n⏳  Updating ${packageName} using ${packageManager}...\n`))

      let command: string
      if (packageManager === 'npm') {
        command = `npm install -g ${packageName}`
      }
      else if (packageManager === 'pnpm') {
        command = `pnpm add -g ${packageName}`
      }
      else if (packageManager === 'yarn') {
        command = `yarn global add ${packageName}`
      }
      else if (packageManager === 'bun') {
        command = `bun add -g ${packageName}`
      }
      else {
        command = `npm install -g ${packageName}`
      }

      execSync(command, { stdio: 'inherit' })
      console.log(green(`\n✅  Successfully updated to version ${result.latestVersion}!`))
      console.log(yellow('Please restart the command to use the new version.\n'))
      process.exit(0)
    }
    catch {
      console.log(red('\n❌  Failed to update. Please try manually:'))
      console.log(dim(`  npm install -g ${packageName}`))
      console.log(dim(`  or: pnpm add -g ${packageName}`))
      console.log(dim(`  or: yarn global add ${packageName}`))
      console.log(dim(`  or: bun add -g ${packageName}\n`))
    }
  }
  else {
    console.log(dim('\nYou can update later by running:'))
    console.log(yellow(`  npm install -g ${packageName}`))
    console.log(dim(`  or: pnpm add -g ${packageName}`))
    console.log(dim(`  or: yarn global add ${packageName}`))
    console.log(dim(`  or: bun add -g ${packageName}\n`))
  }
}

/**
 * Check for updates and prompt user (non-blocking)
 */
export async function checkAndNotifyUpdate(
  packageName: string,
  currentVersion: string,
): Promise<void> {
  try {
    const result = await checkForUpdates(packageName, currentVersion)
    await promptForUpdate(packageName, result)
  }
  catch {
    // Silently fail if update check fails
  }
}
