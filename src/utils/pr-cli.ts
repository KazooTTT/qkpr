import inquirer from 'inquirer'
import { cyan, dim, green, yellow } from 'kolorist'

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

  // 将 main/master/develop 等常用分支置顶
  const priorityBranches = ['main', 'master', 'develop', 'dev']
  const sortedBranches = availableBranches.sort((a, b) => {
    const aIndex = priorityBranches.indexOf(a)
    const bIndex = priorityBranches.indexOf(b)

    if (aIndex !== -1 && bIndex !== -1)
      return aIndex - bIndex
    if (aIndex !== -1)
      return -1
    if (bIndex !== -1)
      return 1
    return a.localeCompare(b)
  })

  const { targetBranch } = await inquirer.prompt([
    {
      type: 'list',
      name: 'targetBranch',
      message: 'Select target branch:',
      choices: sortedBranches,
      default: sortedBranches[0],
      pageSize: 15,
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
