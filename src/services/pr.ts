import { execSync } from 'node:child_process'
import { cyan, green, red } from 'kolorist'

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
 * 切换到目标分支并创建合并分支
 */
export function createMergeBranch(targetBranch: string, mergeBranchName: string): boolean {
  try {
    console.log(cyan(`\n🔀  Switching to target branch: ${targetBranch}`))
    execSync(`git checkout ${targetBranch}`, {
      stdio: 'inherit',
    })

    console.log(cyan(`🌿  Creating merge branch: ${mergeBranchName}`))
    execSync(`git checkout -b ${mergeBranchName}`, {
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
