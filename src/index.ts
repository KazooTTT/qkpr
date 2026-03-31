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
  deleteMergeBranches,
  getAllBranches,
  getGitInfo,
  getMergeBranches,
  isMergeBranchName,
  mergeSourceToMergeBranch,
} from './services/pr.js'
import { handleBranchCommand, handleCommitCommand, handleConfigCommand, handleConfigModelCommand, handleConfigPromptLangCommand, handleConfigPromptsCommand, isBranchPushed, pushBranchToRemote } from './utils/commit-cli.js'
import { handleListPinnedCommand, handlePinCommand, handleUnpinCommand } from './utils/pin-cli.js'
import {
  displayPRInfo,
  promptAutoMergeSource,
  promptCreateMergeBranch,
  promptDeleteMergeBranches,
  promptTargetBranch,
} from './utils/pr-cli.js'
import { checkAndNotifyUpdate } from './utils/version-check.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const packageJsonPath = join(__dirname, '../package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
const version = packageJson.version
const packageName = packageJson.name

/**
 * Show pinned branches management menu
 */
async function showPinnedBranchesMenu(): Promise<void> {
  const inquirer = (await import('inquirer')).default

  while (true) {
    // 直接显示已固定的分支列表
    await handleListPinnedCommand()

    // 然后询问用户想做什么
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '1. 📌  Pin more branches', value: 'pin', key: '1' },
          { name: '2. 📍  Unpin branches', value: 'unpin', key: '2' },
          new inquirer.Separator(),
          { name: '↩️   Back to main menu', value: 'back' },
        ],
      },
    ])

    switch (action) {
      case 'pin':
        await handlePinCommand()
        break
      case 'unpin':
        await handleUnpinCommand()
        break
      case 'back':
        return
    }
  }
}

async function showSettingsMenu(): Promise<void> {
  const inquirer = (await import('inquirer')).default

  while (true) {
    const { setting } = await inquirer.prompt([
      {
        type: 'list',
        name: 'setting',
        message: 'Settings',
        choices: [
          { name: '1. ⚙️   Configure API Key', value: 'config', key: '1' },
          { name: '2. 🔧  Configure Model', value: 'config:model', key: '2' },
          { name: '3. 🌐  Configure Prompt Language', value: 'config:prompt-lang', key: '3' },
          { name: '4. 📝  Configure Custom Prompts', value: 'config:prompts', key: '4' },
          new inquirer.Separator(),
          { name: '↩️   Back to main menu', value: 'back' },
        ],
      },
    ])

    switch (setting) {
      case 'config':
        await handleConfigCommand()
        break
      case 'config:model':
        await handleConfigModelCommand()
        break
      case 'config:prompt-lang':
        await handleConfigPromptLangCommand()
        break
      case 'config:prompts':
        await handleConfigPromptsCommand()
        break
      case 'back':
        return
    }
  }
}

async function handleDeleteMergeBranchCommand(branchArg?: string): Promise<void> {
  const gitInfo = getGitInfo()
  if (!gitInfo.isGitRepo) {
    console.log(red('❌  Not a Git repository'))
    console.log(dim('Please run this command in a Git repository.\n'))
    return
  }

  let branchesToDelete: string[] = []

  if (branchArg) {
    if (!isMergeBranchName(branchArg)) {
      console.log(red(`❌  '${branchArg}' is not a merge branch.`))
      console.log(dim('Only local branches starting with "merge/" can be deleted.\n'))
      return
    }

    if (branchArg === gitInfo.currentBranch) {
      console.log(red(`❌  Cannot delete the current branch '${branchArg}'.`))
      console.log(dim('Checkout another branch and try again.\n'))
      return
    }

    branchesToDelete = [branchArg]
  }
  else {
    const mergeBranches = getMergeBranches(gitInfo.currentBranch)
    if (mergeBranches.length === 0) {
      console.log(yellow('⚠️  No merge branches found to delete.\n'))
      return
    }

    branchesToDelete = await promptDeleteMergeBranches(mergeBranches)
    if (branchesToDelete.length === 0) {
      return
    }
  }

  const result = deleteMergeBranches(branchesToDelete)

  if (result.deleted.length > 0) {
    console.log(green(`\n✅  Deleted ${result.deleted.length} merge branch(es):`))
    result.deleted.forEach(branch => console.log(dim(`   ${branch}`)))
  }

  if (result.failed.length > 0) {
    console.log(yellow(`\n⚠️  Failed to delete ${result.failed.length} branch(es):`))
    result.failed.forEach(branch => console.log(dim(`   ${branch}`)))
  }

  console.log('')
}

