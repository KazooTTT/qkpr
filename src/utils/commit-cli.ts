import { execSync } from 'node:child_process'
import inquirer from 'inquirer'
import inquirerAutoComplete from 'inquirer-autocomplete-prompt'
import { cyan, dim, green, red, yellow } from 'kolorist'
import {
  displayBranchName,
  fetchAvailableModels,
  generateBranchName,
  generateCommitMessageStream,
  getCommonModels,
  getStagedDiff,
  hasStagedChanges,
  performCommit,
} from '../services/commit.js'
import { copyToClipboard } from '../services/pr.js'
import {
  getCustomBranchNamePrompt,
  getCustomCommitMessagePrompt,
  getGeminiApiKey,
  getGeminiModel,
  getPromptLanguage,
  setCustomBranchNamePrompt,
  setCustomCommitMessagePrompt,
  setGeminiApiKey,
  setGeminiModel,
  setPromptLanguage,
} from './config.js'

// Register the autocomplete prompt
inquirer.registerPrompt('autocomplete', inquirerAutoComplete)

/**
 * 提示用户输入 API Key
 */
export async function promptApiKey(): Promise<string | null> {
  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Please enter your Gemini API Key:',
        choices: [
          { name: '✏️  Enter API Key', value: 'enter' },
          new inquirer.Separator(),
          { name: '↩️  Go back', value: 'back' },
        ],
      },
    ])

    if (action === 'back') {
      return null
    }

    const { apiKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'API Key:',
        mask: '*',
      },
    ])

    if (!apiKey || apiKey.trim().length === 0) {
      console.log(yellow('⚠️  Please enter a valid API Key, or go back'))
      continue
    }

    return apiKey.trim()
  }
}

/**
 * 询问是否保存 API Key
 */
export async function promptSaveApiKey(): Promise<boolean> {
  const { shouldSave } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'shouldSave',
      message: 'Save API Key for future use?',
      default: true,
    },
  ])

  return shouldSave
}

/**
 * 询问是否执行 commit
 */
export async function promptCommit(): Promise<boolean> {
  const { shouldCommit } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'shouldCommit',
      message: 'Commit with this message?',
      default: true,
    },
  ])

  return shouldCommit
}

/**
 * 询问是否 push
 */
export async function promptPush(): Promise<boolean> {
  const { shouldPush } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'shouldPush',
      message: 'Push the changes to the remote repository?',
      default: true,
    },
  ])

  return shouldPush
}

/**
 * 询问用户选择模型
 */
export async function promptModelSelection(apiKey?: string): Promise<string | null> {
  let availableModels: string[] = getCommonModels()
  const currentModel = getGeminiModel()

  // 尝试动态获取模型列表
  if (apiKey) {
    try {
      console.log(dim('Fetching available models...'))
      const fetchedModels = await fetchAvailableModels(apiKey)
      if (fetchedModels.length > 0) {
        availableModels = fetchedModels
        console.log(green('✅ Successfully fetched available models\n'))
      }
    }
    catch (error: any) {
      console.log(yellow(`⚠️  Could not fetch models dynamically: ${error.message}`))
      console.log(dim('Using common models list instead\n'))
    }
  }

  const { modelChoice } = await inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'modelChoice',
      message: 'Select a Gemini model (use arrow keys to navigate, type to search):',
      default: currentModel,
      pageSize: 10,
      source: (answersSoFar: any, input: string) => {
        const choices = [
          ...availableModels.map(model => ({
            name: model === currentModel ? `${model} (current)` : model,
            value: model,
          })),
          { name: '✏️  Enter custom model name', value: 'custom' },
          { name: '↩️  Go back', value: 'back' },
        ]

        if (!input) {
          return Promise.resolve(choices)
        }

        const filtered = choices.filter(choice =>
          choice.name.toLowerCase().includes(input.toLowerCase())
          || choice.value.toString().toLowerCase().includes(input.toLowerCase()),
        )

        return Promise.resolve(filtered)
      },
    },
  ])

  if (modelChoice === 'back') {
    return null
  }

  if (modelChoice === 'custom') {
    const { customModel } = await inquirer.prompt([
      {
        type: 'input',
        name: 'customModel',
        message: 'Enter model name (leave empty to go back):',
        default: '',
      },
    ])

    if (!customModel || customModel.trim().length === 0) {
      return null
    }

    return customModel.trim()
  }

  return modelChoice
}

/**
 * 询问用户操作选项
 */
