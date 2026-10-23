# qkpr

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]

通过交互式分支选择创建 Pull Request 的 CLI 工具
## 功能演示

快速创建带有交互式分支选择的 PR

![demo](https://github.com/user-attachments/assets/ec06d376-d7dd-4470-ae61-a7e66605f7b8)

## 安装

```bash
# 使用 npm
npm install -g qkpr

# 使用 pnpm
pnpm add -g qkpr

# 使用 yarn
yarn global add qkpr
```

## 使用方法

### 交互式菜单

导航到你的 Git 仓库并运行：

```bash
qkpr
```

CLI 将显示一个交互式菜单，你可以从中选择所有可用的功能：

- 🔧 创建 Pull Request
- 🤖 生成提交消息
- 🌿 生成分支名称
- 🗑️ 删除合并分支
- 🔙 返回源分支
- 📌 管理固定分支
- ⚙️ 设置

### 创建 Pull Request

你可以直接访问 PR 创建功能：

```bash
qkpr pr
# 指定目标分支（当前分支 → main）
qkpr pr main
# 同时指定源分支和目标分支（A → B）
qkpr pr feature/A release/B
# 先搜索选择源分支，再搜索选择目标分支
qkpr pr -s
```

CLI 将通过交互方式指导你创建 Pull Request：

1. **仓库检测**：自动检测当前 Git 仓库
2. **分支选择**：通过搜索功能交互式选择目标分支
3. **PR 生成**：生成包含提交摘要的标准化 PR 描述
4. **剪贴板集成**：将 PR 描述复制到你的剪贴板
5. **浏览器启动**：在你的默认浏览器中打开 PR 页面
6. **合并分支**：可选地创建建议的合并分支用于冲突解决

### AI 驱动的提交消息生成

使用 AI 自动生成提交消息：

```bash
qkpr commit
```

功能特性：

- 🤖 **AI 驱动**：使用 Google Gemini 2.0 Flash 分析你的变更
- 📝 **Angular 约定**：遵循 Angular 提交消息标准
- 🌿 **分支名称建议**：基于变更建议适当的分支名称
- 🎯 **智能分析**：分析暂存的变更（`git diff --cached`）
- ✅ **交互式**：选择提交、复制或重新生成
- 🚀 **自动推送**：可选择在提交后自动将代码推送到远程仓库

#### 首次设置

1. 从 [Google AI Studio](https://aistudio.google.com/apikey) 获取你的 Gemini API 密钥
2. 配置你的 API 密钥（选择一种方法）：

   - **方法 1**：使用配置命令

     ```bash
     qkpr config
     ```

   - **方法 2**：使用环境变量

     ```bash
     export QUICK_PR_GEMINI_API_KEY=your_api_key_here
     # 或者使用旧版变量名
     export GEMINI_API_KEY=your_api_key_here
     ```

或者工具会在首次使用时提示你输入。

#### 模型配置

默认情况下，工具使用 `gemini-2.0-flash`。你可以配置不同的模型：

```bash
qkpr config:model
```

工具将：

1. **动态获取** Google API 中所有可用模型（如果已配置 API 密钥）
2. 显示模型列表供选择
3. 允许自定义模型名称输入

常见的 Gemini 模型包括（更新于 2025.11.17，从 Google API 获取）：

**常见 Gemini 模型：**

- `gemini-2.5-pro`
- `gemini-2.5-flash`
- `gemini-2.0-flash`（默认）
- `gemini-2.0-flash-exp`
- `gemini-flash-latest`

你也可以通过环境变量设置模型：

```bash
export QUICK_PR_GEMINI_MODEL=gemini-2.5-pro
# 或者使用旧版变量名
export GEMINI_MODEL=gemini-2.5-pro
```

#### 工作流示例

```bash
# 暂存你的变更
git add .

# 生成提交消息
qkpr commit

# 工具将：
# 1. 分析你的暂存变更
# 2. 生成遵循 Angular 约定的提交消息
# 3. 建议分支名称
# 4. 询问你是否要提交、复制到剪贴板或重新生成
```

## 功能特性

### Pull Request 创建

- 🔧 **交互式分支选择**：通过搜索功能选择目标分支
- 📌 **受保护分支**：高亮和固定重要分支（main、master 等）
- 🗂️ **智能分类**：按前缀分组分支（feat/、fix/、merge/ 等）
- ⏰ **时间显示**：显示每个分支的最后提交时间
- 📋 **自动生成的 PR 描述**：包含提交摘要和格式化内容
- 📋 **剪贴板集成**：自动将 PR 描述复制到剪贴板
- 🌐 **浏览器集成**：自动打开 PR 比较页面
- 🔄 **合并分支建议**：提供创建合并解决分支的选项
- 🏷️ **多平台支持**：兼容 GitHub、GitLab 和 Gitee

### AI 提交消息

- 🤖 **Gemini AI**：由 Google Gemini 2.0 Flash 驱动
- 📝 **Angular 约定**：遵循行业标准的提交消息格式
- 🌿 **分支命名**：建议语义化分支名称
- 🔍 **智能分析**：分析 git diff 以了解变更
- 💾 **安全存储**：API 密钥本地存储在 `~/.qkpr/config.json`

### 其他功能

- 🔄 **自动更新检查**：新版本可用时通知
- ⚙️ **简单配置**：API 密钥的简单设置
- 🎨 **美观界面**：彩色直观的终端界面

## 可用命令

### 交互式菜单（默认）

```bash
qkpr
```

显示交互式菜单以选择所有可用功能

### 创建 PR

```bash
qkpr pr
```

通过交互式分支选择直接创建 Pull Request，也支持显式指定 `qkpr pr [source] [target]`，或使用 `qkpr pr -s` 先后搜索选择源分支和目标分支。

### 生成提交消息

```bash
qkpr commit
```

使用 AI 直接生成提交消息（需要 Gemini API 密钥）

### 生成分支名称

```bash
qkpr branch
```

使用 AI 基于你的暂存变更直接生成语义化分支名称（需要 Gemini API 密钥）

### 删除合并分支

```bash
qkpr del [branch]
qkpr del [branch] --remote
```

删除本地合并分支。使用 `--remote` 或 `-r` 同时删除远程对应的合并分支。

删除列表中按 `a` 全选／取消全选所有 `merge/` 分支，空格切换单项，回车确认。当前分支不在候选列表中。

### 更新 qkpr

```bash
qkpr update
```

自动检测全局安装所用的包管理器（npm、pnpm、yarn 或 bun，默认 npm），安装 `qkpr@latest`。无需再次确认，安装失败时返回非零退出码。

### 清理项目

```bash
qkpr clean
```

在当前仓库执行 `git fetch --all --prune --tags --no-prune-tags`：同步远端分支及标签，移除失效的远端跟踪引用。保留本地分支、工作区文件及仅本地存在的标签，不强制覆盖冲突标签。显式禁用标签修剪，避免 Git 配置启用该行为；自定义 fetch refspec 仍决定 Git 实际修剪哪些引用。

### 返回源分支

```bash
qkpr back
```

从合并分支切换回源分支。此命令会：

- 自动检测当前的合并分支（如 `merge/feat-xxx-to-main`）
- 从分支名解析出原始的源分支和目标分支
- 如果找到多个匹配的分支，提示你选择正确的一个
- 切换到源分支

当你完成合并分支的工作，想要返回功能分支时非常有用。

### 配置

```bash
qkpr config
```

为 AI 功能配置 Gemini API 密钥

```bash
qkpr config:model
```

配置用于 AI 提交消息生成的 Gemini 模型

### 版本

```bash
qkpr --version
# 或者
qkpr -v
```

### 帮助

```bash
qkpr --help
# 或者
qkpr -h
```

## 系统要求

- `git` 版本 2.0+
- Node.js 版本 18+
- Gemini API 密钥（用于 AI 提交功能）- 从 [Google AI Studio](https://aistudio.google.com/apikey) 获取

## 许可证

[MIT](./LICENSE) 许可证 © [KazooTTT](https://github.com/kazoottt)

## 贡献

欢迎贡献、问题反馈和功能请求！

## 开发者注意事项

此项目使用 pnpm 工作区和 tsdown 进行构建。开发环境：

```bash
# 安装依赖
pnpm install

# 构建项目
pnpm run build

# 运行测试
pnpm run test

# 代码检查
pnpm run lint
```

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/qkpr?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/qkpr
[npm-downloads-src]: https://img.shields.io/npm/dm/qkpr?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/qkpr
[license-src]: https://img.shields.io/github/license/kazoottt/qkpr.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/kazoottt/qkpr/blob/main/LICENSE.md
