import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { getPaths, readJson, writeJson } from './storage.mjs';

async function readAttemptFiles(projectDir) {
  const { attemptsDir } = getPaths(projectDir);

  let yearEntries = [];

  try {
    yearEntries = await readdir(attemptsDir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  const attempts = [];

  for (const yearEntry of yearEntries.filter((entry) => entry.isDirectory())) {
    const yearDir = path.join(attemptsDir, yearEntry.name);
    const fileEntries = await readdir(yearDir, { withFileTypes: true });

    for (const fileEntry of fileEntries) {
      if (!fileEntry.isFile() || !fileEntry.name.endsWith('.json')) {
        continue;
      }

      attempts.push(await readJson(path.join(yearDir, fileEntry.name)));
    }
  }

  return attempts;
}

export async function deriveProject(projectDir) {
  const paths = getPaths(projectDir);
  const attempts = await readAttemptFiles(projectDir);
  const attemptsBySkill = {};
  const tagCounts = new Map();
  let latestWritingAttempt = null;

  for (const attempt of attempts) {
    attemptsBySkill[attempt.skill] = (attemptsBySkill[attempt.skill] ?? 0) + 1;

    if (
      attempt.skill === 'ielts-writing' &&
      (!latestWritingAttempt || attempt.timestamp > latestWritingAttempt.timestamp)
    ) {
      latestWritingAttempt = attempt;
    }

    for (const finding of attempt.findings) {
      tagCounts.set(finding.tag, (tagCounts.get(finding.tag) ?? 0) + 1);
    }
  }

  const stats = {
    attemptCount: attempts.length,
    attemptsBySkill,
    latestWritingBand: latestWritingAttempt?.scores.overall ?? null,
  };
  const weakSpots = {
    topTags: [...tagCounts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag))
      .slice(0, 5),
  };
  const nextStep =
    weakSpots.topTags.length > 0
      ? {
          // Phase 1 / writing-first MVP: keep next-step routing on ielts-writing
          // until we intentionally add multi-skill derivation.
          focusSkill: 'ielts-writing',
          reason: `Most frequent finding: ${weakSpots.topTags[0].tag} (${weakSpots.topTags[0].count}).`,
        }
      : {
          focusSkill: null,
          reason: 'No persisted attempts yet.',
        };

  await writeJson(paths.stats, stats);
  await writeJson(paths.weakSpots, weakSpots);
  await writeJson(paths.nextStep, nextStep);

  return { stats, weakSpots, nextStep };
}
