import { useCallback, useEffect, useState } from 'react';

import type { EPPTemplate } from '@epp/layout-engine';

import { getEppApi } from '../lib/platform/contract.js';

export function useTemplateLibrary() {
  const [templates, setTemplates] = useState<EPPTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { templates, isLoading, errorMessage, reload };
}
