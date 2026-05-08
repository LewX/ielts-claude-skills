# Copilot CLI Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `ielts-claude-skills` installable as a GitHub Copilot CLI plugin so users can run `copilot plugin install LewX/ielts-claude-skills` and get all four skills auto-discovered.

**Architecture:** Add `.github/plugin/plugin.json` (Copilot CLI's plugin manifest convention, same as `github/awesome-copilot`) listing the four existing skill directories. Update README to document the new install path.

**Tech Stack:** JSON (plugin manifest), Markdown (README), Git.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `.github/plugin/plugin.json` | Create | Copilot CLI plugin manifest — lists skill directories |
| `README.md` | Modify | Add Copilot CLI install instructions in 安装 section |

---

### Task 1: Create Copilot CLI plugin manifest

**Files:**
- Create: `.github/plugin/plugin.json`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p .github/plugin
```

Create `.github/plugin/plugin.json` with this exact content:

```json
{
  "name": "ielts-claude-skills",
  "description": "雅思备考 AI 教练：写作批改 / 阅读分析 / 口语素材 / 路由教练",
  "version": "1.0.0",
  "author": {
    "name": "LewX"
  },
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

- [ ] **Step 2: Verify JSON is valid**

```bash
python3 -c "import json; json.load(open('.github/plugin/plugin.json')); print('valid')"
```

Expected output: `valid`

- [ ] **Step 3: Verify all skill paths exist**

```bash
for d in ielts ielts-writing ielts-reading ielts-speaking; do
  [ -f "$d/SKILL.md" ] && echo "✓ $d/SKILL.md" || echo "✗ MISSING: $d/SKILL.md"
done
```

Expected output:
```
✓ ielts/SKILL.md
✓ ielts-writing/SKILL.md
✓ ielts-reading/SKILL.md
✓ ielts-speaking/SKILL.md
```

- [ ] **Step 4: Commit**

```bash
git add .github/plugin/plugin.json
git commit -m "feat: add Copilot CLI plugin manifest

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Update README with Copilot CLI install instructions

**Files:**
- Modify: `README.md` — 安装 > 前提 section

- [ ] **Step 1: Add Copilot CLI install section to README**

In `README.md`, find the 安装 section. After the existing 前提 block and before 方法一：直接复制, insert the following new subsection:

```markdown
### 方法三：GitHub Copilot CLI（一行安装）

```bash
copilot plugin install LewX/ielts-claude-skills
```

安装后重启 Copilot CLI，直接说「我要备考雅思」或「IELTS」即可触发 skill。
```

- [ ] **Step 2: Verify README renders correctly**

```bash
grep -n "Copilot CLI" README.md
```

Expected: at least 2 matches (section header + install command line).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add Copilot CLI install instructions to README

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