export async function promptCommitAction(): Promise<'commit' | 'copy' | 'branch' | 'edit' | 'cancel'> {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '✅  Commit with this message', value: 'commit' },
        { name: '📋  Copy to clipboard', value: 'copy' },
        { name: '🌿  Generate branch name suggestion', value: 'branch' },
        { name: '✏️   Regenerate', value: 'edit' },
        { name: '❌  Cancel', value: 'cancel' },
      ],
    },
  ])

  return action
}

/**
 * 处理 commit 命令
 */
export async function handleCommitCommand(): Promise<void> {
  console.log(cyan('\n╔══════════════════════════════════════════════════════════════╗'))
  console.log(cyan('║              🤖  AI Commit Message Generator                 ║'))
  console.log(cyan('╚══════════════════════════════════════════════════════════════╝\n'))

  // 获取配置的模型并显示
  const model = getGeminiModel()
  console.log(dim(`Using model: ${model}`))

  // 显示当前的 prompt 模式
  const customCommitPrompt = getCustomCommitMessagePrompt()
  if (customCommitPrompt) {
    console.log(dim('Using custom commit message prompt'))
  }
  else {
    const promptLanguage = getPromptLanguage()
    console.log(dim(`Using ${promptLanguage} commit message prompt`))
  }
  console.log('') // 空行

  // 检查是否有暂存的更改
  if (!hasStagedChanges()) {
    console.log(yellow('⚠️  No staged changes found.'))
    console.log(dim('Please stage your changes using: git add <files>\n'))
    return // 返回主菜单而不是退出
  }

  // 获取 API Key
  let apiKey = getGeminiApiKey()
  if (!apiKey) {
    console.log(yellow('ℹ️  Gemini API Key not found.\n'))
    console.log(dim('You can get your API Key from: https://aistudio.google.com/apikey\n'))

    const newApiKey = await promptApiKey()

    if (!newApiKey) {
      console.log(yellow('\n⚠️  Cancelled\n'))
      return
    }

    apiKey = newApiKey

    const shouldSave = await promptSaveApiKey()
    if (shouldSave) {
      setGeminiApiKey(apiKey)
      console.log(green('\n✅  API Key saved successfully!\n'))
    }
  }

  // 获取 git diff
  const diff = getStagedDiff()
  if (!diff) {
    console.log(red('❌  Failed to get git diff'))
    return // 返回主菜单而不是退出
  }

  try {
    // 使用流式生成 commit message
    const commitMessage = await generateCommitMessageStream(apiKey, diff, model)

    // 询问用户操作
    let action = await promptCommitAction()

    // 处理分支名生成选项
    while (action === 'branch') {
      try {
        const branchName = await generateBranchName(apiKey, diff, model)
        displayBranchName(branchName)
        action = await promptCommitAction()
      }
      catch (error: any) {
        console.log(red(`\n❌  Error generating branch name: ${error.message}\n`))
        action = await promptCommitAction()
      }
    }

    switch (action) {
      case 'commit': {
        const success = performCommit(commitMessage)
        if (success) {
          console.log(green('\n✅  Commit successful!\n'))
          const shouldPush = await promptPush()
          if (shouldPush) {
            const branchName = execSync('git branch --show-current').toString().trim()
            if (branchName) {
              const pushSuccess = pushBranchToRemote(branchName)
              if (!pushSuccess) {
                console.log(red('❌  Failed to push changes'))
              }
            }
            else {
              console.log(red('❌  Could not determine the current branch name.'))
            }
          }
        }
        else {
          console.log(red('\n❌  Commit failed\n'))
          // 返回主菜单而不是退出
        }
        break
      }
      case 'copy': {
        if (copyToClipboard(commitMessage)) {
          console.log(green('\n✅  Commit message copied to clipboard\n'))
        }
        else {
          console.log(yellow('\n⚠️  Could not copy to clipboard\n'))
        }
        break
      }
      case 'edit': {
        console.log(yellow('\n🔄  Regenerating...\n'))
        await handleCommitCommand()
        break
      }
      case 'cancel': {
        console.log(dim('\n❌  Cancelled\n'))
        // 返回主菜单而不是退出
      }
    }
  }
  catch (error: any) {
    console.log(red(`\n❌  Error: ${error.message}\n`))
    // 返回主菜单而不是退出
  }
}

/**
 * 配置 API Key
 */
export async function handleConfigCommand(): Promise<void> {
  console.log(cyan('\n══════════════════════════════════════════════════════════════╗'))
  console.log(cyan('║                     ⚙️   Configuration                        ║'))
  console.log(cyan('╚══════════════════════════════════════════════════════════════╝\n'))

  console.log(dim('Get your API Key from: https://aistudio.google.com/apikey\n'))

  const apiKey = await promptApiKey()

  if (!apiKey) {
    console.log(yellow('\n⚠️  Cancelled\n'))
    return
  }

  setGeminiApiKey(apiKey)

  console.log(green('\n✅  API Key configured successfully!\n'))
}

