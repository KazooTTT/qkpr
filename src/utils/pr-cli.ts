import inquirer from 'inquirer'
import autocompletePrompt from 'inquirer-autocomplete-prompt'
// @ts-expect-error - no types available
import searchCheckbox from 'inquirer-search-checkbox'
import { cyan, dim, green, magenta, yellow } from 'kolorist'
import { getBranchesWithInfo } from '../services/pr.js'
import { getPinnedBranches } from './config.js'

// Register prompts
inquirer.registerPrompt('autocomplete', autocompletePrompt)
inquirer.registerPrompt('search-checkbox', searchCheckbox)

/**
 * 通用的分支选择函数，支持单选和多选
 */
export async function promptBranchSelection(
  branches: string[],
  options: {
    title: string
    message: string
    mode: 'single' | 'multiple'
    filterPinned?: boolean
  },
): Promise<string | string[]> {
  const { title, message, mode, filterPinned = false } = options

  console.log(cyan(`\n${title}`))
  console.log(dim(''))

  if (branches.length === 0) {
    console.log(yellow('⚠️  No branches found'))
    return mode === 'single' ? '' : []
  }

  // 获取分支详细信息
  const branchInfos = getBranchesWithInfo(branches)

  // 获取已固定的分支列表
  const pinnedBranchNames = getPinnedBranches()

  // 分类分支：固定分支 vs 普通分支
  const allPinnedBranches = branchInfos.filter(b => pinnedBranchNames.includes(b.name))
  const regularBranches = branchInfos.filter(b => !pinnedBranchNames.includes(b.name))

  // 如果需要过滤掉已固定的分支，则只显示普通分支
  const pinnedBranches = filterPinned ? [] : allPinnedBranches

  // 固定分支按照配置顺序排序
  pinnedBranches.sort((a, b) => {
    const aIndex = pinnedBranchNames.indexOf(a.name)
    const bIndex = pinnedBranchNames.indexOf(b.name)
    return aIndex - bIndex
  })

  //  按名称对常规分支进行排序
  regularBranches.sort((a, b) => a.name.localeCompare(b.name))

  // 限制分支数量以提高性能
  const MAX_BRANCHES = 100
  if (regularBranches.length > MAX_BRANCHES) {
    regularBranches.splice(MAX_BRANCHES)
  }

  // 构建选项列表
  const choices: any[] = []

  // 添加固定分支
  if (pinnedBranches.length > 0) {
    choices.push(new inquirer.Separator(magenta('━━━━━━━━ 📌 Pinned Branches ━━━━━━━━')))
    pinnedBranches.forEach((branch) => {
      choices.push({
        name: `📌 ${branch.name.padEnd(45)} ${dim(`(${branch.lastCommitTimeFormatted})`)}`,
        value: branch.name,
        short: branch.name,
      })
    })
    choices.push(new inquirer.Separator(' '))
  }

  // 添加普通分支
  if (regularBranches.length > 0) {
    choices.push(new inquirer.Separator(cyan('━━━━━━━━ 🌿 All Branches (Alphabetical) ━━━━━━━━')))
    regularBranches.forEach((branch) => {
      choices.push({
        name: `   ${branch.name.padEnd(45)} ${dim(`(${branch.lastCommitTimeFormatted})`)}`,
        value: branch.name,
        short: branch.name,
      })
    })
    choices.push(new inquirer.Separator(' '))
  }

  // Filter function for autocomplete search
  const searchBranches = async (_answers: any, input = ''): Promise<any[]> => {
    const lowerInput = input.toLowerCase()
    return choices.filter((choice: any) => {
      // Keep separators
      if (!choice.value)
        return true
      // Filter by branch name
      return choice.value.toLowerCase().includes(lowerInput)
    })
  }

  if (mode === 'single') {
    // 单选模式总是使用 category 排序
    const { selectedBranch } = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'selectedBranch',
        message,
        source: searchBranches,
        pageSize: 20,
        default: pinnedBranches.length > 0
          ? pinnedBranches[0].name
          : regularBranches[0]?.name,
      },
    ])
    return selectedBranch
  }
  else {
    const { selectedBranches } = await inquirer.prompt([
      {
        type: 'search-checkbox',
        name: 'selectedBranches',
        message,
        choices,
      },
    ])

    return selectedBranches || []
  }
}

/**
 * 提示选择目标分支
 */
export async function promptTargetBranch(branches: string[], currentBranch: string): Promise<string> {
  console.log(dim(`Current branch: ${currentBranch}\n`))

  // 过滤掉当前分支
  const availableBranches = branches.filter(b => b !== currentBranch)

  const targetBranch = await promptBranchSelection(availableBranches, {
    title: '🎯  Target Branch Selection',
    message: 'Select target branch (type to search):',
    mode: 'single',
  }) as string

  if (!targetBranch) {
    console.log(
      yellow('⚠️  No branch selected. Using "main" as default.'),
    )
    return 'main'
  }

  console.log(green(`✅  Selected target branch: ${targetBranch}\n`))
  return targetBranch
}

/**
 * 确认是否创建合并分支
 */
export async function promptCreateMergeBranch(mergeBranchName: string): Promise<boolean> {
  console.log(yellow(`\n💡  Suggested merge branch name: ${mergeBranchName}`))

  const { createMergeBranch } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'createMergeBranch',
      message: 'Do you want to create a merge branch for conflict resolution?',
      default: false,
    },
  ])

  return createMergeBranch
}

/**
 * 显示 PR 信息
 */
export function displayPRInfo(prMessage: string, prUrl: string): void {
  console.log(cyan('\n📋  PR Description Generated:\n'))
  console.log(prMessage)
  console.log(cyan('\n👉  PR URL:\n'))
  console.log(green(prUrl))
}
