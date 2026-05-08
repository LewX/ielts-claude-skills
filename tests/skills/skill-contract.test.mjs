import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readSkill(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('ielts-writing skill documents the persistence handoff contract', async () => {
  const skill = await readSkill('../../ielts-writing/SKILL.md');

  const handoffIndex = skill.indexOf('## Structured persistence handoff');
  const boundaryIndex = skill.indexOf('## 边界');

  assert.notEqual(handoffIndex, -1);
  assert.notEqual(boundaryIndex, -1);
  assert.ok(handoffIndex < boundaryIndex);

  assert.match(
    skill,
    /只有在.*完整批改后.*才允许持久化。/u
  );
  assert.match(skill, /审题模式、仅练习出题、只给 prompt、用户中途放弃，都\*\*不要\*\*持久化。/u);

  for (const marker of [
    '"skill": "ielts-writing"',
    '"mode": "correction"',
    '"timestamp":',
    '"title":',
    '"scores":',
    '"summary":',
    '"findings":',
    '"artifacts":',
    '"kind": "rewrite"',
  ]) {
    assert.match(skill, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  }

  for (const tag of [
    'task-response.missed-part',
    'task-response.underdeveloped-idea',
    'coherence.paragraph-focus',
    'lexical.collocation',
    'grammar.article',
    'grammar.subject-verb-agreement',
  ]) {
    assert.match(skill, new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  }

  assert.match(
    skill,
    /node runtime\/ieltsctl\.mjs record --project "\$PWD" --payload-file "\$PAYLOAD_FILE"/u
  );
  assert.match(skill, /node runtime\/ieltsctl\.mjs derive --project "\$PWD"/u);
  assert.match(
    skill,
    /本次批改已完成，但学习记录归档失败。我不会假装已经保存成功；请稍后重试一次。/u
  );
  assert.match(skill, /---\n\n## 边界/u);
});

test('runtime fixtures use the correction mode label consistently', async () => {
  for (const fixturePath of [
    '../../tests/runtime/record.test.mjs',
    '../../tests/runtime/summary.test.mjs',
  ]) {
    const fixture = await readSkill(fixturePath);

    assert.doesNotMatch(fixture, /full-correction/u);
    assert.match(fixture, /mode: 'correction'/u);
  }
});

test('ielts skill documents runtime summary routing guidance', async () => {
  const skill = await readSkill('../../ielts/SKILL.md');

  assert.match(skill, /node runtime\/ieltsctl\.mjs summary --project "\$PWD"/u);
  assert.match(skill, /首次使用/u);
  assert.match(skill, /已有历史/u);
  assert.match(skill, /先用自然语言总结最近的学习状态。/u);
  assert.match(skill, /明确提到 `nextStep\.focusSkill`/u);
  assert.match(skill, /然后继续执行上面的路由流程。/u);
  assert.match(skill, /不要把原始 JSON 直接倒给用户。/u);
  assert.match(skill, /摘要说完后，继续路由，不要停在 summary 输出上。/u);
});

test('README documents GT reading material generation behaviour', async () => {
  const readme = await readSkill('../../README.md');

  // answer-withholding promise is visible to readers of the README
  assert.match(readme, /第一轮回复不含答案和解析/u);

  // deferred output: answer key only after submission
  assert.match(readme, /提交答案后才输出答案 Key/u);

  // no unnecessary confirmation round-trip when variables are already specified
  assert.match(readme, /不发起额外确认/u);
});

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

  // answer-withholding rule before submission
  assert.match(skill, /禁止.*在出题阶段输出/u);

  // deferred-output behaviour
  assert.match(skill, /用户提交答案后/u);

  // locatability requirement
  assert.match(skill, /每道题都必须能在原文定位/u);

  // passage-length constraint
  assert.match(skill, /650[–\-]850/u);

  // source-order constraint (mandatory, not advisory)
  assert.match(skill, /题目顺序必须与.*段落顺序一致/u);

  // exact question-type counts
  assert.match(skill, /True\/False\/Not Given x4/u);
  assert.match(skill, /Sentence Completion x3/u);
  assert.match(skill, /Multiple Choice x3/u);

  // quality constraint: uniqueness
  assert.match(skill, /必须可唯一作答/u);

  // quality constraint: FALSE vs NOT GIVEN distinction
  assert.match(skill, /必须严格区分 FALSE 和 NOT GIVEN/u);

  // quality constraint: at least two T/F/NG items test the FALSE vs NG boundary
  assert.match(skill, /至少 2 题专门测 FALSE 与 NOT GIVEN 的边界/u);

  // quality constraint: no invented question types
  assert.match(skill, /不自创题型/u);

  // quality constraint: question wording cannot directly copy the source sentence
  assert.match(skill, /题目措辞不能直接抄原文句子/u);

  // quality constraint: real distractor logic (not fabricated)
  assert.match(skill, /真实误判/u);

  // no extra confirmation — rule is unconditional (not gated on "all variables specified")
  assert.match(skill, /直接生成——\*\*不要发起额外确认\*\*/u);

  // generation-mode trigger phrases exposed in frontmatter description
  assert.match(skill, /给我一套阅读题/u);
  assert.match(skill, /生成阅读材料/u);

  // UI-routing contract for original-material generation
  assert.match(skill, /默认优先启用 UI 做题页/u);
  assert.match(
    skill,
    /node runtime\/ieltsctl\.mjs launch-reading-ui --project "\$PWD" --session-file "\$SESSION_FILE"/u
  );
  assert.match(skill, /至少包含 `view`，以及该 `view` 所需的数据/u);
  assert.doesNotMatch(skill, /passage、questions、config/u);
  assert.match(skill, /不声称 UI 已启动/u);
  assert.match(skill, /只接受原创材料训练链启用 UI/u);
  assert.match(skill, /复用项目内持久化的共享 UI shell/u);
  assert.match(skill, /必须从 stdout JSON 读取 `url`/u);
  assert.match(skill, /把该 URL 原样告诉用户/u);
});

test('README documents ielts-reading UI routing behaviour', async () => {
  const readme = await readSkill('../../README.md');

  assert.match(readme, /默认优先启用 UI 做题页/u);
});
