export const locales = {
  en: {
    COMMIT_MESSAGE_PROMPT: `Follow the Angular Commit Message Specification to generate a git commit message.

Default to Chinese if the user does not specify a language.
Use plaintext syntax as much as possible, do not use markdown syntax.
The generated content should not contain emojis.
Format:
<type>(<scope>): <subject>

- Detailed description 1
- Detailed description 2
- Detailed description 3

Where subject is required, and detailed descriptions are optional supplementary explanations.

type:
[
'feat', // New feature
'fix', // Bug fix
'docs', // Documentation changes
'style', // Code style
'refactor', // Refactoring
'perf', // Performance optimization
'test', // Adding tests
'chore', // Changes to the build process or auxiliary tools
'revert', // Revert
'build', // Build
],

scope: Optional, indicates the scope of impact (e.g., module name)
subject: A concise description of the commit.
Detailed description: Use a list to briefly describe the main changes. Each list item should be short and clear, limited to 3-5 items.

Important rules:
1. Do not generate body and footer sections.
2. Only generate the subject and a list-style detailed description.
3. List items should be concise, each on a single line.
4. Do not add extra explanations or descriptive text.

Example:
feat(auth): Add WeChat login functionality

- Support WeChat QR code login
- Support binding WeChat accounts
- Add WeChat user information synchronization

Do not return any content other than the commit message.

Please generate a commit message based on the git diff.`,
    BRANCH_NAME_PROMPT: `Please generate a branch name based on the git diff, following these conventions:

feat/   New feature development (e.g., feat/user-authentication)
fix/    Bug fix (e.g., fix/login-error)
hotfix/ Urgent production issue fix (e.g., hotfix/payment-failure)
refactor/   Code refactoring (e.g., refactor/user-service)
docs/   Documentation update (e.g., docs/api-reference)
perf/   Performance optimization (e.g., perf/image-loading)
test/   Test related (e.g., test/user-profile)
chore/  Build/configuration change (e.g., chore/webpack-update)

Output format: Directly output the branch name, with no other content.`,
  },
  zh: {
    COMMIT_MESSAGE_PROMPT: `遵循 Angular Commit Message 规范，生成git commit message,

如果用户没有指示，默认为中文
尽量使用plaintext的语法，不要使用md的语法
生成的内容中不能包含emoji
格式：
<type>(<scope>): <subject>

- 详细描述1
- 详细描述2
- 详细描述3

其中 subject 必填，详细描述为可选的补充说明

type:
[
'feat', // 新功能
'fix', // 修复
'docs', // 文档变更
'style', // 代码格式
'refactor', // 重构
'perf', // 性能优化
'test', // 增加测试
'chore', // 构建过程或辅助工具的变动
'revert', // 回退
'build', // 打包
],

scope: 可选，表示影响范围（如模块名）
subject: 简明扼要的提交说明
详细描述: 使用列表形式简要说明主要改动点，每个列表项应简短清晰，数量限制在3-5个以内

重要规则：
1. 不要生成 body 和 footer 部分
2. 只生成 subject 和列表形式的详细描述
3. 列表项要简洁，每项不超过一行
4. 不要添加额外的解释或说明文字

示例：
feat(auth): 添加微信登录功能

- 支持微信扫码登录
- 支持微信账号绑定
- 添加微信用户信息同步

除了commit msg，其他不需要返回任何内容。

请你根据 git diff 生成 commit message。`,
    BRANCH_NAME_PROMPT:
`请根据 git diff 生成分支名，遵循以下规范：

feat/   新功能开发 feat/user-authentication
fix/    Bug修复 fix/login-error
hotfix/ 紧急线上问题修复 hotfix/payment-failure
refactor/   代码重构 refactor/user-service
docs/   文档更新 docs/api-reference
perf/   性能优化 perf/image-loading
test/   测试相关 test/user-profile
chore/  构建/配置变更 chore/webpack-update

输出格式：直接输出分支名，无需其他内容
`,
  },
}
