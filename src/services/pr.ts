import { execSync } from 'node:child_process'
import { isIP } from 'is-ip'
import { cyan, dim, green, red, yellow } from 'kolorist'

export interface GitInfo {
  currentBranch: string
  remoteUrl: string
  isGitRepo: boolean
}

export interface PRInfo {
  sourceBranch: string
  targetBranch: string
  prUrl: string
  prMessage: string
  mergeBranchName: string
}

export interface BranchInfo {
  name: string
  lastCommitTime: number
  lastCommitTimeFormatted: string
  category: string
}

export interface DeleteBranchesResult {
  deleted: string[]
  failed: string[]
}

/**
 * 获取当前 Git 仓库信息
 */
export function getGitInfo(): GitInfo {
  try {
    const currentBranch = execSync('git symbolic-ref --quiet --short HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim()

    const remoteUrl = execSync('git config --get remote.origin.url', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim()

    return {
      currentBranch,
      remoteUrl,
      isGitRepo: true,
    }
  }
  catch {
    return {
      currentBranch: '',
      remoteUrl: '',
      isGitRepo: false,
    }
  }
}

/**
 * 获取所有分支列表
 */
export function getAllBranches(): string[] {
  try {
    const branches = execSync('git branch -a', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })

    return branches
      .split('\n')
      .map((b: string) => b.replace(/^\*?\s+/, '').replace(/^remotes\/origin\//, ''))
      .filter((b: string) => b && b !== 'HEAD' && !b.includes('->'))
      .filter((b: string, index: number, self: string[]) => self.indexOf(b) === index) // 去重
      .sort()
  }
  catch {
    return []
  }
}

/**
 * 判断是否为 merge 临时分支
 */
export function isMergeBranchName(branchName: string): boolean {
  return branchName.startsWith('merge/')
}

/**
 * 获取所有 merge/ 开头的本地分支
 */
export function getMergeBranches(currentBranch?: string): string[] {
  return getAllBranches()
    .filter(isMergeBranchName)
    .filter(branch => branch !== currentBranch)
}

/**
 * 获取分支的最后提交时间
 */
export function getBranchLastCommitTime(branchName: string): { timestamp: number, formatted: string } {
  try {
    // 尝试获取远程分支的时间
    const command = `git log -1 --format=%ct origin/${branchName} 2>/dev/null || git log -1 --format=%ct ${branchName}`
    const timestamp = Number.parseInt(
      execSync(command, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim(),
      10,
    )

    // 格式化时间
    const date = new Date(timestamp * 1000)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    let formatted: string
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60))
        formatted = diffMinutes <= 1 ? 'just now' : `${diffMinutes}m ago`
      }
      else {
        formatted = `${diffHours}h ago`
      }
    }
    else if (diffDays === 1) {
      formatted = 'yesterday'
    }
    else if (diffDays < 7) {
      formatted = `${diffDays}d ago`
    }
    else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7)
      formatted = `${weeks}w ago`
    }
    else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30)
      formatted = `${months}mo ago`
    }
    else {
      const years = Math.floor(diffDays / 365)
      formatted = `${years}y ago`
    }

    return { timestamp, formatted }
  }
  catch {
    return { timestamp: 0, formatted: 'unknown' }
  }
}

/**
 * 获取分支类别
 */
