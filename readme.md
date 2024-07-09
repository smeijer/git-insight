# git-insight

git-insight is a powerful CLI tool that provides comprehensive statistics on GitHub users, organizations and their repositories. Gain detailed insights into your projects and keep track of key metrics with ease.

## Features

- Track contributions and commit activity
- Monitor pull request statuses and activities
- Analyze entire organizations, with a single command

## Installation

To install git-insight, use npm:

```bash
npm install -g git-insight
```

Alternatively, you can use it without global installation via npx:

```bash
npx git-insight org {github-org-name}
```

## Usage

To get statistics for a specific GitHub organization and repository, use the following command:

```bash
npx git-insight org {github-org-name}
```

> [!important]
> We need to query quite a number of GitHub endpoints to fetch the needed issue, pr, and commit details. A GitHub token must be provided via the `GITHUB_TOKEN` environment variable.

## Commands

Please run `--help` to get an actual lists of available commands.

```bash
npx git-insight --help
```

### Example

Here's an example command and output:

```bash
npx git-insight org facebook react -s 5
```

Note that the repo name is optional, but especially with larger organizations, recommended.

Output _(snapshot date 2024-07-09)_:

```text
react

  214 active pull requests (155 closed, 59 open)
  89 active issues (55 closed, 34 new)

Excluding merges, 27 authors have pushed 160 commits to main and 818 commits to 265 pull-requests. On main, 934 files have changed and there have been 56,782 additions and 29,194 deletions.

160 commits on main, authored by 27 contributors

  🧑 sebmarkbage
     pushed 35 commits
  🧑 poteto
     pushed 24 commits
  🧑 josephsavona
     pushed 18 commits
  🧑 kassens
     pushed 14 commits
  🧑 hoxyq
     pushed 12 commits

155 pull requests merged by 26 people

  🔀 [Flight] Add context for non null prototype error
     #30293 merged 17 hours ago • @sebmarkbage
  🔀 [DevTools] Print component stacks as error objects to get source mapping
     #30289 merged yesterday • @sebmarkbage
  🔀 Warn for useFormState on initial render
     #30292 merged yesterday • @sebmarkbage
  🔀 Upgrade flow to 0.235.0
     #30118 merged yesterday • @kassens
  🔀 Upgrade flow to 0.234.0
     #30117 merged yesterday • @kassens

59 pull requests opened by 37 people

  📬 Remove propTypes on instance warning
     #30296 created 17 hours ago • @kassens
  📬 [Flight] Fully support serializing Map/Set in console logs
     #30295 created 17 hours ago • @sebmarkbage
  📬 [Flight] Serialize rate limited objects in console logs as marker an increase limit
     #30294 created 17 hours ago • @sebmarkbage
  📬 Compiler: unfork prettier config
     #30205 created 6 days ago • @kassens
  📬 [compiler][ez] Rename disableMemoizationForDebugging to just disableMemoization
     #30191 created last week • @mvitousek

55 issues closed by 16 people

  🟣 Bug: Eager bailout when calling the state setter function multiple times
     #28725 closed 17 hours ago • @eunjios
  🟣 Bug:  Expected a suspended thenable.
     #28659 closed 3 days ago • @andreisocaciu
  🟣 Bug: customElement can't setAttribute width Object  
     #23043 closed 5 days ago • @a707843858
  🟣 Slow state update with long list of data
     #26215 closed 5 days ago • @ghost
  🟣 React[19] Module '"react"' has no exported member 'useActionState'.
     #30196 closed 6 days ago • @Ayub-7

34 issues opened by 33 people

  🟢 Bug: effect runs with stale state values outside of Concurrent React
     #30291 opened yesterday • @denis-sokolov
  🟢 [React 19] Cannot assign to readonly property
     #30172 opened last week • @hipstersmoothie
  🟢 Bug: Empty `style={}` object values cause hydration warnings in React 18.3.1 - Includes solution
     #30163 opened last week • @nandastone
  🟢 Bug: useEffect is triggered even if the array as dependency variable wasn't changed.
     #30141 opened last week • @enesgorkemgenc
  🟢 [eslint-plugin-react-hooks] Missing type declarations
     #30119 opened last week • @JstnMcBrd

61 unresolved conversations

  💬 Devtools tabs should not appear in chrome-extension pages when using react-devtools as an entry point
     #17208 updated 17 hours ago • 16 comments
  💬 Bug: `onBlur` is not called when a focused element is unmounted
     #25194 updated yesterday • 10 comments
  💬 Why react-dom/server will automatic reorder elements in head
     #27879 updated 2 days ago • 3 comments
  💬 Fix react checkbox input synthetic event
     #27016 updated 2 days ago • 9 comments
  💬 fix: faster shallowEqual 30% performance improvement & `__DEV__` Just make a judgment once 
     #28776 updated 3 days ago • 3 comments
```
