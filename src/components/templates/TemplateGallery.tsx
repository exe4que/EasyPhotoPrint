import { isSimpleModeCompatible, type EPPTemplate } from '@epp/layout-engine';
import { useState } from 'react';

import { getEppApi } from '../../lib/platform/contract.js';
import { useEPPStore } from '../../store/index.js';
import { ConfirmDialog } from '../ui/ConfirmDialog.js';
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

interface TemplateGalleryProps {
  templates: EPPTemplate[];
  isLoading: boolean;
  errorMessage: string | null;
  onReload: () => Promise<void> | void;
  bare?: boolean;
}

export function TemplateGallery({ templates, isLoading, errorMessage, onReload, bare = false }: TemplateGalleryProps) {
  const [pendingDelete, setPendingDelete] = useState<EPPTemplate | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const activePageId = useEPPStore((state) => state.ui.activePageId);
  const applyTemplate = useEPPStore((state) => state.applyTemplate);
  const setLayoutMode = useEPPStore((state) => state.setLayoutMode);

  const handleApply = (template: EPPTemplate) => {
    applyTemplate(activePageId, template);
    if (!isSimpleModeCompatible(template.rootNode)) {
      setLayoutMode('nested');
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await getEppApi().templates.delete(pendingDelete.id);
      setPendingDelete(null);
      await onReload();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not delete the template.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <CollapsiblePanel
      title="Template gallery"
      description="Browse saved layouts and apply one to the active page."
      defaultCollapsed={false}
      bare={bare}
      actions={
        <button
          type="button"
          onClick={() => void onReload()}
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

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleApply(template)}
                  className="flex-1 rounded-lg border border-cyan-500/60 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20"
                >
                  Apply to current page
                </button>
                <button
                  type="button"
                  aria-label={`Delete template ${template.name}`}
                  onClick={() => {
                    setDeleteError(null);
                    setPendingDelete(template);
                  }}
                  className="rounded-lg border border-rose-500/40 px-3 py-2 text-sm font-medium text-rose-200 hover:bg-rose-500/10"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete != null}
        title="Delete template?"
        description={pendingDelete ? `"${pendingDelete.name}" will be permanently deleted. This can't be undone.` : undefined}
        confirmLabel="Delete"
        destructive
        isSubmitting={isDeleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (isDeleting) {
            return;
          }
          setPendingDelete(null);
          setDeleteError(null);
        }}
      >
        {deleteError ? (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{deleteError}</div>
        ) : null}
      </ConfirmDialog>
    </CollapsiblePanel>
  );
}
