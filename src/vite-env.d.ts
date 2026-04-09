/// <reference types="vite/client" />

import type { AppStore } from "./types";

interface TodoNotesApi {
  loadStore: () => Promise<AppStore | null>;
  saveStore: (payload: AppStore) => Promise<{ ok: boolean }>;
  exportBackup: (
    payload: AppStore
  ) => Promise<{ ok: boolean; canceled?: boolean; filePath?: string }>;
  importBackup: () => Promise<{
    ok: boolean;
    canceled?: boolean;
    payload?: AppStore;
  }>;
}

declare global {
  interface Window {
    todoNotesApi?: TodoNotesApi;
  }
}

export {};
