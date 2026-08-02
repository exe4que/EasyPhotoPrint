// @spec OPENSPEC.md §3.1, §6.1 — template gallery with apply flow and dynamic previews
import type { EPPTemplate } from '@epp/layout-engine';
import { useEffect, useState } from 'react';

import { getEppApi } from '../../lib/ipc-client.js';
import { useEPPStore } from '../../store/index.js';
import { CollapsiblePanel } from '../ui/CollapsiblePanel.js';
import { TemplateThumbnail } from './TemplateThumbnail.js';

function formatTimestamp(value?: string): string {
  if (!value) {
    return 'No timestamp';
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function TemplateGallery({ refreshKey }: { refreshKey: number }) {
  const [templates, setTemplates] = useState<EPPTemplate[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const activePageId = useEPPStore((state) => state.ui.activePageId);
  const applyTemplate = useEPPStore((state) => state.applyTemplate);

  const loadTemplates = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const nextTemplates = await getEppApi().templates.list();
      setTemplates(nextTemplates);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load templates.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, [refreshKey]);

  return (
    <CollapsiblePanel
      title="Template gallery"
      description="Browse saved layouts and apply one to the active page."
      defaultCollapsed={false}
      actions={
        <button
          type="button"
          onClick={() => void loadTemplates()}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-600"
        >
          Refresh
        </button>
      }
    >

      {errorMessage ? (
        <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-8 text-center text-sm text-slate-400">
          Loading templates…
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-8 text-center text-sm text-slate-400">
          No templates saved yet.
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <div key={template.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="flex gap-3">
                <TemplateThumbnail template={template} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{template.name}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {template.page.sizePreset} · {template.page.orientation} · {template.page.dpi} DPI
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{formatTimestamp(template.updatedAt ?? template.createdAt)}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => applyTemplate(activePageId, template)}
                className="mt-3 w-full rounded-lg border border-cyan-500/60 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20"
              >
                Apply to current page
              </button>
            </div>
          ))}
        </div>
      )}
    </CollapsiblePanel>
  );
}
