import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface Config {
  geminiApiKey?: string
  geminiModel?: string
  pinnedBranches?: string[]
  promptLanguage?: 'en' | 'zh'
  customCommitMessagePrompt?: string
  customBranchNamePrompt?: string
}

const CONFIG_DIR = join(homedir(), '.qkpr')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

/**
 * 确保配置目录存在
 */
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

/**
 * 读取配置
 */
export function readConfig(): Config {
  ensureConfigDir()

  if (!existsSync(CONFIG_FILE)) {
    return {}
  }

  try {
    const content = readFileSync(CONFIG_FILE, 'utf-8')
    return JSON.parse(content)
  }
  catch {
    return {}
  }
}

/**
 * 写入配置
 */
export function writeConfig(config: Config): void {
  ensureConfigDir()
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
}

/**
 * 获取 Gemini API Key
 * 优先级：配置文件 > 环境变量 QUICK_PR_GEMINI_API_KEY > GEMINI_API_KEY
 *
 * You can set the API key in either:
 * 1. Config file (~/.qkpr/config.json) via `qkpr config` command
 * 2. Environment variable: export QKPR_GEMINI_API_KEY=your_api_key
 * 3. Environment variable (legacy): export GEMINI_API_KEY=your_api_key
 */
export function getGeminiApiKey(): string | undefined {
  const config = readConfig()
  return config.geminiApiKey || process.env.QUICK_PR_GEMINI_API_KEY || process.env.GEMINI_API_KEY
}

/**
 * 设置 Gemini API Key
 */
export function setGeminiApiKey(apiKey: string): void {
  const config = readConfig()
  config.geminiApiKey = apiKey
  writeConfig(config)
}

export function getGeminiModel(): string {
  const config = readConfig()
  return config.geminiModel || process.env.QUICK_PR_GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash'
}

export function setGeminiModel(model: string): void {
  const config = readConfig()
  config.geminiModel = model
  writeConfig(config)
}

/**
 * 获取已固定的分支列表
 */
export function getPinnedBranches(): string[] {
  const config = readConfig()
  return config.pinnedBranches || []
}

/**
 * 添加固定分支
 */
export function addPinnedBranch(branch: string): void {
  const config = readConfig()
  const pinnedBranches = config.pinnedBranches || []

  if (!pinnedBranches.includes(branch)) {
    pinnedBranches.push(branch)
    config.pinnedBranches = pinnedBranches
    writeConfig(config)
  }
}

/**
 * 移除固定分支
 */
export function removePinnedBranch(branch: string): void {
  const config = readConfig()
  const pinnedBranches = config.pinnedBranches || []

  const index = pinnedBranches.indexOf(branch)
  if (index > -1) {
    pinnedBranches.splice(index, 1)
    config.pinnedBranches = pinnedBranches
    writeConfig(config)
  }
}

/**
 * 检查分支是否已固定
 */
export function isBranchPinned(branch: string): boolean {
  const pinnedBranches = getPinnedBranches()
  return pinnedBranches.includes(branch)
}

/**
 * 获取语言
 */
export function getPromptLanguage(): 'en' | 'zh' {
  const config = readConfig()
  return config.promptLanguage || 'zh'
}

/**
 * 设置语言
 */
export function setPromptLanguage(language: 'en' | 'zh'): void {
  const config = readConfig()
  config.promptLanguage = language
  writeConfig(config)
}

/**
 * 获取自定义 Commit Message Prompt
 */
export function getCustomCommitMessagePrompt(): string | undefined {
  const config = readConfig()
  return config.customCommitMessagePrompt
}

/**
 * 设置自定义 Commit Message Prompt
 */
export function setCustomCommitMessagePrompt(prompt: string): void {
  const config = readConfig()
  config.customCommitMessagePrompt = prompt
  writeConfig(config)
}

/**
 * 获取自定义 Branch Name Prompt
 */
export function getCustomBranchNamePrompt(): string | undefined {
  const config = readConfig()
  return config.customBranchNamePrompt
}

/**
 * 设置自定义 Branch Name Prompt
 */
export function setCustomBranchNamePrompt(prompt: string): void {
  const config = readConfig()
  config.customBranchNamePrompt = prompt
  writeConfig(config)
}