export function getBranchCategory(branchName: string): string {
  const match = branchName.match(/^([^/]+)\//)
  if (match) {
    return match[1]
  }

  // 对于没有斜杠的分支，进行更智能的分类
  const lowerBranch = branchName.toLowerCase()
  if (['main', 'master', 'develop', 'dev'].includes(lowerBranch)) {
    return 'main' // 主要开发分支
  }
  if (lowerBranch.startsWith('release')) {
    return 'release' // 发布分支
  }
  if (lowerBranch.startsWith('hotfix') || lowerBranch.startsWith('fix')) {
    return 'hotfix' // 热修复分支
  }

  return 'other'
}

/**
 * 获取分支详细信息（包含时间和分类）- 优化版本
 */
export function getBranchesWithInfo(branches: string[]): BranchInfo[] {
  // 如果分支数量很大，使用批量优化
  if (branches.length > 50) {
    return getBranchesWithInfoBatch(branches)
  }

  // 少量分支使用原逻辑
  return branches.map((branchName) => {
    const { timestamp, formatted } = getBranchLastCommitTime(branchName)
    return {
      name: branchName,
      lastCommitTime: timestamp,
      lastCommitTimeFormatted: formatted,
      category: getBranchCategory(branchName),
    }
  })
}

/**
 * 批量获取分支信息，性能优化版本
 */
export function getBranchesWithInfoBatch(branches: string[]): BranchInfo[] {
  try {
    // 构建批量git命令：获取所有分支的最新提交时间
    const batchCommand = branches.map((branch) => {
      // 对远程分支优先，本地分支备用
      return `git log -1 --format=%ct origin/${branch} 2>/dev/null || echo "0"`
    }).join('; echo "---";')

    const output = execSync(batchCommand, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })

    // 解析批量输出
    const timestamps = output.split('---').map((line) => {
      const timestamp = Number.parseInt(line.trim(), 10)
      return Number.isNaN(timestamp) ? 0 : timestamp
    })

    return branches.map((branchName, index) => {
      const timestamp = timestamps[index] || 0
      const { formatted } = formatTimestamp(timestamp)
      return {
        name: branchName,
        lastCommitTime: timestamp,
        lastCommitTimeFormatted: formatted,
        category: getBranchCategory(branchName),
      }
    })
  }
  catch (error) {
    // 如果批量获取失败，降级到单个获取
    console.warn('Batch fetch failed, falling back to individual fetch:', error)
    return branches.map((branchName) => {
      const { timestamp, formatted } = getBranchLastCommitTime(branchName)
      return {
        name: branchName,
        lastCommitTime: timestamp,
        lastCommitTimeFormatted: formatted,
        category: getBranchCategory(branchName),
      }
    })
  }
}

/**
 * 格式化时间戳 - 提取为独立函数供批量版本使用
 */
export function formatTimestamp(timestamp: number): { timestamp: number, formatted: string } {
  if (timestamp === 0) {
    return { timestamp: 0, formatted: 'unknown' }
  }

  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  let formatted: string
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      formatted = diffMinutes <= 1 ? 'just now' : `${diffMinutes}m ago`
    }
    else {
      formatted = `${diffHours}h ago`
    }
  }
  else if (diffDays === 1) {
    formatted = 'yesterday'
  }
  else if (diffDays < 7) {
    formatted = `${diffDays}d ago`
  }
  else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    formatted = `${weeks}w ago`
  }
  else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    formatted = `${months}mo ago`
  }
  else {
    const years = Math.floor(diffDays / 365)
    formatted = `${years}y ago`
  }

  return { timestamp, formatted }
}

/**
 * 解析 Git remote URL
 */
export function parseRemoteUrl(remote: string): { host: string, repoPath: string, protocol: string } | null {
  let host = ''
  let repoPath = ''
  let protocol = 'https'

  // git@github.com:user/repo.git
  if (remote.startsWith('git@')) {
    const match = remote.match(/git@([^:]+):(.+?)(?:\.git)?$/)
    if (match) {
      host = match[1]
      repoPath = match[2]
    }
    else {
      return null
    }
  }
  // ssh://git@github.com/user/repo.git
  else if (remote.startsWith('ssh://git@')) {
    const match = remote.match(/ssh:\/\/git@([^/]+)\/(.+?)(?:\.git)?$/)
    if (match) {
      host = match[1]
      repoPath = match[2]
    }
    else {
      return null
    }
  }
  // https://github.com/user/repo.git
  else if (remote.startsWith('https://')) {
    protocol = 'https'
    const match = remote.match(/https:\/\/([^/]+)\/(.+?)(?:\.git)?$/)
    if (match) {
      host = match[1]
      repoPath = match[2]
    }
    else {
      return null
    }
  }
  // http://github.com/user/repo.git
  else if (remote.startsWith('http://')) {
    protocol = 'http'
    const match = remote.match(/http:\/\/([^/]+)\/(.+?)(?:\.git)?$/)
    if (match) {
      host = match[1]
      repoPath = match[2]
    }
    else {
      return null
    }
  }
  else {
    return null
  }

  // For IP addresses, use HTTP instead of HTTPS
  if (isIP(host)) {
    protocol = 'http'
  }

  return { host, repoPath, protocol }
}

