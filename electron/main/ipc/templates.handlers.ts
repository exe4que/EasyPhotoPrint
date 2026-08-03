// @spec OPENSPEC.md §3.1, §3.3 — explicit template IPC channels
import { app, ipcMain } from 'electron';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { EPPTemplate } from '@epp/layout-engine';

import { normalizeTemplateDocument, prepareTemplateForSave } from './templates.helpers.js';

const LIST_TEMPLATES_CHANNEL = 'templates:list';
const SAVE_TEMPLATE_CHANNEL = 'templates:save';
const DELETE_TEMPLATE_CHANNEL = 'templates:delete';

function getTemplatesDirectory(): string {
  return join(app.getPath('userData'), 'templates');
}

function getTemplatePath(templateId: string): string {
  return join(getTemplatesDirectory(), `${templateId}.epptemplate`);
}

export function registerTemplateHandlers(): void {
  ipcMain.removeHandler(LIST_TEMPLATES_CHANNEL);
  ipcMain.removeHandler(SAVE_TEMPLATE_CHANNEL);
  ipcMain.removeHandler(DELETE_TEMPLATE_CHANNEL);

  ipcMain.handle(LIST_TEMPLATES_CHANNEL, async () => {
    await mkdir(getTemplatesDirectory(), { recursive: true });
    const entries = await readdir(getTemplatesDirectory(), { withFileTypes: true });
    const templates = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.epptemplate'))
        .map(async (entry) => {
          const raw = await readFile(join(getTemplatesDirectory(), entry.name), 'utf8');
          return normalizeTemplateDocument(JSON.parse(raw));
        }),
    );

    return templates.sort((left, right) => {
      const leftDate = left.updatedAt ?? left.createdAt ?? '';
      const rightDate = right.updatedAt ?? right.createdAt ?? '';
      return rightDate.localeCompare(leftDate);
    }) satisfies EPPTemplate[];
  });

  ipcMain.handle(SAVE_TEMPLATE_CHANNEL, async (_event, template: EPPTemplate) => {
    if (template.name.trim() === '') {
      throw new Error('Template name cannot be empty.');
    }

    await mkdir(getTemplatesDirectory(), { recursive: true });
    let existingTemplate: EPPTemplate | undefined;
    try {
      const raw = await readFile(getTemplatePath(template.id), 'utf8');
      existingTemplate = normalizeTemplateDocument(JSON.parse(raw));
    } catch {
      existingTemplate = undefined;
    }

    const nextTemplate = prepareTemplateForSave(template, existingTemplate);
    await writeFile(getTemplatePath(nextTemplate.id), JSON.stringify(nextTemplate, null, 2), 'utf8');
    return nextTemplate;
  });

  ipcMain.handle(DELETE_TEMPLATE_CHANNEL, async (_event, templateId: string) => {
    await rm(getTemplatePath(templateId), { force: true });
  });
}

