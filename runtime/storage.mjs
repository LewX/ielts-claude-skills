import path from 'node:path';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

export function getPaths(projectDir) {
  const dataDir = path.join(projectDir, '.ielts');

  return {
    dataDir,
    profile: path.join(dataDir, 'profile.json'),
    attemptsDir: path.join(dataDir, 'attempts'),
    backupsDir: path.join(dataDir, 'backups'),
    readingDir: path.join(dataDir, 'reading'),
    readingSetsDir: path.join(dataDir, 'reading', 'sets'),
    readingAttemptsDir: path.join(dataDir, 'reading', 'attempts'),
    readingUiDir: path.join(dataDir, 'reading', 'ui'),
    findings: path.join(dataDir, 'findings', 'inbox.jsonl'),
    rewriteArtifacts: path.join(dataDir, 'artifacts', 'rewrites.jsonl'),
    speakingArtifacts: path.join(dataDir, 'artifacts', 'speaking-stories.jsonl'),
    synonymArtifacts: path.join(dataDir, 'artifacts', 'synonyms.jsonl'),
    stats: path.join(dataDir, 'derived', 'stats.json'),
    weakSpots: path.join(dataDir, 'derived', 'weak-spots.json'),
    nextStep: path.join(dataDir, 'derived', 'next-step.json'),
  };
}

export async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, json(value), 'utf8');
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export async function appendJsonl(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(value)}\n`, 'utf8');
}

export async function ensureFile(filePath, contents) {
  await mkdir(path.dirname(filePath), { recursive: true });

  try {
    await readFile(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      await writeFile(filePath, contents, 'utf8');
      return;
    }

    throw error;
  }
}

export async function initProject(projectDir) {
  const paths = getPaths(projectDir);

  await mkdir(paths.attemptsDir, { recursive: true });
  await mkdir(paths.backupsDir, { recursive: true });
  await mkdir(paths.readingSetsDir, { recursive: true });
  await mkdir(paths.readingAttemptsDir, { recursive: true });
  await mkdir(paths.readingUiDir, { recursive: true });
  await ensureFile(
    paths.profile,
    json({
      targetBand: null,
      examDate: null,
      currentLevel: {},
      preferences: {},
    })
  );
  await ensureFile(paths.findings, '');
  await ensureFile(paths.rewriteArtifacts, '');
  await ensureFile(paths.speakingArtifacts, '');
  await ensureFile(paths.synonymArtifacts, '');
  await ensureFile(
    paths.stats,
    json({
      attemptCount: 0,
      attemptsBySkill: {},
      latestWritingBand: null,
    })
  );
  await ensureFile(
    paths.weakSpots,
    json({
      topTags: [],
    })
  );
  await ensureFile(
    paths.nextStep,
    json({
      focusSkill: null,
      reason: 'No persisted attempts yet.',
    })
  );

  return paths;
}

export async function writeReadingAttempt(projectDir, result) {
  const paths = getPaths(projectDir);
  const filePath = path.join(paths.readingAttemptsDir, `${result.setId}.json`);
  await writeJson(filePath, result);
  return filePath;
}

export async function writeAttempt(projectDir, attempt) {
  const paths = getPaths(projectDir);
  const year = new Date(attempt.timestamp).getUTCFullYear().toString();
  const safeTimestamp = attempt.timestamp.replace(/[:.]/g, '-');
  const attemptFile = path.join(
    paths.attemptsDir,
    year,
    `${attempt.skill}-${safeTimestamp}.json`
  );

  await writeJson(attemptFile, attempt);

  for (const finding of attempt.findings) {
    await appendJsonl(paths.findings, {
      ...finding,
      skill: attempt.skill,
      timestamp: attempt.timestamp,
      attemptTitle: attempt.title,
    });
  }

  const artifactTargets = {
    rewrite: paths.rewriteArtifacts,
    'speaking-story': paths.speakingArtifacts,
    'synonym-set': paths.synonymArtifacts,
  };

  for (const artifact of attempt.artifacts) {
    await appendJsonl(artifactTargets[artifact.kind], {
      ...artifact,
      skill: attempt.skill,
      timestamp: attempt.timestamp,
      attemptTitle: attempt.title,
    });
  }

  return attemptFile;
}