/**
 * 配置模型
 */
export async function handleConfigModelCommand(): Promise<void> {
  console.log(cyan('\n╔══════════════════════════════════════════════════════════════╗'))
  console.log(cyan('║                   🤖  Model Configuration                    ║'))
  console.log(cyan('╚══════════════════════════════════════════════════════════════╝\n'))

  const currentModel = getGeminiModel()
  console.log(dim(`Current model: ${currentModel}\n`))

  // 获取 API Key 用于动态获取模型列表
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    console.log(yellow('ℹ️  No API Key found. Using common models list.'))
    console.log(dim('Configure API Key first to fetch all available models dynamically.\n'))
  }

  const model = await promptModelSelection(apiKey)

  if (!model) {
    console.log(yellow('\n⚠️  Cancelled\n'))
    return
  }

  setGeminiModel(model)

  console.log(green(`\n✅  Model configured successfully: ${model}\n`))
}

/**
 * 创建并切换到新分支
 */
export async function createAndCheckoutBranch(branchName: string): Promise<boolean> {
  try {
    console.log(cyan(`🌿  Creating and switching to branch: ${branchName}`))
    execSync(`git checkout -b ${branchName}`, {
      stdio: 'inherit',
    })

    console.log(green(`✅  Successfully created and switched to: ${branchName}\n`))
    return true
  }
  catch {
    console.log(red('❌  Failed to create branch'))
    return false
  }
}

/**
 * 检查分支是否已推送到远程
 */
