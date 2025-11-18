---
description: AI rules derived by SpecStory from the project AI interaction history
globs: *
---

## HEADERS

## TECH STACK

## PROJECT DOCUMENTATION & CONTEXT SYSTEM

### CODING STANDARDS

Categorize Your Dependencies
Let’s forget about dependencies and devDependencies for a moment, how might we categorize our dependencies? Here are some rough ideas I could come up with:

test: Packages used for testing (e.g., vitest, playwright, msw).
lint: Packages for linting/formatting (e.g., eslint, knip).
build: Packages used for building the project (e.g., vite, rolldown).
script: Packages used for scripting tasks (e.g., tsx, tinyglobby, cpx).
frontend: Packages for frontend development (e.g., vue, pinia).
backend: Packages for the backend server.
types: Packages for type checking and definitions.
inlined: Packages that are included directly in the final bundle.
prod: Runtime production dependencies.
…
Categorization might differ between projects. But that point is that dependencies and devDependencies lack the flexibility to capture this level of detail.

This thing had been bothering me for a while, though it didn’t feel like a critical problem needing immediate resolution. Only until pnpm introduced catalogs, opening up possibilities for dependency categorization we never had before.

PNPM Catalogs
PNPM Catalogs is a feature allowing monorepo workspaces to share dependency versions across different packages via a centralized management location.

Basically, you add catalog or catalogs fields to your pnpm-workspace.yaml file and reference them using catalog:<name> in your package.json.

## WORKFLOW & RELEASE RULES

### Branching
- Feature branches should be named using the `feat/`, `fix/`, `docs/` prefixes to indicate their purpose.
- Pinned branches should be displayed first, followed by protected branches, and then categorized ordinary branches. The pinned branches take precedence, allowing users to define their frequently used branches. The hardcoded protected branch logic has been removed to provide more flexibility.

### Pinning Branches
- A "pin branch" feature allows users to customize frequently used target branches.
- The `pinnedBranches` are stored in the configuration file (`config.ts`).
- The `qkpr pin` command should display a list of existing branches for the user to select from, rather than requiring manual input.
- The pin and unpin commands now support a checkbox mode (space to select, enter to confirm) for selecting multiple branches.
- The branch selection interface should be unified across the application, providing a consistent user experience.

### Branch Selection Interface
- The branch selection interface should support:
  - Display by prefix categories (feat/*, fix/*, etc.).
  - Search filtering.
  - Autocomplete type input.
- The branch list should show the last commit time (e.g., "2h ago", "3d ago") for each branch.
- Branches should be sorted within each category by their most recent update time.
- The pin branch management interface uses a search and categorized interface, including pinned, feature, fix, merge, chore, docs, test, and other branches.

## DEBUGGING
