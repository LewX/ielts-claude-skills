# Copilot CLI Support Design

**Date:** 2026-04-28  
**Status:** Approved

## Problem

`ielts-claude-skills` currently only documents Claude Code installation (`~/.claude/skills/`). GitHub Copilot CLI users have no install path and the repo is not discoverable as a Copilot CLI plugin.

## Proposed Solution

Add a `.github/plugin/plugin.json` manifest so Copilot CLI can install the plugin with one command, and update README with the new install step.

## Architecture

### New file: `.github/plugin/plugin.json`

Copilot CLI discovers plugins via `.github/plugin/plugin.json` (same convention as `github/awesome-copilot`). The manifest lists the four existing skill directories — no code changes needed.

```json
{
  "name": "ielts-claude-skills",
  "description": "雅思备考 AI 教练：写作批改 / 阅读分析 / 口语素材 / 路由教练",
  "version": "1.0.0",
  "author": { "name": "LewX" },
  "repository": "https://github.com/LewX/ielts-claude-skills",
  "license": "MIT",
  "keywords": ["ielts", "english", "exam", "skills"],
  "skills": [
    "./ielts",
    "./ielts-writing",
    "./ielts-reading",
    "./ielts-speaking"
  ]
}
```

Each directory already contains a `SKILL.md` with proper frontmatter — no changes to skill content required.

### Updated file: `README.md`

Add a "GitHub Copilot CLI" install method inside the existing 安装 section:

```bash
copilot plugin install LewX/ielts-claude-skills
```

Restart Copilot CLI after install; skills are auto-discovered.

## Scope

**In:** `plugin.json` creation, README update.  
**Out:** Hooks / session-start injection, skill content changes, marketplace registration.

## Verification

After implementation, `copilot plugin install LewX/ielts-claude-skills` (once pushed to GitHub) should install all four skills and make them available in Copilot CLI sessions.