export function isBranchPushed(branchName: string): boolean {
  try {
    // 检查远程分支是否存在
    const remoteBranches = execSync(`git ls-remote --heads origin ${branchName}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim()

    return remoteBranches.length > 0
  }
  catch {
    return false
  }
}

/**
 * 推送分支到远程
 */
export function pushBranchToRemote(branchName: string): boolean {
  try {
    console.log(cyan(`📤  Pushing branch to remote: ${branchName}`))
    execSync(`git push -u origin ${branchName}`, {
      stdio: 'inherit',
    })

    console.log(green(`✅  Branch pushed successfully: ${branchName}\n`))
    return true
  }
  catch {
    console.log(red('❌  Failed to push branch to remote'))
    return false
  }
}

/**
 * 询问是否创建并切换到建议的分支
 */
export async function promptCreateBranch(branchName: string): Promise<boolean> {
  const { shouldCreate } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'shouldCreate',
      message: `Create and switch to branch '${branchName}'?`,
      default: false,
    },
  ])

  return shouldCreate
}

/**
 * 生成分支名称
 */
export async function handleBranchCommand(): Promise<void> {
  console.log(cyan('\n╔══════════════════════════════════════════════════════════════╗'))
  console.log(cyan('║              🌿  AI Branch Name Generator                    ║'))
  console.log(cyan('╚══════════════════════════════════════════════════════════════╝\n'))

  // 获取配置的模型并显示
  const model = getGeminiModel()
  console.log(dim(`Using model: ${model}`))

  // 显示当前的 prompt 模式
  const customBranchPrompt = getCustomBranchNamePrompt()
  if (customBranchPrompt) {
    console.log(dim('Using custom branch name prompt'))
  }
  else {
    const promptLanguage = getPromptLanguage()
    console.log(dim(`Using ${promptLanguage} branch name prompt`))
  }
  console.log('') // 空行

  // 检查是否有暂存的更改
  if (!hasStagedChanges()) {
    console.log(yellow('⚠️  No staged changes found.'))
    console.log(dim('Please stage your changes using: git add <files>\n'))
    return // 返回主菜单而不是退出
  }

  // 获取 API Key
  let apiKey = getGeminiApiKey()
  if (!apiKey) {
    console.log(yellow('ℹ️  Gemini API Key not found.\n'))
    console.log(dim('You can get your API Key from: https://aistudio.google.com/apikey\n'))

    const newApiKey = await promptApiKey()

    if (!newApiKey) {
      console.log(yellow('\n⚠️  Cancelled\n'))
      return
    }

    apiKey = newApiKey

    const shouldSave = await promptSaveApiKey()
    if (shouldSave) {
      setGeminiApiKey(apiKey)
      console.log(green('\n✅  API Key saved successfully!\n'))
    }
  }

  // 获取 git diff
  const diff = getStagedDiff()
  if (!diff) {
    console.log(red('❌  Failed to get git diff'))
    return // 返回主菜单而不是退出
  }

  try {
    // 生成分支名称
    const branchName = await generateBranchName(apiKey, diff, model)
    displayBranchName(branchName)

    // 询问是否创建并切换分支
    const shouldCreate = await promptCreateBranch(branchName)

    if (shouldCreate) {
      const success = await createAndCheckoutBranch(branchName)
      if (!success) {
        // 返回主菜单而不是退出
      }
    }
    else {
      // 询问是否复制到剪贴板
      const { shouldCopy } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldCopy',
          message: 'Copy branch name to clipboard?',
          default: true,
        },
      ])

      if (shouldCopy) {
        if (copyToClipboard(branchName)) {
          console.log(green('\n✅  Branch name copied to clipboard\n'))
        }
        else {
          console.log(yellow('\n⚠️  Could not copy to clipboard\n'))
        }
      }
      else {
        console.log(dim('\n'))
      }
    }
  }
  catch (error: any) {
    console.log(red(`\n❌  Error: ${error.message}\n`))
    // 返回主菜单而不是退出
  }
}

/**
 * 配置语言
 */
export async function handleConfigPromptLangCommand(): Promise<void> {
  console.log(cyan('\n╔══════════════════════════════════════════════════════════════╗'))
  console.log(cyan('║              🌐  Prompt Language Configuration             ║'))
  console.log(cyan('╚══════════════════════════════════════════════════════════════╝\n'))

  const currentLanguage = getPromptLanguage()
  console.log(dim(`Current prompt language: ${currentLanguage}\n`))

  const { language } = await inquirer.prompt([
    {
      type: 'list',
      name: 'language',
      message: 'Select a language for the prompts:',
      choices: [
        { name: '🇨🇳  Chinese', value: 'zh' },
        { name: '🇺🇸  English', value: 'en' },
        new inquirer.Separator(),
        { name: '↩️   Go back', value: 'back' },
      ],
      default: currentLanguage,
    },
  ])

  if (language === 'back') {
    console.log(yellow('\n⚠️  Cancelled\n'))
    return
  }

  setPromptLanguage(language)

  console.log(green(`\n✅  Prompt language configured successfully: ${language}\n`))
}

/**
 * 配置自定义 Prompts
 */
export async function handleConfigPromptsCommand(): Promise<void> {
  console.log(cyan('\n╔══════════════════════════════════════════════════════════════╗'))
  console.log(cyan('║              📝  Custom Prompts Configuration              ║'))
  console.log(cyan('╚══════════════════════════════════════════════════════════════╝\n'))

  const currentCommitPrompt = getCustomCommitMessagePrompt()
  const currentBranchPrompt = getCustomBranchNamePrompt()

  console.log(dim('Current custom commit message prompt:'))
  console.log(currentCommitPrompt ? yellow(currentCommitPrompt) : dim('Not set'))
  console.log(dim('\nCurrent custom branch name prompt:'))
  console.log(currentBranchPrompt ? yellow(currentBranchPrompt) : dim('Not set'))

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '✏️  Set custom commit message prompt', value: 'commit' },
        { name: '✏️  Set custom branch name prompt', value: 'branch' },
        new inquirer.Separator(),
        { name: '🗑️  Clear custom commit message prompt', value: 'clear-commit' },
        { name: '🗑️  Clear custom branch name prompt', value: 'clear-branch' },
        new inquirer.Separator(),
        { name: '↩️   Go back', value: 'back' },
      ],
    },
  ])

  switch (action) {
    case 'commit': {
      const { prompt } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'prompt',
          message: 'Enter your custom commit message prompt:',
          default: currentCommitPrompt,
        },
      ])
      if (prompt) {
        setCustomCommitMessagePrompt(prompt)
        console.log(green('\n✅  Custom commit message prompt saved!\n'))
      }
      else {
        console.log(yellow('\n⚠️  Cancelled\n'))
      }
      break
    }
    case 'branch': {
      const { prompt } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'prompt',
          message: 'Enter your custom branch name prompt:',
          default: currentBranchPrompt,
        },
      ])
      if (prompt) {
        setCustomBranchNamePrompt(prompt)
        console.log(green('\n✅  Custom branch name prompt saved!\n'))
      }
      else {
        console.log(yellow('\n⚠️  Cancelled\n'))
      }
      break
    }
    case 'clear-commit': {
      setCustomCommitMessagePrompt('')
      console.log(green('\n✅  Custom commit message prompt cleared!\n'))
      break
    }
    case 'clear-branch': {
      setCustomBranchNamePrompt('')
      console.log(green('\n✅  Custom branch name prompt cleared!\n'))
      break
    }
    case 'back': {
      console.log(yellow('\n⚠️  Cancelled\n'))
      break
    }
  }
}
