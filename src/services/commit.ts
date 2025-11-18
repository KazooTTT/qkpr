import { execSync } from 'node:child_process'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { cyan, green, yellow } from 'kolorist'
import ora from 'ora'
import { BRANCH_NAME_PROMPT, COMMIT_MESSAGE_PROMPT } from '../config/prompts.js'

export interface CommitMessageResult {
  message: string
  branchName: string
}

/**
 * 获取暂存区的 git diff
 */
export function getStagedDiff(): string {
  try {
    const diff = execSync('git diff --cached', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
      maxBuffer: 10 * 1024 * 1024, // 10MB
    }).trim()

    return diff
  }
  catch {
    return ''
  }
}

/**
 * 检查是否有暂存的更改
 */
export function hasStagedChanges(): boolean {
  try {
    const status = execSync('git diff --cached --name-only', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim()

    return status.length > 0
  }
  catch {
    return false
  }
}

/**
 * 获取常用的 Gemini 模型列表
 * Last updated: 2025.11.17 (fetched from Google Gemini API)
 * Total available models: 40
 */
export function getCommonModels(): string[] {
  return [
    // Gemini 2.5 Models (Latest)
    'gemini-2.5-pro',
    'gemini-2.5-pro-preview-03-25',
    'gemini-2.5-pro-preview-05-06',
    'gemini-2.5-pro-preview-06-05',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash-preview-05-20',
    'gemini-2.5-flash-lite-preview-06-17',
    'gemini-2.5-flash-image',
    'gemini-2.5-computer-use-preview-10-2025',

    // Gemini 2.0 Models
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash-lite-001',
    'gemini-2.0-pro-exp',
    'gemini-2.0-flash-thinking-exp',

    // Latest Aliases
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-pro-latest',

    // Experimental Models
    'gemini-exp-1206',
    'learnlm-2.0-flash-experimental',

    // Gemma Models
    'gemma-3-27b-it',
    'gemma-3-12b-it',
    'gemma-3-4b-it',
    'gemma-3-1b-it',
  ]
}

interface GeminiModel {
  name: string
  supportedGenerationMethods?: string[]
}

interface GeminiModelsResponse {
  models: GeminiModel[]
}

/**
 * 从 Google API 动态获取可用的 Gemini 模型列表
 */
export async function fetchAvailableModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`)
    }

    const data = await response.json() as GeminiModelsResponse

    // 提取模型名称（去掉 'models/' 前缀）
    const modelNames = data.models
      .map(model => model.name.split('/')[1])
      .filter(name => name) // 过滤掉空值

    return modelNames
  }
  catch (error: any) {
    throw new Error(`Failed to fetch available models: ${error.message}`)
  }
}

/**
 * 使用 Gemini 生成 commit message
 */
export async function generateCommitMessageStream(
  apiKey: string,
  diff: string,
  modelName: string,
): Promise<string> {
  const startTime = Date.now()
  const spinner = ora({
    text: 'Analyzing your changes with Gemini AI...',
    color: 'cyan',
  }).start()

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: modelName })

    spinner.text = 'Generating commit message...'
    const commitResult = await model.generateContent([
      COMMIT_MESSAGE_PROMPT,
      `\n\nGit Diff:\n${diff}`,
    ])
    const commitMessage = commitResult.response.text().trim()

    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)

    spinner.succeed(`AI generation completed in ${duration}s`)

    // 显示生成的内容
    console.log(green('\n✅  Generated commit message:\n'))
    console.log(cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
    console.log(commitMessage)
    console.log(cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'))

    return commitMessage
  }
  catch (error: any) {
    spinner.fail('Failed to generate commit message')

    // 处理 API key 错误
    if (error.message?.includes('API key')) {
      throw new Error('Invalid API key. Please check your Gemini API key.')
    }

    // 处理速率限制错误
    if (error.message?.includes('429') || error.message?.includes('Too Many Requests') || error.message?.includes('Resource exhausted')) {
      throw new Error('API rate limit exceeded. Please wait a moment and try again.\n  You can also try using a different API key or check your quota at:\n  https://aistudio.google.com/apikey')
    }

    // 处理网络错误
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      throw new Error('Network error. Please check your internet connection and try again.')
    }

    // 其他错误
    throw new Error(`Failed to generate commit message: ${error.message}`)
  }
}

/**
 * 生成分支名建议（可选）
 */
export async function generateBranchName(
  apiKey: string,
  diff: string,
  modelName: string,
): Promise<string> {
  const spinner = ora({
    text: 'Suggesting branch name...',
    color: 'yellow',
  }).start()

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: modelName })

    const branchResult = await model.generateContent([
      BRANCH_NAME_PROMPT,
      `\n\nGit Diff:\n${diff}`,
    ])
    const branchName = branchResult.response.text().trim()

    spinner.succeed('Branch name suggested!')
    return branchName
  }
  catch (error: any) {
    spinner.fail('Failed to generate branch name')
    throw error
  }
}

/**
 * 执行 git commit
 */
export function performCommit(message: string): boolean {
  try {
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
      stdio: 'inherit',
    })
    return true
  }
  catch {
    return false
  }
}

/**
 * 显示分支名建议
 */
export function displayBranchName(branchName: string): void {
  console.log(yellow('💡  Suggested branch name:\n'))
  console.log(green(`   ${branchName}\n`))
}
