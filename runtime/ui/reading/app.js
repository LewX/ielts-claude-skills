async function loadSession() {
  const response = await fetch('/session');
  if (!response.ok) {
    throw new Error(`Failed to load session (${response.status})`);
  }

  return response.json();
}

function renderSummary(result) {
  return `
    <section class="score-card">
      <h2>${result.rawScore.correct}/${result.rawScore.total}</h2>
      <p>${result.bandEstimate.label}</p>
    </section>
  `;
}

function renderFallback(message) {
  return `<div class="reading-error" role="alert">${message}</div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isReviewResult(result) {
  return Boolean(
    result
    && result.rawScore
    && typeof result.rawScore.correct === 'number'
    && typeof result.rawScore.total === 'number'
    && result.bandEstimate
    && typeof result.bandEstimate.label === 'string'
    && Array.isArray(result.questions)
  );
}

function isPracticeSession(session) {
  return Boolean(
    session
    && session.view === 'practice'
    && session.set
    && typeof session.set.title === 'string'
    && session.set.passage
    && typeof session.set.passage.title === 'string'
    && typeof session.set.passage.body === 'string'
    && Array.isArray(session.set.questions)
    && session.set.questions.length > 0,
  );
}

function renderPassageBody(body) {
  return body
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('');
}

function renderChoiceOptions(question) {
  const inputType = Array.isArray(question.answerKey) ? 'checkbox' : 'radio';

  return (question.options ?? [])
    .map((option) => `
      <label class="choice-option">
        <input type="${inputType}" name="${escapeHtml(question.id)}" value="${escapeHtml(option)}" />
        <span>${escapeHtml(option)}</span>
      </label>
    `)
    .join('');
}

function renderQuestion(question, index) {
  const meta =
    question.type === 'sentence-completion' && typeof question.wordLimit === 'number'
      ? `<p class="question-meta">Word limit: ${question.wordLimit}</p>`
      : '';

  const control =
    question.type === 'sentence-completion'
      ? `<input class="answer-input" type="text" name="${escapeHtml(question.id)}" autocomplete="off" />`
      : `<div class="choice-group">${renderChoiceOptions(question)}</div>`;

  return `
    <article class="question-card">
      <p class="question-number">Question ${index + 1}</p>
      <h3>${escapeHtml(question.prompt)}</h3>
      ${meta}
      ${control}
    </article>
  `;
}

function getDefaultActiveQuestionId(session) {
  return session.result?.questions?.[0]?.questionId ?? null;
}

function getActiveQuestionResult(session, uiState) {
  const activeQuestionId = uiState.activeQuestionId ?? getDefaultActiveQuestionId(session);
  return session.result.questions.find((question) => question.questionId === activeQuestionId)
    ?? session.result.questions[0];
}

function getStatusMeta(status) {
  if (status === 'correct') {
    return { label: '正确', className: 'status-badge--correct' };
  }

  if (status === 'wrong') {
    return { label: '错误', className: 'status-badge--wrong' };
  }

  return { label: '未作答', className: 'status-badge--unanswered' };
}

function createChineseExplanation(question) {
  const normalizedUserAnswer = formatAnswer(question.userAnswer);
  const normalizedCorrectAnswer = formatAnswer(question.correctAnswer);

  if (question.status === 'correct') {
    return '你的答案正确，可以对照原文中的依据句确认定位过程。';
  }

  if (question.status === 'unanswered') {
    return `你还没有作答，先看原文中的依据句，再倒推正确答案。本题正确答案是${normalizedCorrectAnswer}。`;
  }

  return `你选错了，需要回到原文定位依据，再比较题干和原文是否同义或相反。你选择了${normalizedUserAnswer}，正确答案是${normalizedCorrectAnswer}。`;
}

function renderReviewQuestions(result, set, activeQuestionId) {
  if (!set || !Array.isArray(result.questions)) {
    return '';
  }

  const promptById = new Map(set.questions.map((question) => [question.id, question.prompt]));

  return `
    <section class="review-list">
      ${result.questions.map((question, index) => {
        const statusMeta = getStatusMeta(question.status);
        const activeClass = question.questionId === activeQuestionId ? 'review-card--active' : '';

        return `
          <article
            class="review-card review-card--${escapeHtml(question.status)} ${activeClass}"
            data-review-card
            data-question-id="${escapeHtml(question.questionId)}"
          >
            <div class="review-card-header">
              <p class="question-number">Question ${index + 1}</p>
              <span class="status-badge ${statusMeta.className}">${statusMeta.label}</span>
            </div>
            <h3>${escapeHtml(promptById.get(question.questionId) ?? question.questionId)}</h3>
            <p><strong>状态：${statusMeta.label}</strong></p>
            <p><strong>你的答案：${escapeHtml(formatAnswer(question.userAnswer))}</strong></p>
            <p><strong>正确答案：${escapeHtml(formatAnswer(question.correctAnswer))}</strong></p>
            <p><strong>答案依据：${escapeHtml((question.evidence ?? []).join(' / '))}</strong></p>
            <p><strong>解析：${escapeHtml(createChineseExplanation(question))}</strong></p>
          </article>
        `;
      }).join('')}
    </section>
  `;
}

function renderPracticeSession(session) {
  return `
    <div class="reading-layout">
      <section class="reading-panel passage-panel">
        <p class="panel-eyebrow">${escapeHtml(session.set.title)}</p>
        <h2>${escapeHtml(session.set.passage.title)}</h2>
        <div class="passage-body">
          ${renderPassageBody(session.set.passage.body)}
        </div>
      </section>
      <section class="reading-panel question-panel">
        <form data-reading-form>
          <header class="question-header">
            <h2>Questions</h2>
            <p>Answer all questions, then submit to get your score.</p>
          </header>
          ${session.set.questions.map(renderQuestion).join('')}
          <div class="question-actions">
            <button class="submit-button" type="submit" data-submit-button>Submit answers</button>
            <p class="submit-hint">Your raw score and estimated IELTS Band will appear immediately after submission.</p>
          </div>
        </form>
      </section>
    </div>
  `;
}

function formatAnswer(answer) {
  if (answer == null || answer === '') {
    return 'Unanswered';
  }

  if (Array.isArray(answer)) {
    return answer.join(', ');
  }

  return String(answer);
}

function findHighlightRanges(paragraph, evidence) {
  const ranges = [];

  for (const snippet of evidence) {
    const normalizedSnippet = String(snippet).trim();
    if (!normalizedSnippet) {
      continue;
    }

    const fallbackSnippet = normalizedSnippet.replace(/[.。!?！？]+$/u, '');
    const candidates = [normalizedSnippet];

    if (fallbackSnippet && fallbackSnippet !== normalizedSnippet) {
      candidates.push(fallbackSnippet);
    }

    for (const candidate of candidates) {
      const start = paragraph.indexOf(candidate);

      if (start === -1) {
        continue;
      }

      const end = start + candidate.length;
      const overlapsExisting = ranges.some((range) => start < range.end && end > range.start);
      if (!overlapsExisting) {
        ranges.push({ start, end });
      }
      break;
    }
  }

  return ranges.sort((left, right) => left.start - right.start);
}

function highlightParagraph(paragraph, evidence) {
  const ranges = findHighlightRanges(paragraph, evidence);

  if (ranges.length === 0) {
    return escapeHtml(paragraph);
  }

  let cursor = 0;
  let html = '';

  for (const range of ranges) {
    html += escapeHtml(paragraph.slice(cursor, range.start));
    html += `<mark class="passage-highlight">${escapeHtml(paragraph.slice(range.start, range.end))}</mark>`;
    cursor = range.end;
  }

  html += escapeHtml(paragraph.slice(cursor));
  return html;
}

function highlightEvidence(body, evidence) {
  return body
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${highlightParagraph(paragraph, evidence)}</p>`)
    .join('');
}

