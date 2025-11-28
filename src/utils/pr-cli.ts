import inquirer from 'inquirer'
import autocompletePrompt from 'inquirer-autocomplete-prompt'
// @ts-expect-error - no types available
import searchCheckbox from 'inquirer-search-checkbox'
import { cyan, dim, green, magenta, yellow } from 'kolorist'
import { getBranchesWithInfo } from '../services/pr.js'
import { addPinnedBranch, getPinnedBranches, removePinnedBranch } from './config.js'
import AutocompletePinPrompt from './prompts/autocomplete-pin.js'

// Register prompts
inquirer.registerPrompt('autocomplete', autocompletePrompt)
inquirer.registerPrompt('search-checkbox', searchCheckbox)
inquirer.registerPrompt('autocomplete-pin', AutocompletePinPrompt)

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
    defaultSelected?: string[]
  },
): Promise<string | string[]> {
  const { title, message, mode, filterPinned = false, defaultSelected = [] } = options

  console.log(cyan(`\n${title}`))
  console.log(dim(''))

  if (branches.length === 0) {
    console.log(yellow('⚠️  No branches found'))
    return mode === 'single' ? '' : []
  }

  // 获取分支详细信息
  const branchInfos = getBranchesWithInfo(branches)

  if (mode === 'single') {
    // Lock the sorting order based on the initial pinned state
    const sortingPinnedBranches = getPinnedBranches()

    // 动态构建选项列表的函数
    const searchBranches = async (_answers: any, input = ''): Promise<any[]> => {
      // Get current pinned state for UI icons only
      const currentPinnedBranches = getPinnedBranches()

      // Group 1: Initially Pinned Branches (Keep them at the top)
      const topGroupBranches = branchInfos.filter(b => sortingPinnedBranches.includes(b.name))

      // Group 2: Initially Regular Branches
      const bottomGroupBranches = branchInfos.filter(b => !sortingPinnedBranches.includes(b.name))

      // If filterPinned is true, we might want to hide initially pinned ones?
      // But the original logic was to hide them if they are already pinned.
      // For now, let's assume we show all unless filterPinned is strictly handled.
      // Original logic: const pinnedBranches = filterPinned ? [] : allPinnedBranches
      // If filterPinned is true, we just empty the top group?
      // Let's keep it simple and consistent with previous behavior but stabilized.
      const effectiveTopGroup = filterPinned ? [] : topGroupBranches

      // Sort Top Group by configuration order
      effectiveTopGroup.sort((a, b) => {
        const aIndex = sortingPinnedBranches.indexOf(a.name)
        const bIndex = sortingPinnedBranches.indexOf(b.name)
        return aIndex - bIndex
      })

      // Sort Bottom Group alphabetically
      bottomGroupBranches.sort((a, b) => a.name.localeCompare(b.name))

      // Limit bottom group size
      const MAX_BRANCHES = 100
      const displayBottomGroup = bottomGroupBranches.slice(0, MAX_BRANCHES)

      // Build choices
      const choices: any[] = []

      // Combine groups for a unified list display
      // Still keeping effectiveTopGroup first to maintain "Pinned First" logic
      const allDisplayBranches = [...effectiveTopGroup, ...displayBottomGroup]

      allDisplayBranches.forEach((branch) => {
        const isPinnedNow = currentPinnedBranches.includes(branch.name)
        choices.push({
          name: `${isPinnedNow ? '📌' : '  '} ${branch.name.padEnd(45)} ${dim(`(${branch.lastCommitTimeFormatted})`)}`,
          value: branch.name,
          short: branch.name,
        })
      })

      // Add a cancel option at the end of the list, only if not in filterPinned mode
      if (!filterPinned) { // Only add cancel if we are showing all branches, otherwise it's weird to cancel from a filtered list.
        choices.push(new inquirer.Separator(' ')) // Optional separator before cancel
        choices.push({
          name: dim('  [Cancel PR creation]'),
          value: '__CANCEL__',
          short: 'Cancel',
        })
      }

      const lowerInput = input.toLowerCase()

      // If searching, search across ALL branches, not just the displayed ones
      if (lowerInput.trim()) {
        const searchResults = branchInfos.filter(branch =>
          branch.name.toLowerCase().includes(lowerInput),
        )

        // Build choices from search results
        const searchChoices: any[] = searchResults.map((branch) => {
          const isPinnedNow = currentPinnedBranches.includes(branch.name)
          return {
            name: `${isPinnedNow ? '📌' : '  '} ${branch.name.padEnd(45)} ${dim(`(${branch.lastCommitTimeFormatted})`)}`,
            value: branch.name,
            short: branch.name,
          }
        })

        // Add cancel option
        searchChoices.push(new inquirer.Separator(' '))
        searchChoices.push({
          name: dim('  [Cancel PR creation]'),
          value: '__CANCEL__',
          short: 'Cancel',
        })

        return searchChoices
      }

      // No search input, return the filtered list
      return choices.filter((choice: any) => {
        // Keep separators and cancel option
        if (!choice.value || choice.value === '__CANCEL__')
          return true
        // Filter by branch name
        return choice.value.toLowerCase().includes(lowerInput)
      })
    }

    const { selectedBranch } = await inquirer.prompt([
      {
        type: 'autocomplete-pin',
        name: 'selectedBranch',
        message,
        source: searchBranches,
        pageSize: 20,
        onPin: async (branchName: string) => {
          const currentPinned = getPinnedBranches()
          if (currentPinned.includes(branchName)) {
            removePinnedBranch(branchName)
          }
          else {
            addPinnedBranch(branchName)
          }
        },
      },
    ])
    return selectedBranch
  }
  else {
    // Multiple selection logic (unchanged mainly, but reused logic partially if needed)
    // For simplicity, keep original logic for multiple selection as it uses checkboxes

    const pinnedBranchNames = getPinnedBranches()
    const allPinnedBranches = branchInfos.filter(b => pinnedBranchNames.includes(b.name))
    const regularBranches = branchInfos.filter(b => !pinnedBranchNames.includes(b.name))
    const pinnedBranches = filterPinned ? [] : allPinnedBranches

    const choices: any[] = []

    // Add a cancel option here too, if it makes sense for multiple selection mode
    if (!filterPinned) {
      choices.push(new inquirer.Separator(' '))
      choices.push({
        name: dim('  [Cancel PR creation]'),
        value: '__CANCEL__',
        short: 'Cancel',
      })
    }

    pinnedBranches.sort((a, b) => {
      const aIndex = pinnedBranchNames.indexOf(a.name)
      const bIndex = pinnedBranchNames.indexOf(b.name)
      return aIndex - bIndex
    })
    regularBranches.sort((a, b) => a.name.localeCompare(b.name))

    if (regularBranches.length > 100) {
      regularBranches.splice(100)
    }

    if (pinnedBranches.length > 0) {
      choices.push(new inquirer.Separator(magenta('━━━━━━━━ 📌 Pinned Branches ━━━━━━━━')))
      pinnedBranches.forEach((branch) => {
        choices.push({
          name: `📌 ${branch.name.padEnd(45)} ${dim(`(${branch.lastCommitTimeFormatted})`)}`,
          value: branch.name,
          short: branch.name,
          checked: defaultSelected.includes(branch.name),
        })
      })
      choices.push(new inquirer.Separator(' '))
    }
    if (regularBranches.length > 0) {
      choices.push(new inquirer.Separator(cyan('━━━━━━━━ 🌿 All Branches (Alphabetical) ━━━━━━━━')))
      regularBranches.forEach((branch) => {
        choices.push({
          name: `   ${branch.name.padEnd(45)} ${dim(`(${branch.lastCommitTimeFormatted})`)}`,
          value: branch.name,
          short: branch.name,
          checked: defaultSelected.includes(branch.name),
        })
      })
      choices.push(new inquirer.Separator(' '))
    }

    const { selectedBranches } = await inquirer.prompt([
      {
        type: 'search-checkbox',
        name: 'selectedBranches',
        message,
        choices: choices.filter((c: any) => c.value),
      },
    ])

    return selectedBranches || []
  }
}

/**
 * 提示选择目标分支
 */
export async function promptTargetBranch(branches: string[], currentBranch: string): Promise<string | null> {
  console.log(dim(`Current branch: ${currentBranch}\n`))

  // 过滤掉当前分支
  const availableBranches = branches.filter(b => b !== currentBranch)

  const targetBranch = await promptBranchSelection(availableBranches, {
    title: '🎯  Target Branch Selection',
    message: 'Select target branch (type to search):',
    mode: 'single',
  }) as string

  if (targetBranch === '__CANCEL__') {
    console.log(yellow('\n🚫 PR creation cancelled.'))
    return null
  }

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
      default: true,
    },
  ])

  return createMergeBranch
}

/**
 * 确认是否自动合并原始分支到合并分支
 */
export async function promptAutoMergeSource(sourceBranch: string, targetBranch: string): Promise<boolean> {
  console.log(yellow(`\n🔄  Merge branch created successfully!`))
  console.log(dim(`   This branch is based on '${targetBranch}' and can be used to test the merge.`))

  const { shouldAutoMerge } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'shouldAutoMerge',
      message: `Auto-merge '${sourceBranch}' to detect potential conflicts now?`,
      default: false,
    },
  ])

  return shouldAutoMerge
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
