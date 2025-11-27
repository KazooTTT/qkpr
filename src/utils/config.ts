import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface Config {
  geminiApiKey?: string
  geminiModel?: string
  pinnedBranches?: string[] // deprecated: 全局 pinned branches,仅用于迁移
  repositoryPinnedBranches?: Record<string, string[]> // 按仓库存储的 pinned branches
  promptLanguage?: 'en' | 'zh'
  customCommitMessagePrompt?: string
  customBranchNamePrompt?: string
}

const CONFIG_DIR = join(homedir(), '.qkpr')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

/**
 * 获取当前仓库的唯一标识
 * 使用 git remote URL 的 hash 值作为仓库标识
 */
function getRepositoryId(): string {
  try {
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()
    // 标准化 URL:移除 .git 后缀和协议差异
    const normalizedUrl = remoteUrl
      .replace(/\.git$/, '')
      .replace(/^https?:\/\//, '')
      .replace(/^git@/, '')
      .replace(/:/g, '/')
      .toLowerCase()

    // 使用 hash 来缩短标识符
    return createHash('md5').update(normalizedUrl).digest('hex').substring(0, 12)
  }
  catch {
    // 如果不是 git 仓库或没有 remote,使用当前目录路径
    return createHash('md5').update(process.cwd()).digest('hex').substring(0, 12)
  }
}

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
 * 获取已固定的分支列表(仓库级别)
 */
export function getPinnedBranches(): string[] {
  const config = readConfig()
  const repoId = getRepositoryId()

  // 如果有仓库级别的配置,使用它
  if (config.repositoryPinnedBranches?.[repoId]) {
    return config.repositoryPinnedBranches[repoId]
  }

  // 否则,尝试从旧的全局配置迁移
  if (config.pinnedBranches && config.pinnedBranches.length > 0) {
    // 迁移到新的仓库级别配置
    if (!config.repositoryPinnedBranches) {
      config.repositoryPinnedBranches = {}
    }
    config.repositoryPinnedBranches[repoId] = [...config.pinnedBranches]

    // 清理旧配置
    delete config.pinnedBranches

    writeConfig(config)
    return config.repositoryPinnedBranches[repoId]
  }

  return []
}

/**
 * 添加固定分支(仓库级别)
 */
export function addPinnedBranch(branch: string): void {
  const config = readConfig()
  const repoId = getRepositoryId()

  if (!config.repositoryPinnedBranches) {
    config.repositoryPinnedBranches = {}
  }

  const pinnedBranches = config.repositoryPinnedBranches[repoId] || []

  if (!pinnedBranches.includes(branch)) {
    pinnedBranches.push(branch)
    config.repositoryPinnedBranches[repoId] = pinnedBranches
    writeConfig(config)
  }
}

/**
 * 移除固定分支(仓库级别)
 */
export function removePinnedBranch(branch: string): void {
  const config = readConfig()
  const repoId = getRepositoryId()

  if (!config.repositoryPinnedBranches?.[repoId]) {
    return
  }

  const pinnedBranches = config.repositoryPinnedBranches[repoId]
  const index = pinnedBranches.indexOf(branch)

  if (index > -1) {
    pinnedBranches.splice(index, 1)
    config.repositoryPinnedBranches[repoId] = pinnedBranches
    writeConfig(config)
  }
}

/**
 * 检查分支是否已固定(仓库级别)
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
