export interface ProjectMeta {
  id: string;
  name: string;
  /** The project's currently remembered file path, or null if it has never been saved/opened. */
  filePath: string | null;
}

export interface ProjectSlice {
  project: ProjectMeta;
}

export function createInitialProjectState(): ProjectMeta {
  return {
    id: crypto.randomUUID(),
    name: 'Untitled',
    filePath: null,
  };
}

export function createProjectSlice(): ProjectSlice {
  return {
    project: createInitialProjectState(),
  };
}
