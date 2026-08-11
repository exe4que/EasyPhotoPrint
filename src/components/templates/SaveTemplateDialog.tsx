import { forwardRef, useImperativeHandle, useState } from 'react';

import type { EPPTemplate } from '@epp/layout-engine';

import { getEppApi } from '../../lib/platform/contract.js';
import { useEPPStore } from '../../store/index.js';
import { ConfirmDialog } from '../ui/ConfirmDialog.js';

type ConfirmMode = 'save' | 'saveAs' | null;

/** Imperative handle so the shared toolbar button (rendered in `App.tsx`) can trigger the
 * save/save-as flow without duplicating the `linkedTemplate`/overwrite-vs-prompt logic here. */
export interface SaveTemplateDialogHandle {
  openSave: () => void;
  openSaveAs: () => void;
}

export const SaveTemplateDialog = forwardRef<
  SaveTemplateDialogHandle,
  { templates: EPPTemplate[]; onSaved: () => Promise<void> | void }
>(function SaveTemplateDialog({ templates, onSaved }, ref) {
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

  const openSaveAs = () => {
    setErrorMessage(null);
    setSaveAsName('');
    setConfirmMode('saveAs');
  };

  const triggerSave = () => {
    // No linked template to overwrite -- the same fallback the old panel's UI achieved by
    // simply not showing a "Save" button when there was nothing to overwrite.
    if (!linkedTemplate) {
      openSaveAs();
      return;
    }
    setErrorMessage(null);
    setConfirmMode('save');
  };

  useImperativeHandle(ref, () => ({ openSave: triggerSave, openSaveAs }));

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
});
