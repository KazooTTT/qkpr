#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bold, cyan, dim, green, red, yellow } from 'kolorist'
import open from 'open'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import {
  copyToClipboard,
  createMergeBranch,
  createPullRequest,
  getAllBranches,
  getGitInfo,
} from './services/pr.js'
import {
  displayPRInfo,
  promptCreateMergeBranch,
  promptTargetBranch,
} from './utils/pr-cli.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const packageJsonPath = join(__dirname, '../package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
const version = packageJson.version

function printPRBanner(): void {
  console.log(
    bold(
      cyan('\n╔══════════════════════════════════════════════════════════════╗'),
    ),
  )
  console.log(
    bold(
      cyan('║                    🔧  Quick PR Creator                       ║'),
    ),
  )
  console.log(
    bold(
      cyan('║                                                              ║'),
    ),
  )
  console.log(
    bold(
      cyan('║              Interactive PR Creation Tool                    ║'),
    ),
  )
  console.log(
    bold(
      cyan('╚══════════════════════════════════════════════════════════════╝'),
    ),
  )
  console.log(`                        Version: ${version}\n`)
}

/**
 * 处理 PR 命令
 */
async function handlePRCommand(): Promise<void> {
  printPRBanner()

  // 检查是否在 Git 仓库中
  const gitInfo = getGitInfo()
  if (!gitInfo.isGitRepo) {
    console.log(red('❌  Not a Git repository'))
    console.log(dim('Please run this command in a Git repository.\n'))
    process.exit(1)
  }

  console.log(cyan('📍  Current Repository Information:'))
  console.log(dim(`  Branch: ${gitInfo.currentBranch}`))
  console.log(dim(`  Remote: ${gitInfo.remoteUrl}\n`))

  // 获取所有分支
  const branches = getAllBranches()
  if (branches.length === 0) {
    console.log(yellow('⚠️  No branches found.'))
    process.exit(1)
  }

  // 选择目标分支
  const targetBranch = await promptTargetBranch(
    branches,
    gitInfo.currentBranch,
  )

  // 创建 PR
  const prInfo = createPullRequest(
    gitInfo.currentBranch,
    targetBranch,
    gitInfo.remoteUrl,
  )
  if (!prInfo) {
    console.log(red('❌  Failed to create PR information'))
    process.exit(1)
  }

  // 显示 PR 信息
  displayPRInfo(prInfo.prMessage, prInfo.prUrl)

  // 复制到剪贴板
  if (copyToClipboard(prInfo.prMessage)) {
    console.log(green('\n✅  PR description copied to clipboard'))
  }
  else {
    console.log(yellow('\n⚠️  Could not copy to clipboard'))
  }

  // 打开 PR 页面
  console.log(cyan('\n🌐  Opening PR page in browser...'))
  try {
    await open(prInfo.prUrl)
    console.log(green('✅  Browser opened successfully'))
  }
  catch {
    console.log(yellow('⚠️  Could not open browser automatically'))
    console.log(dim(`Please open manually: ${prInfo.prUrl}`))
  }

  // 询问是否创建合并分支
  const shouldCreateMergeBranch = await promptCreateMergeBranch(
    prInfo.mergeBranchName,
  )

  if (shouldCreateMergeBranch) {
    const success = createMergeBranch(targetBranch, prInfo.mergeBranchName)
    if (!success) {
      process.exit(1)
    }
  }

  console.log(green('\n🎉  PR creation process completed!\n'))
}

const _argv = yargs(hideBin(process.argv))
  .scriptName('quick-pr')
  .usage('Usage: $0 [options]')
  .command(
    '$0',
    'Create a Pull Request with interactive branch selection',
    () => {},
    async () => {
      await handlePRCommand()
    },
  )
  .version(version)
  .alias('v', 'version')
  .help('h')
  .alias('h', 'help')
  .epilog(
    'For more information, visit https://github.com/KazooTTT/quick-pr',
  )
  .argv
