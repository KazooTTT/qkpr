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

Navigate to your git repository and run:

```bash
quick-pr
# or
@kzttools/quick-pr
```

The CLI will interactively guide you through creating a pull request:

1. **Repository Detection**: Automatically detects the current Git repository
2. **Branch Selection**: Interactively select the target branch from available branches
3. **PR Generation**: Generates a standardized PR description with commit summaries
4. **Media Support**: Copies the PR description to your clipboard
5. **Browser Launch**: Opens the PR page in your default browser
6. **Merge Branch**: Optionally creates a suggested merge branch for conflict resolution

## Features

- 🔧 **Interactive Branch Selection**: Choose target branch from a list of local and remote branches
- 📋 **Auto-Generated PR Description**: Includes commit summaries and formatted content
- 📋 **Clipboard Integration**: Automatically copies PR description to clipboard
- 🌐 **Browser Integration**: Opens PR comparison page automatically
- 🔄 **Merge Branch Suggestion**: Offers to create a merge resolution branch
- 🏷️ **Multi-Platform Support**: Compatible with GitHub, GitLab, and Gitee
- 🎨 **Git Service Detection**: Automatically formats PR links for different Git services

## Requirements

- `git` version 2.0+
- Node.js version 18+

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
