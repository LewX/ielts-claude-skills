# GT Reading Material Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an IELTS General Training reading-material generation mode that can produce one original Band 8 simulated passage plus ten exam-style questions, answers, and review artifacts.

**Architecture:** Extend `ielts-reading/SKILL.md` with a new route for users who ask the skill to generate original reading material instead of analyzing existing passages. Lock the new prompt contract with a Node test in `tests/skills/skill-contract.test.mjs`, then document the new usage path in `README.md`.

**Tech Stack:** Markdown skill prompts, Node built-in test runner (`node --test` via `npm test`), Git.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `ielts-reading/SKILL.md` | Modify | Add the new GT reading-material generation mode, question mix, output package, and quality constraints |
| `tests/skills/skill-contract.test.mjs` | Modify | Prevent regressions by asserting the new reading-generation contract stays in the skill file |
| `README.md` | Modify | Document how to trigger the new reading-material generation workflow |

---

### Task 1: Lock the new reading-generation contract with a failing test

**Files:**
- Modify: `tests/skills/skill-contract.test.mjs`
- Test: `tests/skills/skill-contract.test.mjs`

- [ ] **Step 1: Add a failing contract test for the new reading mode**

Insert this test after the existing `ielts skill documents runtime summary routing guidance` test:

```js
test('ielts-reading skill documents GT reading material generation mode', async () => {
  const skill = await readSkill('../../ielts-reading/SKILL.md');

  assert.match(skill, /原创材料出题模式/u);
  assert.match(skill, /IELTS General Training/u);
  assert.match(skill, /Band 8/u);
  assert.match(skill, /1 篇 Passage \+ 10 题/u);
  assert.match(skill, /True\/False\/Not Given/u);
  assert.match(skill, /Sentence Completion/u);
  assert.match(skill, /Multiple Choice/u);
  assert.match(skill, /原创仿真材料/u);
  assert.match(skill, /答案 Key/u);
  assert.match(skill, /同义替换词表/u);
  assert.match(skill, /不靠冷知识/u);
});
```

- [ ] **Step 2: Run the targeted test and confirm it fails**

Run:

```bash
npm test -- tests/skills/skill-contract.test.mjs
```

Expected: FAIL with at least one missing-marker assertion for `原创材料出题模式` or another new reading-generation string.

- [ ] **Step 3: Commit the failing-test checkpoint**

```bash
git add tests/skills/skill-contract.test.mjs
git commit -m "test: add reading material generation contract

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Expected: commit succeeds and only the test file is staged for this checkpoint.

---

### Task 2: Implement the GT reading-material generation mode in `ielts-reading`

**Files:**
- Modify: `ielts-reading/SKILL.md`
- Test: `tests/skills/skill-contract.test.mjs`

- [ ] **Step 1: Add the new mode to the mode table**

In the `## 三种模式` table, add a fourth row so the table becomes:

```md
| 模式 | 触发 | 做什么 |
|------|------|--------|
| **错题分析** | 用户给了文章 + 题目 + 自己的答案 | 逐题拆解错因 + 同义替换提取 |
| **精读训练** | 用户给了文章 + 题目（没做过） | 引导做题 + 做完后分析 |
| **专项训练** | 用户说"练T/F/NG"或"练Matching" | 针对特定题型训练 |
| **原创材料出题模式** | 用户要你出一套符合 IELTS 要求的阅读材料 | 生成原创仿真 Passage + 10 题 + 答案与解析 |
```

- [ ] **Step 2: Add the new `## 原创材料出题模式` section**

Insert this section after `## 精读训练模式` and before `## 专项训练模式`:

```md
## 原创材料出题模式

用户说"请你帮我收集阅读材料并出题"、"给我一套阅读题"、"按雅思要求出题"时：

1. 先确认 4 个变量：
   - IELTS Academic 还是 IELTS General Training
   - 目标难度（默认按目标分对应）
   - 这次做 1 篇 Passage + 10 题，还是更大一套
   - 原创仿真材料，还是基于公开材料改写
2. 如果用户没有额外约束，默认：
   - IELTS General Training
   - Band 8
   - 1 篇 Passage + 10 题
   - 原创仿真材料
3. 只生成 IELTS 常见题型。默认组合：
   - True/False/Not Given x4
   - Sentence Completion x3
   - Multiple Choice x3
4. 文章体裁优先 GT 常见实用文本：
   - guide
   - notice pack
   - staff handbook excerpt
   - community information sheet
5. 输出顺序固定：
   - Passage
   - Questions 1-10
   - 答案 Key
   - 每题定位与推导
   - 同义替换词表
6. 质量约束：
   - 每道题都必须能在原文定位
   - 不靠冷知识
   - 不自创题型
   - Sentence Completion 必须可唯一作答
   - T/F/NG 必须严格区分 FALSE 和 NOT GIVEN
   - Multiple Choice 的干扰项必须对应真实误判，不是乱编
7. 出完题后，不要直接把全部解析塞给用户。先给题目和作答说明；用户做完后，再按本 skill 的错题分析框架讲解。
```

- [ ] **Step 3: Add a short boundary note so the new mode stays scoped**

In the `## 边界` section, add this bullet before the final line:

```md
- 原创材料出题模式先负责出题和设定作答顺序；详细讲解放到用户提交答案之后
```

- [ ] **Step 4: Run the targeted test and confirm it passes**

Run:

```bash
npm test -- tests/skills/skill-contract.test.mjs
```

Expected: PASS for the new `ielts-reading skill documents GT reading material generation mode` test.

- [ ] **Step 5: Commit the skill update**

```bash
git add ielts-reading/SKILL.md tests/skills/skill-contract.test.mjs
git commit -m "feat: add GT reading material generation mode

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Document the new workflow in `README.md`

**Files:**
- Modify: `README.md`
- Test: `README.md`

- [ ] **Step 1: Add a new usage example under `## 怎么用`**

After the existing reading-analysis example, insert:

```md
### 场景 3B：让阅读 skill 原创出题

```
你：/ielts-reading
   "请按 IELTS General Training Band 8 难度，给我 1 篇 Passage + 10 题原创仿真材料"
AI：
- 先确认版本 / 难度 / 套题大小 / 材料形式
- 给出一篇 GT 仿真 Passage
- 配套 10 道正式风格题目
- 你做完后再进入逐题分析
```
```

Keep the existing numbering style around it consistent when editing nearby headings.

- [ ] **Step 2: Verify the README contains the new usage path**

Run:

```bash
grep -n "场景 3B：让阅读 skill 原创出题\|原创仿真材料" README.md
```

Expected: at least 2 matches, including the new heading and the example prompt.

- [ ] **Step 3: Commit the README update**

```bash
git add README.md
git commit -m "docs: document reading material generation workflow

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Run the full regression suite and verify the handoff state

**Files:**
- Modify: none
- Test: `tests/skills/skill-contract.test.mjs`, full repository test suite

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS with the existing runtime tests plus the updated skill-contract coverage.

- [ ] **Step 2: Review the final diff before handoff**

Run:

```bash
git --no-pager show --stat --oneline HEAD~2..HEAD
```

Expected: only `ielts-reading/SKILL.md`, `tests/skills/skill-contract.test.mjs`, and `README.md` appear in the final feature range.

- [ ] **Step 3: Verify the working tree is clean**

Run:

```bash
git --no-pager status --short
```

Expected: no output, because the task commits were already created in Tasks 1-3.
