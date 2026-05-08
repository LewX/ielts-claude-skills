# Reading Review UI Refinement Design

**Date:** 2026-05-08  
**Status:** Approved

## Problem

The current reading review UI is functional but weak as a study surface.

It separates the review result from the original passage, makes correctness states too subtle, and still exposes English explanation text. That forces the user to remember the passage from memory, slows error review, and weakens the reading-skill promise of evidence-based explanation.

## Proposed Solution

Upgrade the browser review experience so it feels like a real post-submission correction page rather than a plain result dump.

The refined review page should:

1. keep the original passage visible while reviewing answers
2. make correct / wrong / unanswered states visually obvious
3. present answer explanation in Chinese
4. highlight the evidence sentence(s) inside the passage for the currently selected question

This refinement extends the existing reading practice UI. It does not introduce a new workflow, page family, or storage model.

## Scope

**In:** review-page layout refinement, persistent left-column passage display, per-question status emphasis, Chinese explanation copy in review mode, evidence highlighting inside the passage, current-question focus state.  
**Out:** redesign of the practice page, new question types, dashboard features, automatic translation of the whole passage, multi-question simultaneous highlighting, mobile-specific redesign, external passage import.

## Product Design

### Review Page Layout

The review page should use the same two-column shell as the practice page so the product feels continuous before and after submission.

- **Left column:** full original passage
- **Right column:** score summary and per-question review cards

This directly addresses the current usability gap: the user should not have to mentally reconstruct the passage or switch away from the correction page to review evidence.

### Passage Persistence in Review

The full passage must remain visible throughout review mode.

The left column should continue to show:

- set title
- passage title
- full passage body

The review page should not replace the passage with a score-only summary. The passage is part of the correction experience, not just the answering experience.

### Question-Focused Evidence Highlighting

Only the **currently selected question** should highlight its evidence sentence(s) in the left-column passage.

Interaction rule:

1. the review page loads with the first review card selected by default
2. when the user clicks a different review card, that card becomes active
3. the left-column passage updates to highlight only that question's evidence

This keeps the page readable while still making the answer source obvious. Highlighting all questions at once would create noise and make the passage harder to scan.

### Correctness Visibility

Correct / wrong / unanswered states must become visually explicit, not just lightly implied through border color.

Each review card should include:

- a strong status badge
- a stronger card background or border treatment
- distinct color usage for correct / wrong / unanswered
- a clear active-card state for the currently selected question

The user should be able to tell the state of a question without reading the explanation text.

### Chinese Review Explanation

The review UI should present explanation text in Chinese.

Review copy should make these ideas explicit:

- what the correct answer is
- where the answer comes from
- why the user's answer is wrong, if applicable
- how to reason from passage wording to the answer

If the stored explanation content is already Chinese, render it directly. If the stored explanation content is English, the review layer should not show raw English-only explanation as the final user-facing text for this flow.

## Data and Rendering Model

### Required Review Inputs

The refined review page still depends on the existing result payload, plus the original set payload already available to the browser flow.

The UI must have access to:

- full passage text
- question prompt
- question status
- user answer
- correct answer
- evidence sentence array
- explanation text

### Passage Highlight Strategy

Evidence highlighting should use exact evidence strings already stored on the question/result payload.

The UI should:

1. render the original passage text
2. find the active question's evidence strings in that text
3. wrap matching evidence spans in a highlight style

If an evidence string cannot be matched exactly, the page should still render normally without breaking the passage view. The failure mode is "no highlight for that item," not "broken review page."

## Interaction Flow

1. user submits answers from the practice page
2. result payload is returned
3. review page renders in the same two-column shell
4. first review card is active by default
5. corresponding evidence sentence is highlighted in the passage
6. user clicks another review card
7. active state moves to that card
8. passage highlight updates to that question's evidence

## Error Handling

- If the review payload is incomplete, the UI should continue to fail explicitly rather than render a misleading partial review.
- If the active question has no evidence array, the card should still render, but the passage should show no highlight for that question.
- If highlight matching fails for one evidence string, the page should still render the full passage and the rest of the review UI.
- If explanation text is missing, the page should not invent success-shaped copy; it should surface a clear fallback message consistent with the existing runtime contract.

## Validation Rules

- Review mode must clearly differentiate `correct`, `wrong`, and `unanswered`.
- Only one review card is active at a time.
- Only the active question's evidence is highlighted in the passage.
- Highlighting must not mutate or truncate the original passage text.
- The review page must remain understandable even when no evidence can be highlighted for a question.

## Verification

The implementation plan must verify:

1. review mode still shows the score summary
2. the passage remains visible in review mode
3. correct / wrong / unanswered states are visually distinct in the rendered markup
4. the first question is active by default
5. clicking another review card changes the active state
6. only the active question's evidence is highlighted in the passage
7. review explanation copy is Chinese

## Notes

This refinement should be implemented as an extension of the current reading UI, not as a second review product. The practice page and review page should continue to feel like one consistent workflow with a stronger correction experience after submission.
