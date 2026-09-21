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
  extractWorkitemFromBranch,
  fastForwardLocalTarget,
  getAllBranches,
  getGitInfo,
  getMergeBranches,
  getTargetSyncStatus,
  isMergeBranchName,
  mergeSourceToMergeBranch,
  parseMergeBranchNameCandidates,
  resolvePRBranches,
} from './services/pr.js'
import { handleBranchCommand, handleCommitCommand, handleConfigCommand, handleConfigModelCommand, handleConfigPromptLangCommand, handleConfigPromptsCommand, isBranchPushed, pushBranchToRemote } from './utils/commit-cli.js'
import { handleListPinnedCommand, handlePinCommand, handleUnpinCommand } from './utils/pin-cli.js'
import {
  displayPRInfo,
  promptAutoMergeSource,
  promptCreateMergeBranch,
  promptDeleteMergeBranches,
  promptDeleteRemoteMergeBranches,
  promptPullTargetBranch,
  promptSourceBranch,
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

async function handleDeleteMergeBranchCommand(branchArg?: string, options: { remote?: boolean } = {}): Promise<void> {
  const { remote = false } = options
  const gitInfo = getGitInfo()
  if (!gitInfo.isGitRepo) {
    console.log(red('❌  Not a Git repository'))
    console.log(dim('Please run this command in a Git repository.\n'))
    return
  }

  let branchesToDelete: string[] = []
  let shouldDeleteRemote = remote

  if (branchArg) {
    if (!isMergeBranchName(branchArg)) {
      console.log(red(`❌  '${branchArg}' is not a merge branch.`))
      console.log(dim('Only branches starting with "merge/" can be deleted.\n'))
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

    if (!remote) {
      shouldDeleteRemote = await promptDeleteRemoteMergeBranches()
    }
  }

  const result = deleteMergeBranches(branchesToDelete, { remote: shouldDeleteRemote })

  if (result.localDeleted.length > 0) {
    console.log(green(`\n✅  Deleted ${result.localDeleted.length} local merge branch(es):`))
    result.localDeleted.forEach(branch => console.log(dim(`   [local] ${branch}`)))
  }

  if (result.remoteDeleted.length > 0) {
    console.log(green(`\n✅  Deleted ${result.remoteDeleted.length} remote merge branch(es):`))
    result.remoteDeleted.forEach(branch => console.log(dim(`   [remote] origin/${branch}`)))
  }

  if (result.localFailed.length > 0) {
    console.log(yellow(`\n⚠️  Failed to delete ${result.localFailed.length} local branch(es):`))
    result.localFailed.forEach(branch => console.log(dim(`   [local] ${branch}`)))
  }

  if (result.remoteFailed.length > 0) {
    console.log(yellow(`\n⚠️  Failed to delete ${result.remoteFailed.length} remote branch(es):`))
    result.remoteFailed.forEach(branch => console.log(dim(`   [remote] origin/${branch}`)))
  }

  console.log('')
}

/**
 * 从 merge 分支切换回原始 source 分支
 */
async function handleBackCommand(): Promise<void> {
  const gitInfo = getGitInfo()
  if (!gitInfo.isGitRepo) {
    console.log(red('❌  Not a Git repository'))
    console.log(dim('Please run this command in a Git repository.\n'))
    return
  }

  const { currentBranch } = gitInfo

  // 检查是否在 merge 分支上
  if (!isMergeBranchName(currentBranch)) {
    console.log(yellow(`⚠️  Not on a merge branch (current: ${currentBranch})`))
    console.log(dim('This command switches back to the source branch from a merge branch.\n'))
    return
  }

  // 解析所有可能的分支组合
  const candidates = parseMergeBranchNameCandidates(currentBranch)

  console.log(cyan('\n🔙  Back to Source Branch'))
  console.log(dim(`  Merge branch: ${currentBranch}\n`))

  let sourceBranch: string
  let targetBranch: string

  if (candidates.length === 0) {
    // 解析失败，让用户选择
    console.log(red(`❌  Could not parse merge branch name: ${currentBranch}`))
    console.log(dim('Expected format: merge/<source>-to-<target>\n'))

    const branches = getAllBranches()
    const selectedSource = await promptSourceBranch(branches, currentBranch)
    if (!selectedSource) {
      return
    }
    sourceBranch = selectedSource

    const selectedTarget = await promptTargetBranch(branches, currentBranch)
    if (!selectedTarget) {
      return
    }
    targetBranch = selectedTarget
  }
  else if (candidates.length === 1) {
    // 只有一个匹配，直接使用
    sourceBranch = candidates[0].sourceBranch
    targetBranch = candidates[0].targetBranch
    console.log(dim(`  Detected source: ${sourceBranch}`))
    console.log(dim(`  Detected target: ${targetBranch}\n`))
  }
  else {
    // 多个匹配，让用户选择
    console.log(yellow(`⚠️  Found ${candidates.length} possible branch combinations:\n`))

    const inquirer = (await import('inquirer')).default
    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: 'Which source branch do you want to switch to?',
        choices: [
          ...candidates.map((c, i) => ({
            name: `${c.sourceBranch} → ${c.targetBranch}`,
            value: i,
          })),
          new inquirer.Separator(),
          { name: 'Cancel', value: -1 },
        ],
      },
    ])

    if (selected === -1) {
      return
    }

    sourceBranch = candidates[selected].sourceBranch
    targetBranch = candidates[selected].targetBranch
  }

  const branches = getAllBranches()

  // 检查分支是否存在
  if (!branches.includes(sourceBranch)) {
    console.log(yellow(`⚠️  Source branch '${sourceBranch}' not found.`))
    const selected = await promptSourceBranch(branches, currentBranch)
    if (!selected) {
      return
    }
    sourceBranch = selected
  }

  // 检查本地是否有 source 分支
  const localBranches = branches.filter(b => !b.startsWith('origin/'))
  if (!localBranches.includes(sourceBranch)) {
    console.log(yellow(`⚠️  Source branch '${sourceBranch}' is not available locally.`))
    const inquirer = (await import('inquirer')).default
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: `Checkout from remote (origin/${sourceBranch})`, value: 'checkout-remote' },
          { name: 'Select a different branch', value: 'select' },
          { name: 'Cancel', value: 'cancel' },
        ],
      },
    ])

    if (action === 'cancel') {
      return
    }
    if (action === 'select') {
      const selected = await promptSourceBranch(branches, currentBranch)
      if (!selected) {
        return
      }
      sourceBranch = selected
    }
  }

  // 切换分支
  try {
    console.log(cyan(`\n🔄  Switching to source branch: ${sourceBranch}`))
    const { execSync } = await import('node:child_process')
    execSync(`git checkout ${sourceBranch}`, { stdio: 'inherit' })
    console.log(green(`\n✅  Switched back to: ${sourceBranch}`))
    console.log(dim(`   (from merge branch: ${currentBranch})\n`))
  }
  catch {
    console.log(red('❌  Failed to switch branch'))
    console.log(dim('You may have uncommitted changes. Please commit or stash them first.\n'))
  }
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
        { name: '5. 🔙  Back to Source Branch', value: 'back', key: '5' },
        { name: '6. 📌  Manage Pinned Branches', value: 'pinned', key: '6' },
        { name: '7. ⚙️   Settings', value: 'settings', key: '7' },
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
    case 'back':
      await handleBackCommand()
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
async function handlePRCommand(
  firstBranchArg?: string,
  secondBranchArg?: string,
  options: { source?: boolean, skip?: boolean, workitem?: string | boolean } = {},
): Promise<void> {
  printPRBanner()
  const { source = false, skip = false } = options

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

  let { sourceBranch, targetBranch: targetBranchArg } = resolvePRBranches(
    gitInfo.currentBranch,
    firstBranchArg,
    secondBranchArg,
  )

  const branches = getAllBranches()
  if (branches.length === 0) {
    console.log(yellow('⚠️  No branches found.'))
    return // 返回主菜单而不是退出
  }

  if (source) {
    const selectedSource = await promptSourceBranch(branches, gitInfo.currentBranch)
    if (!selectedSource) {
      return
    }
    sourceBranch = selectedSource
  }

  if (!branches.includes(sourceBranch)) {
    console.log(red(`❌  Source branch '${sourceBranch}' not found.`))
    return
  }

  console.log(cyan(`🔀  PR source branch: ${sourceBranch}\n`))

  // 检查 source 分支是否已推送到远程
  if (!isBranchPushed(sourceBranch)) {
    console.log(yellow(`⚠️  Source branch '${sourceBranch}' is not pushed to remote.`))
    if (skip) {
      const pushSuccess = pushBranchToRemote(sourceBranch)
      if (!pushSuccess) {
        console.log(red('❌  Cannot create PR without pushing branch to remote.'))
        return // 返回主菜单而不是退出
      }
    }
    else {
      const shouldPush = await promptPushBranch(sourceBranch)

      if (shouldPush) {
        const pushSuccess = pushBranchToRemote(sourceBranch)
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
      sourceBranch,
    )
  }

  if (!targetBranch) {
    return // 返回主菜单而不是退出
  }

  if (targetBranch === sourceBranch) {
    console.log(red(`❌  Source and target branch cannot both be '${sourceBranch}'.`))
    return
  }

  // 飞书项目关联（仅在 --workitem 时触发）
  let workitemId: string | undefined
  const { workitem } = options

  if (workitem !== undefined) {
    if (typeof workitem === 'string' && workitem) {
      // 用户直接传了 ID：qkpr pr -w 12345 或 -w M-12345，统一提取数字
      const num = workitem.match(/\d+/)
      workitemId = num ? num[0] : workitem
      console.log(cyan(`\n🔗  Using workitem: M-${workitemId}`))
    }
    else {
      // 仅传了 flag：qkpr pr -w，尝试从分支名提取
      const extracted = extractWorkitemFromBranch(sourceBranch)
      if (extracted) {
        workitemId = extracted
        console.log(cyan(`\n🔗  Detected workitem from branch: M-${workitemId}`))
      }
      else {
        // 提取失败，提示手动输入
        console.log(dim('\n💡  No workitem ID detected from branch name.'))
        const inquirer = (await import('inquirer')).default
        const { input } = await inquirer.prompt([
          {
            type: 'input',
            name: 'input',
            message: 'Enter workitem number, or press Enter to skip:',
            validate: (value: string) => {
              if (!value)
                return true
              return /^\d+$/.test(value) || 'Enter a number only'
            },
          },
        ])
        if (input) {
          workitemId = input
        }
      }
    }
  }

  // 创建 PR
  const prInfo = createPullRequest(
    sourceBranch,
    targetBranch,
    gitInfo.remoteUrl,
    workitemId,
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

  if (skip) {
    console.log(green('\n🎉  PR created and opened. Skipped merge-branch and conflict checks.\n'))
    return
  }

  // 询问是否创建合并分支
  const shouldCreateMergeBranch = await promptCreateMergeBranch(
    prInfo.mergeBranchName,
  )

  if (shouldCreateMergeBranch) {
    // 若本地 target 落后于远程且可快进，提示是否先快进，保证 merge 分支基于最新的 target
    const syncStatus = getTargetSyncStatus(targetBranch)
    if (syncStatus.canFastForward) {
      const shouldPull = await promptPullTargetBranch(targetBranch, syncStatus.behind)
      if (shouldPull) {
        const ok = fastForwardLocalTarget(targetBranch)
        if (ok) {
          console.log(green(`✅  Fast-forwarded local '${targetBranch}' to origin/${targetBranch}`))
        }
        else {
          console.log(yellow(`⚠️  Could not fast-forward '${targetBranch}' (it may be checked out elsewhere). Using local '${targetBranch}' as-is.`))
        }
      }
    }
    else if (syncStatus.behind > 0 && syncStatus.ahead > 0) {
      console.log(yellow(`\n⚠️  Local '${targetBranch}' and origin/${targetBranch} have diverged (${syncStatus.ahead} ahead, ${syncStatus.behind} behind).`))
      console.log(dim(`   The merge branch will use your local '${targetBranch}'. Reconcile with 'git pull' if you want the latest remote base.`))
    }

    const success = createMergeBranch(targetBranch, prInfo.mergeBranchName)
    if (!success) {
      return // 返回主菜单而不是退出
    }

    // 询问是否要自动合并以检测冲突
    const shouldAutoMerge = await promptAutoMergeSource(
      sourceBranch,
      targetBranch,
    )

    if (shouldAutoMerge) {
      console.log(yellow(`\n🔄  Merging '${sourceBranch}' to detect conflicts...`))
      try {
        const mergeSuccess = mergeSourceToMergeBranch(sourceBranch)
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
      console.log(dim(`   git merge ${sourceBranch}`))
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
    'pr [branch] [target]',
    '🔧  Create a Pull Request with interactive branch selection',
    (yargs) => {
      return yargs
        .positional('branch', {
          describe: 'Target branch, or source branch when target is also provided',
          type: 'string',
        })
        .positional('target', {
          describe: 'Target branch when explicitly specifying source and target',
          type: 'string',
        })
        .option('skip', {
          describe: 'Skip creating merge branch / conflict checks (open PR link only)',
          type: 'boolean',
          default: false,
        })
        .option('source', {
          alias: 's',
          describe: 'Interactively search and select the source branch',
          type: 'boolean',
          default: false,
        })
        .option('workitem', {
          alias: 'w',
          describe: 'Feishu workitem number. Use -w to auto-extract from branch name',
        })
    },
    async (argv) => {
      await handlePRCommand(argv.branch as string | undefined, argv.target as string | undefined, {
        source: argv.source as boolean | undefined,
        skip: argv.skip as boolean | undefined,
        workitem: argv.workitem as string | boolean | undefined,
      })
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
    '🗑️  Delete merge branches locally, with optional remote deletion',
    (yargs) => {
      return yargs
        .positional('branch', {
          describe: 'Specific merge branch to delete',
          type: 'string',
        })
        .option('remote', {
          alias: 'r',
          describe: 'Also delete the remote branch on origin',
          type: 'boolean',
          default: false,
        })
    },
    async (argv) => {
      await handleDeleteMergeBranchCommand(argv.branch as string | undefined, {
        remote: argv.remote as boolean | undefined,
      })
      await checkAndNotifyUpdate(packageName, version)
    },
  )
  .command(
    'back',
    '🔙  Switch back to source branch from a merge branch',
    () => {},
    async () => {
      await handleBackCommand()
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
