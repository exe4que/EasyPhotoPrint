// @spec OPENSPEC.md §3.1, §3.3 — save current page structure as a reusable template (overwrite in place or save as new)
import { useState } from 'react';

import type { EPPTemplate } from '@epp/layout-engine';

import { getEppApi } from '../../lib/ipc-client.js';
import { useEPPStore } from '../../store/index.js';
import { ConfirmDialog } from '../ui/ConfirmDialog.js';
import { CollapsiblePanel } from '../ui/CollapsiblePanel.js';

type ConfirmMode = 'save' | 'saveAs' | null;

export function SaveTemplateDialog({
  templates,
  onSaved,
}: {
  templates: EPPTemplate[];
  onSaved: () => Promise<void> | void;
}) {
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>(null);
  const [saveAsName, setSaveAsName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const activePageId = useEPPStore((state) => state.ui.activePageId);
  const activePage = useEPPStore(
    (state) => state.document.pages.find((page) => page.id === activePageId) ?? state.document.pages[0],
  );
  const exportTemplate = useEPPStore((state) => state.exportTemplate);
  const linkPageToTemplate = useEPPStore((state) => state.linkPageToTemplate);

  const linkedTemplate = activePage.templateRef
    ? (templates.find((template) => template.id === activePage.templateRef) ?? null)
    : null;

  const closeConfirm = () => {
    if (isSaving) {
      return;
    }
    setConfirmMode(null);
    setErrorMessage(null);
  };

  const handleSave = async () => {
    if (!linkedTemplate) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const template = exportTemplate(activePageId);
      await getEppApi().templates.save({ ...template, id: linkedTemplate.id, name: linkedTemplate.name });
      setConfirmMode(null);
      await onSaved();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save the template.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAs = async () => {
    const normalizedName = saveAsName.trim();
    if (normalizedName === '') {
      setErrorMessage('Template name cannot be empty.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const template = exportTemplate(activePageId);
      await getEppApi().templates.save({ ...template, name: normalizedName });
      linkPageToTemplate(activePageId, template.id);
      setConfirmMode(null);
      setSaveAsName('');
      await onSaved();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save the template.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <CollapsiblePanel
        title="Save template"
        description="Store the current page structure without its image assignments."
        defaultCollapsed={true}
      >
        <div className="flex gap-2">
          {linkedTemplate ? (
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setConfirmMode('save');
              }}
              className="flex-1 rounded-lg border border-cyan-500/60 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20"
            >
              Save
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              setSaveAsName('');
              setConfirmMode('saveAs');
            }}
            className="flex-1 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:border-slate-600"
          >
            Save as…
          </button>
        </div>
      </CollapsiblePanel>

      <ConfirmDialog
        open={confirmMode === 'save'}
        title="Overwrite template?"
        description={
          linkedTemplate
            ? `This replaces "${linkedTemplate.name}" with the current page structure. Image assignments aren't included, and any other page using this template will be flagged out of sync.`
            : undefined
        }
        confirmLabel="Overwrite"
        isSubmitting={isSaving}
        onConfirm={() => void handleSave()}
        onCancel={closeConfirm}
      >
        {errorMessage ? (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{errorMessage}</div>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmMode === 'saveAs'}
        title="Save as new template"
        description="Store the current page structure as a new, separate template."
        confirmLabel="Save"
        confirmDisabled={saveAsName.trim() === ''}
        isSubmitting={isSaving}
        onConfirm={() => void handleSaveAs()}
        onCancel={closeConfirm}
      >
        <input
          type="text"
          autoFocus
          value={saveAsName}
          onChange={(event) => setSaveAsName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void handleSaveAs();
            }
          }}
          placeholder="Grid 2x3 Vacaciones"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />
        {errorMessage ? (
          <div className="mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{errorMessage}</div>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
