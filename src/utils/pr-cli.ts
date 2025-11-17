import type { BranchInfo } from '../services/pr.js'
import inquirer from 'inquirer'
import autocompletePrompt from 'inquirer-autocomplete-prompt'
import { cyan, dim, green, magenta, yellow } from 'kolorist'
import { getBranchesWithInfo } from '../services/pr.js'

// Register autocomplete prompt
inquirer.registerPrompt('autocomplete', autocompletePrompt)

/**
 * 提示选择目标分支
 */
export async function promptTargetBranch(branches: string[], currentBranch: string): Promise<string> {
  console.log(cyan('\n🎯  Target Branch Selection'))
  console.log(dim(`Current branch: ${currentBranch}\n`))

  // 过滤掉当前分支
  const availableBranches = branches.filter(b => b !== currentBranch)

  if (availableBranches.length === 0) {
    console.log(
      yellow('⚠️  No other branches found. Using "main" as default.'),
    )
    return 'main'
  }

  // 获取分支详细信息
  const branchInfos = getBranchesWithInfo(availableBranches)

  // 分类分支：受保护分支 vs 普通分支
  const protectedBranches = branchInfos.filter(b => b.isProtected)
  const regularBranches = branchInfos.filter(b => !b.isProtected)

  // 受保护分支按照预定义顺序排序
  const protectedOrder = ['main', 'master', 'develop', 'dev', 'pre_master', 'dev_master']
  protectedBranches.sort((a, b) => {
    const aIndex = protectedOrder.indexOf(a.name)
    const bIndex = protectedOrder.indexOf(b.name)
    if (aIndex !== -1 && bIndex !== -1)
      return aIndex - bIndex
    if (aIndex !== -1)
      return -1
    if (bIndex !== -1)
      return 1
    return b.lastCommitTime - a.lastCommitTime
  })

  // 按类别分组普通分支
  const categorizedBranches = new Map<string, BranchInfo[]>()
  regularBranches.forEach((branch) => {
    if (!categorizedBranches.has(branch.category)) {
      categorizedBranches.set(branch.category, [])
    }
    categorizedBranches.get(branch.category)!.push(branch)
  })

  // 每个类别内按时间排序（最新的在前）
  categorizedBranches.forEach((branches) => {
    branches.sort((a, b) => b.lastCommitTime - a.lastCommitTime)
  })

  // 对类别排序（feat, fix, merge, refactor, 其他）
  const categoryOrder = ['feat', 'fix', 'merge', 'refactor', 'hotfix', 'chore', 'docs', 'test', 'style']
  const sortedCategories = Array.from(categorizedBranches.keys()).sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a)
    const bIndex = categoryOrder.indexOf(b)
    if (aIndex !== -1 && bIndex !== -1)
      return aIndex - bIndex
    if (aIndex !== -1)
      return -1
    if (bIndex !== -1)
      return 1
    if (a === 'other')
      return 1
    if (b === 'other')
      return -1
    return a.localeCompare(b)
  })

  // 构建选项列表
  const choices: any[] = []

  // 添加受保护分支
  if (protectedBranches.length > 0) {
    choices.push(new inquirer.Separator(magenta('━━━━━━━━ 📌 Protected Branches ━━━━━━━━')))
    protectedBranches.forEach((branch) => {
      choices.push({
        name: `📌 ${branch.name.padEnd(45)} ${dim(`(${branch.lastCommitTimeFormatted})`)}`,
        value: branch.name,
        short: branch.name,
      })
    })
    choices.push(new inquirer.Separator(' '))
  }

  // 添加分类分支
  sortedCategories.forEach((category) => {
    const branches = categorizedBranches.get(category)!
    if (branches.length > 0) {
      const categoryLabel = category === 'other' ? 'Other Branches' : `${category}/*`
      choices.push(new inquirer.Separator(cyan(`━━━━━━━━ ${categoryLabel} ━━━━━━━━`)))
      branches.forEach((branch) => {
        choices.push({
          name: `   ${branch.name.padEnd(45)} ${dim(`(${branch.lastCommitTimeFormatted})`)}`,
          value: branch.name,
          short: branch.name,
        })
      })
      choices.push(new inquirer.Separator(' '))
    }
  })

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

  const { targetBranch } = await inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'targetBranch',
      message: 'Select target branch (type to search):',
      source: searchBranches,
      pageSize: 20,
      default: protectedBranches.length > 0 ? protectedBranches[0].name : regularBranches[0]?.name,
    },
  ])

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
