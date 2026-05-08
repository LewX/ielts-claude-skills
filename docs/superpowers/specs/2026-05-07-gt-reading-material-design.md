# GT Reading Material Design

**Date:** 2026-05-07  
**Status:** Approved

## Problem

The user wants a practice set that matches IELTS General Training Reading requirements, targets Band 8 difficulty, and is safe to use in-session without copyright risk. The current request is not to analyze existing questions, but to design a workflow for generating one original simulated passage and ten exam-style questions.

## Proposed Solution

Create one original IELTS General Training reading set consisting of:

- one simulated GT passage (650-850 words)
- ten questions in official-style formats
- answer key
- location and reasoning notes
- synonym/paraphrase table for review

The first version is intentionally limited to one passage so it can serve both as training and as a diagnostic baseline for the user's reading process.

## Scope

**In:** one GT passage, ten questions, answer key, explanation set, paraphrase table, Band 8 difficulty control.  
**Out:** full multi-passage section, academic reading, copyrighted source text reuse, writing or speaking content.

## Architecture

### Output Package

The generated material is split into five sections:

1. **Passage** — a clean General Training text without hints
2. **Questions 1-10** — formatted like IELTS Reading instructions
3. **Answer Key** — standard answers only
4. **Reasoning and Location Notes** — paragraph/sentence location, inference chain, and why distractors fail
5. **Paraphrase Table** — question wording mapped to passage wording

### Passage Design

The passage should read like a real GT source, such as:

- staff handbook extract
- community information sheet
- visitor guide
- internal policy or process note

The tone should be practical and information-dense rather than academic. The passage must support ordered question flow so the user is primarily tested on locating and matching information, not on handling arbitrary disorder.

### Question Design

The default mix is:

- **True/False/Not Given x4**
- **Sentence Completion x3**
- **Multiple Choice x3**

This mix targets the highest-value GT reading skills for a user aiming at Band 8:

- precise locating
- paraphrase recognition
- boundary control between FALSE and NOT GIVEN
- elimination of partially correct options

## Difficulty Control

Band 8 difficulty is achieved through text-to-question design, not through obscure vocabulary.

### Hard Constraints

1. Question wording cannot directly copy the source sentence.
2. At least two T/F/NG items must test the FALSE vs NOT GIVEN boundary.
3. Sentence Completion items must have one unambiguous source answer within the stated word limit.
4. Multiple Choice distractors must reflect common IELTS traps:
   - partial match
   - degree shift
   - scope shift
   - wrong cause
5. Every correct answer must be defensible from explicit textual evidence.

### Calibration

Expected interpretation of raw score on this ten-question set:

- **7/10:** roughly Band 7.0-7.5 processing
- **8/10:** near Band 8 handling on this passage type
- **9-10/10:** set may be slightly conservative and should be hardened next round

## Data Flow

1. Select a GT-appropriate scenario and passage type.
2. Draft the passage with enough information density and paraphraseable language.
3. Map candidate evidence sentences.
4. Write ten questions in source order.
5. Validate uniqueness of answers and instruction fit.
6. Produce answer key, location notes, and paraphrase table.
7. Deliver the package in training order:
   - passage
   - questions
   - answer key
   - explanations
   - paraphrase review

## Error Handling and Quality Controls

- Do not introduce knowledge-based questions that require background knowledge outside the text.
- Do not create more than one defensible completion answer.
- Do not mix GT style with academic article tone.
- Do not use non-IELTS question formats.
- If a question depends on interpretation rather than textual support, rewrite it.

## Testing and Review

Before delivery, the material should be checked against these criteria:

1. Each answer can be located in the passage.
2. Question order follows passage order unless a format explicitly justifies otherwise.
3. T/F/NG labels depend on explicit evidence, not logic beyond the text.
4. Sentence Completion obeys word-limit instructions.
5. Distractors are explainable and not random.

## Next Step

After spec approval, implementation planning should define the exact generation workflow, output template, and validation checklist for producing the first GT Band 8 reading set.
