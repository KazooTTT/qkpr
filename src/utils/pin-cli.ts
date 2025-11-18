import { cyan, dim, green, red, yellow } from 'kolorist'
import { addPinnedBranch, getPinnedBranches, removePinnedBranch } from './config.js'
import { promptBranchSelection } from './pr-cli.js'

/**
 * 处理 pin branch 命令
 */
export async function handlePinCommand(branchName?: string): Promise<void> {
  console.log(cyan('\n📌  Pin Branch'))
  console.log(dim('Pin frequently used branches for quick access\n'))

  // 如果提供了分支名，直接 pin 该分支
  if (branchName) {
    const pinnedBranches = getPinnedBranches()
    if (pinnedBranches.includes(branchName)) {
      console.log(yellow(`⚠️  Branch '${branchName}' is already pinned`))
      return
    }
    addPinnedBranch(branchName)
    console.log(green(`✅  Branch '${branchName}' has been pinned`))
  }
  else {
    // 没有提供分支名，从分支列表中多选
    const { getAllBranches } = await import('../services/pr.js')
    const branches = getAllBranches()

    if (branches.length === 0) {
      console.log(yellow('⚠️  No branches found'))
      return
    }

    const pinnedBranches = getPinnedBranches()
    const availableBranches = branches.filter(b => !pinnedBranches.includes(b))

    if (availableBranches.length === 0) {
      console.log(yellow('⚠️  All branches are already pinned'))
      return
    }

    const selectedBranches = await promptBranchSelection(availableBranches, {
      title: '📌  Pin Branches',
      message: 'Select branches to pin (type to search, Space to select, Enter to confirm):',
      mode: 'multiple',
      filterPinned: true,
    }) as string[]

    if (selectedBranches.length === 0) {
      console.log(yellow('⚠️  No branches selected'))
      return
    }

    // 批量添加到固定列表
    selectedBranches.forEach((branch: string) => {
      addPinnedBranch(branch)
    })
    console.log(green(`✅  Pinned ${selectedBranches.length} branch(es)`))
  }

  // 显示当前所有固定的分支
  const updatedPinnedBranches = getPinnedBranches()
  console.log(cyan('\n📌  Current pinned branches:'))
  updatedPinnedBranches.forEach((branch, index) => {
    console.log(dim(`  ${index + 1}. ${branch}`))
  })
  console.log()
}

/**
 * 处理 unpin branch 命令
 */
export async function handleUnpinCommand(branchName?: string): Promise<void> {
  console.log(cyan('\n📍  Unpin Branch'))
  console.log(dim('Remove a branch from pinned list\n'))

  const pinnedBranches = getPinnedBranches()

  if (pinnedBranches.length === 0) {
    console.log(yellow('⚠️  No pinned branches found'))
    return
  }

  // 如果提供了分支名，直接 unpin 该分支
  if (branchName) {
    if (!pinnedBranches.includes(branchName)) {
      console.log(red(`❌  Branch '${branchName}' is not pinned`))
      return
    }
    removePinnedBranch(branchName)
    console.log(green(`✅  Branch '${branchName}' has been unpinned`))
  }
  else {
    // 没有提供分支名，从固定列表中多选
    const selectedBranches = await promptBranchSelection(pinnedBranches, {
      title: '📍  Unpin Branches',
      message: 'Select branches to unpin (type to search, Space to select, Enter to confirm):',
      mode: 'multiple',
    }) as string[]

    if (selectedBranches.length === 0) {
      console.log(yellow('⚠️  No branches selected'))
      return
    }

    // 批量移除
    selectedBranches.forEach((branch: string) => {
      removePinnedBranch(branch)
    })
    console.log(green(`✅  Unpinned ${selectedBranches.length} branch(es)`))
  }

  // 显示当前所有固定的分支
  const updatedPinnedBranches = getPinnedBranches()
  if (updatedPinnedBranches.length > 0) {
    console.log(cyan('\n📌  Current pinned branches:'))
    updatedPinnedBranches.forEach((branch, index) => {
      console.log(dim(`  ${index + 1}. ${branch}`))
    })
  }
  else {
    console.log(dim('\nNo pinned branches'))
  }
  console.log()
}

/**
 * 显示所有固定的分支
 */
export async function handleListPinnedCommand(): Promise<void> {
  console.log(cyan('\n📌  Pinned Branches'))
  console.log(dim('List of all pinned branches\n'))

  const pinnedBranches = getPinnedBranches()

  if (pinnedBranches.length === 0) {
    console.log(yellow('⚠️  No pinned branches found'))
    console.log(dim('Use "qkpr pin <branch-name>" to pin a branch\n'))
    return
  }

  pinnedBranches.forEach((branch, index) => {
    console.log(`  ${green(`${index + 1}.`)} ${branch}`)
  })
  console.log()
}
