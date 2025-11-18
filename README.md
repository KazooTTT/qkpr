# @kzttools/quick-pr

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]

Create a Pull Request with interactive branch selection

## Installation

```bash
# Using npm
npm install -g @kzttools/quick-pr

# Using pnpm
pnpm add -g @kzttools/quick-pr

# Using yarn
yarn global add @kzttools/quick-pr
```

## Usage

### Interactive Menu

Navigate to your git repository and run:

```bash
quick-pr
# or use the full package name
@kzttools/quick-pr
```

> **Note**: All commands below use `quick-pr` for brevity, but you can replace it with `@kzttools/quick-pr` anywhere.

The CLI will show an interactive menu where you can choose from all available features:

- 🔧 Create Pull Request
- 🤖 Generate Commit Message
- 🌿 Generate Branch Name
- ⚙️  Configure API Key
- 🔧 Configure Model

### Create Pull Request

You can directly access the PR creation feature:

```bash
quick-pr pr
```

The CLI will interactively guide you through creating a pull request:

1. **Repository Detection**: Automatically detects the current Git repository
2. **Branch Selection**: Interactively select the target branch with search functionality
3. **PR Generation**: Generates a standardized PR description with commit summaries
4. **Clipboard Integration**: Copies the PR description to your clipboard
5. **Browser Launch**: Opens the PR page in your default browser
6. **Merge Branch**: Optionally creates a suggested merge branch for conflict resolution

### AI-Powered Commit Message Generation

Generate commit messages automatically using AI:

```bash
quick-pr commit
```

Features:

- 🤖 **AI-Powered**: Uses Google Gemini 2.0 Flash to analyze your changes
- 📝 **Angular Convention**: Follows Angular commit message standards
- 🌿 **Branch Name Suggestion**: Suggests appropriate branch names based on changes
- 🎯 **Smart Analysis**: Analyzes staged changes (git diff --cached)
- ✅ **Interactive**: Choose to commit, copy, or regenerate

#### First Time Setup

1. Get your Gemini API Key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Configure your API key (choose one method):

   - **Method 1**: Using config command

     ```bash
     quick-pr config
     ```

   - **Method 2**: Using environment variable

     ```bash
     export QUICK_PR_GEMINI_API_KEY=your_api_key_here
     # or use the legacy variable name
     export GEMINI_API_KEY=your_api_key_here
     ```

Or the tool will prompt you to enter it on first use.

#### Model Configuration

By default, the tool uses `gemini-2.0-flash-exp`. You can configure a different model:

```bash
quick-pr config:model
```

The tool will:

1. **Dynamically fetch** all available models from Google's API (if API key is configured)
2. Display a list of models to choose from
3. Allow custom model name input

Common Gemini models include (updated 2025.11.17, fetched from Google API):

**Gemini 2.5 Series (Latest):**

- `gemini-2.5-pro` - Latest stable Gemini 2.5 Pro
- `gemini-2.5-flash` - Fast Gemini 2.5 Flash
- `gemini-2.5-flash-lite` - Lighter 2.5 Flash version
- `gemini-2.5-flash-image` - With image generation
- `gemini-2.5-computer-use-preview-10-2025` - Computer use preview

**Gemini 2.0 Series:**

- `gemini-2.0-flash-exp` (default) - Gemini 2.0 Flash experimental
- `gemini-2.0-flash` - Stable Gemini 2.0 Flash
- `gemini-2.0-flash-lite` - Lighter version
- `gemini-2.0-pro-exp` - Pro experimental version
- `gemini-2.0-flash-thinking-exp` - Thinking mode experimental

**Latest Aliases:**

- `gemini-flash-latest` - Points to latest flash model
- `gemini-pro-latest` - Points to latest pro model
- `gemini-flash-lite-latest` - Points to latest lite model

You can also set the model via environment variable:

```bash
export QUICK_PR_GEMINI_MODEL=gemini-2.5-pro
# or use the legacy variable name
export GEMINI_MODEL=gemini-2.5-pro
```

#### Workflow Example

```bash
# Stage your changes
git add .

# Generate commit message
quick-pr commit

# The tool will:
# 1. Analyze your staged changes
# 2. Generate a commit message following Angular conventions
# 3. Suggest a branch name
# 4. Ask if you want to commit, copy to clipboard, or regenerate
```

## Features

### Pull Request Creation

- 🔧 **Interactive Branch Selection**: Choose target branch with search functionality
- 📌 **Protected Branches**: Highlights and pins important branches (main, master, etc.)
- 🗂️ **Smart Categorization**: Groups branches by prefix (feat/, fix/, merge/, etc.)
- ⏰ **Time Display**: Shows last commit time for each branch
- 📋 **Auto-Generated PR Description**: Includes commit summaries and formatted content
- 📋 **Clipboard Integration**: Automatically copies PR description to clipboard
- 🌐 **Browser Integration**: Opens PR comparison page automatically
- 🔄 **Merge Branch Suggestion**: Offers to create a merge resolution branch
- 🏷️ **Multi-Platform Support**: Compatible with GitHub, GitLab, and Gitee

### AI Commit Messages

- 🤖 **Gemini AI**: Powered by Google Gemini 2.0 Flash
- 📝 **Angular Convention**: Follows industry-standard commit message format
- 🌿 **Branch Naming**: Suggests semantic branch names
- 🔍 **Smart Analysis**: Analyzes git diff to understand changes
- 💾 **Secure Storage**: API key stored locally in `~/.quick-pr/config.json`

### Other Features

- 🔄 **Auto Update Check**: Notifies when new version is available
- ⚙️ **Easy Configuration**: Simple setup for API keys
- 🎨 **Beautiful UI**: Colorful and intuitive terminal interface

## Available Commands

### Interactive Menu (Default)

```bash
quick-pr
```

Shows an interactive menu to choose from all available features

### Create PR

```bash
quick-pr pr
```

Directly create a pull request with interactive branch selection

### Generate Commit Message

```bash
quick-pr commit
```

Directly generate commit message using AI (requires Gemini API key)

### Generate Branch Name

```bash
quick-pr branch
```

Directly generate a semantic branch name based on your staged changes using AI (requires Gemini API key)

### Configuration

```bash
quick-pr config
```

Configure Gemini API key for AI features

```bash
quick-pr config:model
```

Configure Gemini model for AI commit message generation

### Version

```bash
quick-pr --version
# or
quick-pr -v
```

### Help

```bash
quick-pr --help
# or
quick-pr -h
```

## Requirements

- `git` version 2.0+
- Node.js version 18+
- Gemini API key (for AI commit feature) - Get it from [Google AI Studio](https://aistudio.google.com/apikey)

## License

[MIT](./LICENSE) License © [KazooTTT](https://github.com/kazoottt)

## Contributing

Contributions, issues, and feature requests are welcome!

## Note for Developers

This project uses pnpm workspaces and tsdown for building. For development:

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Run tests
pnpm run test

# Lint
pnpm run lint
```

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/@kzttools/quick-pr?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/@kzttools/quick-pr
[npm-downloads-src]: https://img.shields.io/npm/dm/@kzttools/quick-pr?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/@kzttools/quick-pr
[license-src]: https://img.shields.io/github/license/kazoottt/quick-pr.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/kazoottt/quick-pr/blob/main/LICENSE