async function showMainMenu(): Promise<void> {
  // Check for updates at the start of main menu
  await checkAndNotifyUpdate(packageName, version)

  console.log(
    bold(
      cyan('\n╔══════════════════════════════════════════════════════════════╗'),
    ),
  )
  console.log(
    bold(
      cyan('║                     🚀  Quick PR Tool                        ║'),
    ),
  )
  console.log(
    bold(
      cyan('║                                                              ║'),
    ),
  )
  console.log(
    bold(
      cyan('║           Your All-in-One Git Workflow Assistant             ║'),
    ),
  )
  console.log(
    bold(
      cyan('║                                                              ║'),
    ),
  )
  console.log(
    bold(
      cyan('║                      Author: KazooTTT                        ║'),
    ),
  )
  console.log(
    bold(
      cyan('║          GitHub: https://github.com/KazooTTT/qkpr            ║'),
    ),
  )
  console.log(
    bold(
      cyan('╚══════════════════════════════════════════════════════════════╝'),
    ),
  )
  console.log(`            Version: ${version}\n`)

  const inquirer = (await import('inquirer')).default

  const { feature } = await inquirer.prompt([
    {
      type: 'list',
      name: 'feature',
      message: 'What would you like to do?',
      choices: [
        { name: '1. 🔧  Create Pull Request', value: 'pr', key: '1' },
        { name: '2. 🤖  Generate Commit Message', value: 'commit', key: '2' },
        { name: '3. 🌿  Generate Branch Name', value: 'branch', key: '3' },
        { name: '4. 🗑️  Delete Merge Branches', value: 'del', key: '4' },
        { name: '5. 📌  Manage Pinned Branches', value: 'pinned', key: '5' },
        { name: '6. ⚙️   Settings', value: 'settings', key: '6' },
        new inquirer.Separator(),
        { name: '❌  Exit', value: 'exit' },
      ],
    },
  ])

  switch (feature) {
    case 'pr':
      await handlePRCommand()
      await showMainMenu() // 回到首页
      break
    case 'commit':
      await handleCommitCommand()
      await showMainMenu() // 回到首页
      break
    case 'branch':
      await handleBranchCommand()
      await showMainMenu() // 回到首页
      break
    case 'del':
      await handleDeleteMergeBranchCommand()
      await showMainMenu()
      break
    case 'pinned':
      await showPinnedBranchesMenu()
      await showMainMenu() // 回到首页
      break
    case 'settings':
      await showSettingsMenu()
      await showMainMenu() // 回到首页
      break
    case 'exit':
      console.log(dim('\n👋  Goodbye!\n'))
      process.exit(0)
  }
}

function printPRBanner(): void {
  console.log(
    bold(
      cyan('\n╔══════════════════════════════════════════════════════════════╗'),
    ),
  )
  console.log(
    bold(
      cyan('║                     🔧  Quick PR Creator                     ║'),
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
  console.log(`                   Version: ${version}\n`)
}

/**
 * 询问是否推送分支到远程
 */
async function promptPushBranch(branchName: string): Promise<boolean> {
  const inquirer = (await import('inquirer')).default
  const { shouldPush } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'shouldPush',
      message: `Branch '${branchName}' is not pushed to remote. Push now?`,
      default: true,
    },
  ])

  return shouldPush
}

/**
 * 处理 PR 命令
 */
async function handlePRCommand(targetBranchArg?: string): Promise<void> {
  printPRBanner()

  // 检查是否在 Git 仓库中
  const gitInfo = getGitInfo()
  if (!gitInfo.isGitRepo) {
    console.log(red('❌  Not a Git repository'))
    console.log(dim('Please run this command in a Git repository.\n'))
    return // 返回主菜单而不是退出
  }

  console.log(cyan('📍  Current Repository Information:'))
  console.log(dim(`  Branch: ${gitInfo.currentBranch}`))
  console.log(dim(`  Remote: ${gitInfo.remoteUrl}\n`))

  // 检查当前分支是否已推送到远程
  if (!isBranchPushed(gitInfo.currentBranch)) {
    console.log(yellow(`⚠️  Current branch '${gitInfo.currentBranch}' is not pushed to remote.`))
    const shouldPush = await promptPushBranch(gitInfo.currentBranch)

    if (shouldPush) {
      const pushSuccess = pushBranchToRemote(gitInfo.currentBranch)
      if (!pushSuccess) {
        console.log(red('❌  Cannot create PR without pushing branch to remote.'))
        return // 返回主菜单而不是退出
      }
    }
    else {
      console.log(yellow('⚠️  PR creation skipped because branch is not pushed to remote.'))
      console.log(dim('Please push the branch manually and try again.\n'))
      return // 返回主菜单而不是退出
    }
  }

  // 获取所有分支
  const branches = getAllBranches()
  if (branches.length === 0) {
    console.log(yellow('⚠️  No branches found.'))
    return // 返回主菜单而不是退出
  }

  // 选择目标分支
  let targetBranch: string | null = null

  // 如果提供了目标分支参数，验证它是否存在
  if (targetBranchArg) {
    const branchExists = branches.includes(targetBranchArg)
    if (branchExists) {
      targetBranch = targetBranchArg
      console.log(green(`✅  Using specified target branch: ${targetBranch}\n`))
    }
    else {
      console.log(yellow(`⚠️  Branch '${targetBranchArg}' not found. Falling back to interactive selection.`))
    }
  }

  // 如果没有目标分支（未提供参数或参数无效），则进行交互式选择
  if (!targetBranch) {
    targetBranch = await promptTargetBranch(
      branches,
      gitInfo.currentBranch,
    )
  }

  if (!targetBranch) {
    return // 返回主菜单而不是退出
  }

  // 创建 PR
  const prInfo = createPullRequest(
    gitInfo.currentBranch,
    targetBranch,
    gitInfo.remoteUrl,
  )
  if (!prInfo) {
    console.log(red('❌  Failed to create PR information'))
    return // 返回主菜单而不是退出
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
      return // 返回主菜单而不是退出
    }

    // 询问是否要自动合并以检测冲突
    const shouldAutoMerge = await promptAutoMergeSource(
      gitInfo.currentBranch,
      targetBranch,
    )

    if (shouldAutoMerge) {
      console.log(yellow(`\n🔄  Merging '${gitInfo.currentBranch}' to detect conflicts...`))
      try {
        const mergeSuccess = mergeSourceToMergeBranch(gitInfo.currentBranch)
        if (!mergeSuccess) {
          console.log(yellow('\n⚠️  Merge conflicts detected! Please resolve them manually:'))
          console.log(dim(`   1. Resolve conflicts in your editor`))
          console.log(dim(`   2. Run: git add <resolved-files>`))
          console.log(dim(`   3. Run: git commit`))
          console.log(dim(`   4. Push the merge branch when ready`))
        }
      }
      catch {
        // The error is already logged by the service function, so we can just return.
        return
      }
    }
    else {
      console.log(green(`\n✅  Merge branch '${prInfo.mergeBranchName}' created without merging.`))
      console.log(dim(`   You can manually merge later when ready:`))
      console.log(dim(`   git checkout ${prInfo.mergeBranchName}`))
      console.log(dim(`   git merge ${gitInfo.currentBranch}`))
    }
  }

  console.log(green('\n🎉  PR creation process completed!\n'))
}

