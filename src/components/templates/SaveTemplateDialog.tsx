// @spec OPENSPEC.md §3.1, §3.3 — save current page structure as a reusable template
import { useState } from 'react';

import { getEppApi } from '../../lib/ipc-client.js';
import { useEPPStore } from '../../store/index.js';
import { CollapsiblePanel } from '../ui/CollapsiblePanel.js';

export function SaveTemplateDialog({ onSaved }: { onSaved: () => Promise<void> | void }) {
  const [templateName, setTemplateName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const activePageId = useEPPStore((state) => state.ui.activePageId);
  const exportTemplate = useEPPStore((state) => state.exportTemplate);

  const handleSave = async () => {
    const normalizedName = templateName.trim();
    if (normalizedName === '') {
      setErrorMessage('Template name cannot be empty.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const template = exportTemplate(activePageId);
      await getEppApi().templates.save({
        ...template,
        name: normalizedName,
      });
      setTemplateName('');
      await onSaved();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save the template.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <CollapsiblePanel
      title="Save template"
      description="Store the current page structure without its image assignments."
      defaultCollapsed={true}
    >
      <div className="space-y-3">
        <input
          type="text"
          value={templateName}
          onChange={(event) => setTemplateName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void handleSave();
            }
          }}
          placeholder="Grid 2x3 Vacaciones"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />
        {errorMessage ? (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="w-full rounded-lg border border-cyan-500/60 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Save current page as template'}
        </button>
      </div>
    </CollapsiblePanel>
  );
}
