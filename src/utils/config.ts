import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface Config {
  geminiApiKey?: string
  geminiModel?: string
}

const CONFIG_DIR = join(homedir(), '.quick-pr')
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
 * 1. Config file (~/.quick-pr/config.json) via `quick-pr config` command
 * 2. Environment variable: export QUICK_PR_GEMINI_API_KEY=your_api_key
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
  return config.geminiModel || process.env.QUICK_PR_GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash'
}

export function setGeminiModel(model: string): void {
  const config = readConfig()
  config.geminiModel = model
  writeConfig(config)
}