function renderReviewSession(session, uiState = {}) {
  const activeQuestion = getActiveQuestionResult(session, uiState);

  return `
    <div class="reading-layout reading-layout--review">
      <section class="reading-panel passage-panel">
        <p class="panel-eyebrow">${escapeHtml(session.set.title)}</p>
        <h2>${escapeHtml(session.set.passage.title)}</h2>
        <div class="passage-body">
          ${highlightEvidence(session.set.passage.body, activeQuestion?.evidence ?? [])}
        </div>
      </section>
      <section class="reading-panel review-panel">
        ${renderSummary(session.result)}
        ${renderReviewQuestions(session.result, session.set, activeQuestion?.questionId)}
      </section>
    </div>
  `;
}

export function renderSession(session, uiState = {}) {
  if (!session || typeof session !== 'object') {
    throw new Error('Malformed session payload');
  }

  if (typeof session.view !== 'string') {
    throw new Error('Malformed session payload');
  }

  if (session.view === 'review') {
    if (!isReviewResult(session.result)) {
      throw new Error('Malformed review payload');
    }

    return renderReviewSession(session, uiState);
  }

  if (!isPracticeSession(session)) {
    throw new Error('Malformed practice payload');
  }

  return renderPracticeSession(session);
}

function collectAnswers(form, questions) {
  const formData = new FormData(form);

  return Object.fromEntries(
    questions.map((question) => {
      if (Array.isArray(question.answerKey)) {
        return [question.id, formData.getAll(question.id).map((value) => String(value).trim())];
      }

      return [question.id, String(formData.get(question.id) ?? '').trim()];
    }),
  );
}

async function submitAnswers({ app, form, session }) {
  const response = await fetch('/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      answers: collectAnswers(form, session.set.questions),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to score reading answers (${response.status})`);
  }

  const result = await response.json();

  if (!isReviewResult(result)) {
    throw new Error('Malformed review payload');
  }

  initializeSessionView(app, { view: 'review', set: session.set, result });
}

function bindPracticeForm(app, session) {
  if (typeof app.querySelector !== 'function') {
    return;
  }

  const form = app.querySelector('[data-reading-form]');
  if (!form || typeof form.addEventListener !== 'function') {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      await submitAnswers({ app, form, session });
    } catch (error) {
      app.innerHTML = renderFallback('Unable to score reading answers. Please refresh and try again.');
      console.error('Reading UI failed to submit answers', error);
    }
  });
}

function bindReviewCards(app, session, uiState) {
  if (typeof app.querySelectorAll !== 'function') {
    return;
  }

  for (const card of app.querySelectorAll('[data-review-card]')) {
    card.addEventListener('click', () => {
      initializeSessionView(app, session, {
        ...uiState,
        activeQuestionId: card.dataset.questionId,
      });
    });
  }
}

export function initializeSessionView(app, session, uiState = {}) {
  app.innerHTML = renderSession(session, uiState);

  if (session.view === 'practice') {
    bindPracticeForm(app, session);
    return;
  }

  bindReviewCards(app, session, uiState);
}

async function bootstrap() {
  const app = document.querySelector('#app');

  if (!app) {
    console.error('Reading UI root element #app was not found');
    return;
  }

  try {
    const session = await loadSession();
    initializeSessionView(app, session);
  } catch (error) {
    app.innerHTML = renderFallback('Unable to load reading session. Please refresh and try again.');
    console.error('Reading UI failed to load session', error);
  }
}

if (typeof document !== 'undefined') {
  bootstrap();
}