/**
 * 生成 PR 链接
 */
export function generatePRUrl(host: string, repoPath: string, protocol: string, sourceBranch: string, targetBranch: string): string {
  const baseUrl = `${protocol}://${host}/${repoPath}`

  // GitHub
  if (host.includes('github.com')) {
    return `${baseUrl}/compare/${targetBranch}...${sourceBranch}`
  }
  // GitLab / Gitee
  else {
    const encodedSource = encodeURIComponent(sourceBranch)
    const encodedTarget = encodeURIComponent(targetBranch)
    return `${baseUrl}/merge_requests/new?merge_request%5Bsource_branch%5D=${encodedSource}&merge_request%5Btarget_branch%5D=${encodedTarget}`
  }
}

/**
 * 获取两个分支之间的提交信息
 */
export function getCommitsBetweenBranches(targetBranch: string, sourceBranch: string): string[] {
  try {
    const commits = execSync(
      `git log --pretty=format:"- %s" ${targetBranch}..${sourceBranch}`,
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      },
    )
      .trim()
      .split('\n')
      .filter((line: string) => line)

    return commits
  }
  catch {
    return []
  }
}

/**
 * 生成 PR 描述信息
 */
export function generatePRMessage(sourceBranch: string, targetBranch: string): string {
  const commits = getCommitsBetweenBranches(targetBranch, sourceBranch)

  let message = `### 🔧 PR: \`${sourceBranch}\` → \`${targetBranch}\`\n\n#### 📝 Commit Summary:\n`

  if (commits.length === 0) {
    message += '\n（无差异提交）'
  }
  else {
    message += commits.join('\n')
  }

  return message
}

/**
 * 生成合并分支名称
 */
export function generateMergeBranchName(sourceBranch: string, targetBranch: string): string {
  const sanitizedSource = sourceBranch.replace(/\//g, '-')
  const sanitizedTarget = targetBranch.replace(/\//g, '-')
  return `merge/${sanitizedSource}-to-${sanitizedTarget}`
}

/**
 * 检查 ref 是否存在
 */
function refExists(ref: string): boolean {
  try {
    execSync(`git rev-parse --verify ${ref}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    return true
  }
  catch {
    return false
  }
}

/**
 * 尝试刷新远程目标分支，确保 merge branch 基于最新远程提交创建
 */
function refreshRemoteTargetBranch(targetBranch: string): boolean {
  try {
    execSync(`git fetch origin refs/heads/${targetBranch}:refs/remotes/origin/${targetBranch}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'inherit'],
    })
    return true
  }
  catch {
    return false
  }
}

/**
 * Resolve a ref for `git branch <new> <start>` without checking out the target.
 * Works when the target branch is already checked out in another worktree.
 * Prefers the latest origin/<name>, then local refs/heads/<name>.
 */
function resolveMergeBranchStartPoint(targetBranch: string): string {
  const remoteRef = `refs/remotes/origin/${targetBranch}`
  const localRef = `refs/heads/${targetBranch}`
  const remoteRefName = `origin/${targetBranch}`

  refreshRemoteTargetBranch(targetBranch)

  if (refExists(remoteRef)) {
    return remoteRefName
  }

  if (refExists(localRef)) {
    return targetBranch
  }

  return remoteRefName
}

/**
 * 基于目标分支创建合并分支（不 checkout 目标分支，避免 worktree 占用冲突）
 */
