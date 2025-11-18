import inquirer from 'inquirer'
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
import { getGeminiApiKey, getGeminiModel, setGeminiApiKey, setGeminiModel } from './config.js'

/**
 * 提示用户输入 API Key
 */
export async function promptApiKey(): Promise<string> {
  const { apiKey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: 'Please enter your Gemini API Key:',
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return 'API Key cannot be empty'
        }
        return true
      },
    },
  ])

  return apiKey.trim()
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
 * 询问用户选择模型
 */
export async function promptModelSelection(apiKey?: string): Promise<string> {
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
      type: 'list',
      name: 'modelChoice',
      message: 'Select a Gemini model:',
      default: currentModel,
      choices: [
        ...availableModels.map(model => ({
          name: model === currentModel ? `${model} (current)` : model,
          value: model,
        })),
        { name: '✏️  Enter custom model name', value: 'custom' },
      ],
    },
  ])

  if (modelChoice === 'custom') {
    const { customModel } = await inquirer.prompt([
      {
        type: 'input',
        name: 'customModel',
        message: 'Enter model name:',
        default: currentModel,
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return 'Model name cannot be empty'
          }
          return true
        },
      },
    ])
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
  console.log(dim(`Using model: ${model}\n`))

  // 检查是否有暂存的更改
  if (!hasStagedChanges()) {
    console.log(yellow('⚠️  No staged changes found.'))
    console.log(dim('Please stage your changes using: git add <files>\n'))
    process.exit(1)
  }

  // 获取 API Key
  let apiKey = getGeminiApiKey()
  if (!apiKey) {
    console.log(yellow('ℹ️  Gemini API Key not found.\n'))
    console.log(dim('You can get your API Key from: https://aistudio.google.com/apikey\n'))

    apiKey = await promptApiKey()

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
    process.exit(1)
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
        }
        else {
          console.log(red('\n❌  Commit failed\n'))
          process.exit(1)
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
        process.exit(0)
      }
    }
  }
  catch (error: any) {
    console.log(red(`\n❌  Error: ${error.message}\n`))
    process.exit(1)
  }
}

/**
 * 配置 API Key
 */
export async function handleConfigCommand(): Promise<void> {
  console.log(cyan('\n╔══════════════════════════════════════════════════════════════╗'))
  console.log(cyan('║                    ⚙️   Configuration                         ║'))
  console.log(cyan('╚══════════════════════════════════════════════════════════════╝\n'))

  console.log(dim('Get your API Key from: https://aistudio.google.com/apikey\n'))

  const apiKey = await promptApiKey()
  setGeminiApiKey(apiKey)

  console.log(green('\n✅  API Key configured successfully!\n'))
}

/**
 * 配置模型
 */
export async function handleConfigModelCommand(): Promise<void> {
  console.log(cyan('\n╔══════════════════════════════════════════════════════════════╗'))
  console.log(cyan('║                  🤖  Model Configuration                      ║'))
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
  setGeminiModel(model)

  console.log(green(`\n✅  Model configured successfully: ${model}\n`))
}

/**
 * 生成分支名称
 */
export async function handleBranchCommand(): Promise<void> {
  console.log(cyan('\n╔══════════════════════════════════════════════════════════════╗'))
  console.log(cyan('║              🌿  AI Branch Name Generator                     ║'))
  console.log(cyan('╚══════════════════════════════════════════════════════════════╝\n'))

  // 获取配置的模型并显示
  const model = getGeminiModel()
  console.log(dim(`Using model: ${model}\n`))

  // 检查是否有暂存的更改
  if (!hasStagedChanges()) {
    console.log(yellow('⚠️  No staged changes found.'))
    console.log(dim('Please stage your changes using: git add <files>\n'))
    process.exit(1)
  }

  // 获取 API Key
  let apiKey = getGeminiApiKey()
  if (!apiKey) {
    console.log(yellow('ℹ️  Gemini API Key not found.\n'))
    console.log(dim('You can get your API Key from: https://aistudio.google.com/apikey\n'))

    apiKey = await promptApiKey()

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
    process.exit(1)
  }

  try {
    // 生成分支名称
    const branchName = await generateBranchName(apiKey, diff, model)
    displayBranchName(branchName)

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
  catch (error: any) {
    console.log(red(`\n❌  Error: ${error.message}\n`))
    process.exit(1)
  }
}
