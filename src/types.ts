export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

export interface NoteItem {
  id: string;
  title: string;
  body: string;
  checklist: TodoItem[];
  category: "today" | "upcoming" | "ideas" | "archive";
  color: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppStore {
  notes: NoteItem[];
  selectedNoteId: string | null;
}

export interface AppPreferences {
  launchAtLogin: boolean;
  minimizeToTrayOnClose: boolean;
}