export function createMergeBranch(targetBranch: string, mergeBranchName: string): boolean {
  try {
    const startPoint = resolveMergeBranchStartPoint(targetBranch)
    const sourceLabel = startPoint === targetBranch ? `${targetBranch} (local fallback)` : targetBranch
    console.log(
      cyan(
        `\n🌿  Creating merge branch: ${mergeBranchName} from ${sourceLabel}${startPoint !== targetBranch ? ` (${startPoint})` : ''}`,
      ),
    )
    execSync(`git branch ${mergeBranchName} ${startPoint}`, {
      stdio: 'inherit',
    })

    execSync(`git checkout ${mergeBranchName}`, {
      stdio: 'inherit',
    })

    console.log(
      green(`✅  Successfully created merge branch: ${mergeBranchName}\n`),
    )
    return true
  }
  catch {
    console.log(red('❌  Failed to create merge branch'))
    return false
  }
}

/**
 * 合并原始分支到合并分支
 */
export function mergeSourceToMergeBranch(sourceBranch: string): boolean {
  try {
    console.log(cyan(`\n🔄  Merging source branch '${sourceBranch}' into current merge branch...`))

    // 执行合并操作
    execSync(`git merge ${sourceBranch}`, {
      stdio: 'inherit',
    })

    console.log(green(`✅  Successfully merged '${sourceBranch}' into merge branch`))
    return true
  }
  catch (error: any) {
    // 检查是否是合并冲突
    if (error.status === 1 && error.stdout?.includes('CONFLICT')) {
      console.log(yellow(`⚠️  Merge conflicts detected!`))
      console.log(dim(`   Please resolve conflicts manually and then run:`))
      console.log(dim(`   git add <resolved-files>`))
      console.log(dim(`   git commit`))
      return false
    }
    else {
      console.log(red('❌  Failed to merge source branch'))
      console.log(dim(`Error: ${error.message || 'Unknown error'}`))
      return false
    }
  }
}

/**
 * 删除本地 merge 分支
 */
export function deleteMergeBranches(branches: string[]): DeleteBranchesResult {
  const result: DeleteBranchesResult = {
    deleted: [],
    failed: [],
  }

  for (const branch of branches) {
    if (!isMergeBranchName(branch)) {
      result.failed.push(branch)
      continue
    }

    try {
      execSync(`git branch -D ${branch}`, {
        stdio: 'inherit',
      })
      result.deleted.push(branch)
    }
    catch {
      result.failed.push(branch)
    }
  }

  return result
}

/**
 * 复制文本到剪贴板
 */
export function copyToClipboard(text: string): boolean {
  try {
    // macOS
    if (process.platform === 'darwin') {
      execSync('pbcopy', { input: text, stdio: ['pipe', 'ignore', 'ignore'] })
      return true
    }
    // Linux with xclip
    else if (process.platform === 'linux') {
      try {
        execSync('which xclip', { stdio: 'ignore' })
        execSync('xclip -selection clipboard', {
          input: text,
          stdio: ['pipe', 'ignore', 'ignore'],
        })
        return true
      }
      catch {
        try {
          execSync('which wl-copy', { stdio: 'ignore' })
          execSync('wl-copy', {
            input: text,
            stdio: ['pipe', 'ignore', 'ignore'],
          })
          return true
        }
        catch {
          return false
        }
      }
    }
    // Windows
    else if (process.platform === 'win32') {
      execSync('clip', { input: text, stdio: ['pipe', 'ignore', 'ignore'] })
      return true
    }

    return false
  }
  catch {
    return false
  }
}

/**
 * 创建完整的 PR
 */
export function createPullRequest(sourceBranch: string, targetBranch: string, remoteUrl: string): PRInfo | null {
  const parsed = parseRemoteUrl(remoteUrl)
  if (!parsed) {
    console.log(red('❌  无法解析 remote URL'))
    return null
  }

  const { host, repoPath, protocol } = parsed

  const prUrl = generatePRUrl(
    host,
    repoPath,
    protocol,
    sourceBranch,
    targetBranch,
  )
  const prMessage = generatePRMessage(sourceBranch, targetBranch)
  const mergeBranchName = generateMergeBranchName(sourceBranch, targetBranch)

  return {
    sourceBranch,
    targetBranch,
    prUrl,
    prMessage,
    mergeBranchName,
  }
}
