import path from 'node:path';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { deriveReadingResult } from './reading-result.mjs';
import { getPaths, writeReadingAttempt } from './storage.mjs';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

export async function copyReadingUiAssets(projectDir) {
  const paths = getPaths(projectDir);
  const targetDir = paths.readingUiDir;
  await mkdir(targetDir, { recursive: true });

  const sourceDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'ui', 'reading');
  const indexFile = path.join(targetDir, 'index.html');
  const appFile = path.join(targetDir, 'app.js');
  const stylesFile = path.join(targetDir, 'styles.css');

  await copyFile(path.join(sourceDir, 'index.html'), indexFile);
  await copyFile(path.join(sourceDir, 'app.js'), appFile);
  await copyFile(path.join(sourceDir, 'styles.css'), stylesFile);

  return { indexFile, appFile, stylesFile, targetDir };
}

export async function startReadingUiServer({ projectDir, sessionPayload }) {
  const assets = await copyReadingUiAssets(projectDir);
  const practiceSet = sessionPayload?.view === 'practice' ? sessionPayload.set : null;

  const server = createServer(async (request, response) => {
    if (request.url === '/session') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(sessionPayload));
      return;
    }

    if (request.url === '/submit' && request.method === 'POST') {
      if (!practiceSet) {
        response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ ok: false, error: 'This session does not accept answers.' }));
        return;
      }

      try {
        let requestBody = '';

        for await (const chunk of request) {
          requestBody += chunk;
        }

        const payload = requestBody ? JSON.parse(requestBody) : {};
        const result = {
          setId: practiceSet.id,
          examType: practiceSet.examType,
          ...deriveReadingResult({
            examType: practiceSet.examType,
            questions: practiceSet.questions,
            answers: payload.answers ?? {},
          }),
        };

        await writeReadingAttempt(projectDir, result);

        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify(result));
      } catch {
        response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ ok: false, error: 'Unable to score reading answers.' }));
      }
      return;
    }

    const urlPath = request.url?.split('?')[0] ?? '/';
    const ext = path.extname(urlPath);
    const contentType = CONTENT_TYPES[ext] ?? CONTENT_TYPES['.html'];

    const fileName =
      urlPath === '/styles.css'
        ? assets.stylesFile
        : urlPath === '/app.js'
          ? assets.appFile
          : assets.indexFile;

    try {
      const body = await readFile(fileName);
      response.setHeader('content-type', contentType);
      response.end(body);
    } catch {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Internal server error');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}