const _argv = yargs(hideBin(process.argv))
  .scriptName('qkpr')
  .usage('Usage: $0 <command> [options]')
  .command(
    '$0',
    'Show interactive menu to choose features',
    () => {},
    async () => {
      await showMainMenu()
    },
  )
  .command(
    'pr [branch]',
    '🔧  Create a Pull Request with interactive branch selection',
    (yargs) => {
      return yargs.positional('branch', {
        describe: 'Target branch name',
        type: 'string',
      })
    },
    async (argv) => {
      await handlePRCommand(argv.branch as string | undefined)
      await checkAndNotifyUpdate(packageName, version)
    },
  )
  .command(
    'commit',
    '🤖  Generate commit message using AI',
    () => {},
    async () => {
      await handleCommitCommand()
      await checkAndNotifyUpdate(packageName, version)
    },
  )
  .command(
    'branch',
    '🌿  Generate branch name using AI',
    () => {},
    async () => {
      await handleBranchCommand()
      await checkAndNotifyUpdate(packageName, version)
    },
  )
  .command(
    'del [branch]',
    '🗑️  Delete local merge branches',
    (yargs) => {
      return yargs.positional('branch', {
        describe: 'Specific merge branch to delete',
        type: 'string',
      })
    },
    async (argv) => {
      await handleDeleteMergeBranchCommand(argv.branch as string | undefined)
      await checkAndNotifyUpdate(packageName, version)
    },
  )
  .command(
    'config',
    '⚙️   Configure Gemini API Key',
    () => {},
    async () => {
      await handleConfigCommand()
      await checkAndNotifyUpdate(packageName, version)
    },
  )
  .command(
    'config:model',
    '🔧  Configure Gemini Model',
    () => {},
    async () => {
      await handleConfigModelCommand()
      await checkAndNotifyUpdate(packageName, version)
    },
  )
  .command(
    'config:prompt-lang',
    '🌐  Configure Prompt Language',
    () => {},
    async () => {
      await handleConfigPromptLangCommand()
      await checkAndNotifyUpdate(packageName, version)
    },
  )
  .command(
    'config:prompts',
    '📝  Configure Custom Prompts',
    () => {},
    async () => {
      await handleConfigPromptsCommand()
      await checkAndNotifyUpdate(packageName, version)
    },
  )
  .command(
    'pin [branch]',
    '📌  Pin a branch for quick access',
    (yargs) => {
      return yargs.positional('branch', {
        describe: 'Branch name to pin',
        type: 'string',
      })
    },
    async (argv) => {
      await handlePinCommand(argv.branch)
      await checkAndNotifyUpdate(packageName, version)
    },
  )
  .command(
    'unpin [branch]',
    '📍  Unpin a branch',
    (yargs) => {
      return yargs.positional('branch', {
        describe: 'Branch name to unpin',
        type: 'string',
      })
    },
    async (argv) => {
      await handleUnpinCommand(argv.branch)
      await checkAndNotifyUpdate(packageName, version)
    },
  )
  .command(
    'pinned',
    '📋  List all pinned branches',
    () => {},
    async () => {
      await handleListPinnedCommand()
      await checkAndNotifyUpdate(packageName, version)
    },
  )
  .version(version)
  .alias('v', 'version')
  .help('h')
  .alias('h', 'help')
  .epilog(
    'For more information, visit https://github.com/KazooTTT/qkpr',
  )
  .argv
