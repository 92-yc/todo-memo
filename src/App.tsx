import { useEffect, useMemo, useState } from "react";
import type { AppStore, NoteItem } from "./types";

const palette = [
  "#f5e2d0",
  "#f8eec7",
  "#dfeecf",
  "#d8ecf2",
  "#eadcf6",
  "#f6d8dd"
];

const categoryLabels: Record<NoteItem["category"], string> = {
  today: "今天",
  upcoming: "计划中",
  ideas: "灵感",
  archive: "已归档"
};

const initialStore: AppStore = {
  selectedNoteId: "welcome-note",
  notes: [
    {
      id: "welcome-note",
      title: "今天的安排",
      body: "像苹果备忘录一样写想法，再把真正要执行的事情拆成待办。",
      category: "today",
      color: "#f5e2d0",
      pinned: true,
      createdAt: "2026-04-08T08:00:00.000Z",
      updatedAt: "2026-04-08T08:00:00.000Z",
      checklist: [
        { id: "todo-a", text: "整理本周重点任务", done: false },
        { id: "todo-b", text: "下班前回顾已完成事项", done: true }
      ]
    },
    {
      id: "idea-note",
      title: "产品灵感",
      body: "支持便签颜色、搜索、导入导出，以及右侧的完成度统计。",
      category: "ideas",
      color: "#d8ecf2",
      pinned: false,
      createdAt: "2026-04-07T11:20:00.000Z",
      updatedAt: "2026-04-08T06:30:00.000Z",
      checklist: [
        { id: "todo-c", text: "加一个置顶功能", done: true },
        { id: "todo-d", text: "给重要便签设置暖色背景", done: false }
      ]
    }
  ]
};

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function sortNotes(notes: NoteItem[]) {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return Number(b.pinned) - Number(a.pinned);
    }

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function App() {
  const [store, setStore] = useState<AppStore>(initialStore);
  const [search, setSearch] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [statusText, setStatusText] = useState("本地自动保存已开启");

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const saved = await window.todoNotesApi?.loadStore();
      if (!cancelled) {
        setStore(saved ?? initialStore);
      }
      if (!cancelled) {
        setIsLoaded(true);
      }
    }

    hydrate().catch(() => {
      if (!cancelled) {
        setIsLoaded(true);
        setStatusText("读取本地数据失败，已使用默认示例");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const timer = window.setTimeout(() => {
      window.todoNotesApi
        ?.saveStore(store)
        .then(() => setStatusText("已自动保存到本地"))
        .catch(() => setStatusText("自动保存失败，请尝试导出备份"));
    }, 260);

    return () => window.clearTimeout(timer);
  }, [store, isLoaded]);

  const filteredNotes = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const source = sortNotes(store.notes);

    if (!keyword) {
      return source;
    }

    return source.filter((note) => {
      const haystack = `${note.title} ${note.body} ${note.checklist
        .map((item) => item.text)
        .join(" ")}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [search, store.notes]);

  const activeNote =
    store.notes.find((note) => note.id === store.selectedNoteId) ??
    filteredNotes[0] ??
    null;

  const completedCount = activeNote?.checklist.filter((item) => item.done).length ?? 0;
  const totalCount = activeNote?.checklist.length ?? 0;
  const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  function updateStore(updater: (current: AppStore) => AppStore) {
    setStore((current) => updater(current));
  }

  function selectNote(noteId: string) {
    updateStore((current) => ({
      ...current,
      selectedNoteId: noteId
    }));
  }

  function createNote() {
    const note: NoteItem = {
      id: createId("note"),
      title: "未命名便签",
      body: "",
      checklist: [{ id: createId("task"), text: "新待办", done: false }],
      category: "today",
      color: palette[Math.floor(Math.random() * palette.length)],
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    updateStore((current) => ({
      notes: [note, ...current.notes],
      selectedNoteId: note.id
    }));
  }

  function deleteNote(noteId: string) {
    updateStore((current) => {
      const notes = current.notes.filter((note) => note.id !== noteId);
      return {
        notes,
        selectedNoteId: current.selectedNoteId === noteId ? notes[0]?.id ?? null : current.selectedNoteId
      };
    });
  }

  function patchNote(noteId: string, updater: (note: NoteItem) => NoteItem) {
    updateStore((current) => ({
      ...current,
      notes: current.notes.map((note) =>
        note.id === noteId
          ? {
              ...updater(note),
              updatedAt: new Date().toISOString()
            }
          : note
      )
    }));
  }

  async function exportBackup() {
    const result = await window.todoNotesApi?.exportBackup(store);
    if (result?.ok) {
      setStatusText(`备份已导出到 ${result.filePath}`);
    }
  }

  async function importBackup() {
    const result = await window.todoNotesApi?.importBackup();
    if (result?.ok && result.payload) {
      setStore(result.payload);
      setStatusText("备份已导入");
    }
  }

  if (!isLoaded) {
    return (
      <div className="loading-shell">
        <div className="loading-card">
          <p className="eyebrow">暖笺待办</p>
          <h2>正在读取本地便签...</h2>
          <p>稍等一下，马上恢复你的内容。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <div>
            <p className="eyebrow">Windows 便签待办</p>
            <h1>Local Todo Notes</h1>
          </div>
          <button className="primary-btn" onClick={createNote}>
            新建便签
          </button>
        </div>

        <label className="search-box">
          <span>搜索</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="标题、正文或待办内容"
          />
        </label>

        <div className="note-list">
          {filteredNotes.map((note) => {
            const doneCount = note.checklist.filter((item) => item.done).length;
            return (
              <button
                key={note.id}
                className={`note-card ${note.id === activeNote?.id ? "active" : ""}`}
                style={{ background: note.color }}
                onClick={() => selectNote(note.id)}
              >
                <div className="note-card-top">
                  <strong>{note.title || "未命名便签"}</strong>
                  {note.pinned ? <span className="pill">置顶</span> : null}
                </div>
                <p>{note.body || "这里可以写会议记录、想法，或者今天要做的事。"}</p>
                <div className="note-meta">
                  <span>{categoryLabels[note.category]}</span>
                  <span>
                    {doneCount}/{note.checklist.length} 已完成
                  </span>
                </div>
              </button>
            );
          })}

          {filteredNotes.length === 0 ? (
            <div className="empty-card">
              <strong>没有找到匹配内容</strong>
              <p>换个关键词，或者直接新建一张便签。</p>
            </div>
          ) : null}
        </div>
      </aside>

      <main className="editor-panel">
        {activeNote ? (
          <>
            <div className="editor-toolbar">
              <div>
                <p className="eyebrow">最后编辑于 {formatTime(activeNote.updatedAt)}</p>
                <input
                  className="title-input"
                  value={activeNote.title}
                  onChange={(event) =>
                    patchNote(activeNote.id, (note) => ({
                      ...note,
                      title: event.target.value
                    }))
                  }
                  placeholder="便签标题"
                />
              </div>

              <div className="toolbar-actions">
                <select
                  value={activeNote.category}
                  onChange={(event) =>
                    patchNote(activeNote.id, (note) => ({
                      ...note,
                      category: event.target.value as NoteItem["category"]
                    }))
                  }
                >
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                <button
                  className="ghost-btn"
                  onClick={() =>
                    patchNote(activeNote.id, (note) => ({
                      ...note,
                      pinned: !note.pinned
                    }))
                  }
                >
                  {activeNote.pinned ? "取消置顶" : "置顶"}
                </button>

                <button className="ghost-btn" onClick={() => deleteNote(activeNote.id)}>
                  删除
                </button>
              </div>
            </div>

            <section className="editor-grid">
              <div className="note-editor">
                <textarea
                  value={activeNote.body}
                  onChange={(event) =>
                    patchNote(activeNote.id, (note) => ({
                      ...note,
                      body: event.target.value
                    }))
                  }
                  placeholder="像苹果备忘录一样自由记录内容..."
                />

                <div className="color-row">
                  {palette.map((color) => (
                    <button
                      key={color}
                      className={`color-dot ${activeNote.color === color ? "selected" : ""}`}
                      style={{ background: color }}
                      onClick={() =>
                        patchNote(activeNote.id, (note) => ({
                          ...note,
                          color
                        }))
                      }
                      aria-label={`切换颜色 ${color}`}
                    />
                  ))}
                </div>
              </div>

              <div className="task-panel">
                <div className="task-panel-header">
                  <div>
                    <p className="eyebrow">任务清单</p>
                    <h2>{progress}% 已完成</h2>
                  </div>
                  <button
                    className="primary-btn secondary"
                    onClick={() =>
                      patchNote(activeNote.id, (note) => ({
                        ...note,
                        checklist: [
                          ...note.checklist,
                          { id: createId("task"), text: "新的待办事项", done: false }
                        ]
                      }))
                    }
                  >
                    添加待办
                  </button>
                </div>

                <div className="progress-track">
                  <div className="progress-bar" style={{ width: `${progress}%` }} />
                </div>

                <div className="task-list">
                  {activeNote.checklist.map((item) => (
                    <label key={item.id} className="task-item">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() =>
                          patchNote(activeNote.id, (note) => ({
                            ...note,
                            checklist: note.checklist.map((entry) =>
                              entry.id === item.id ? { ...entry, done: !entry.done } : entry
                            )
                          }))
                        }
                      />
                      <input
                        className={`task-input ${item.done ? "done" : ""}`}
                        value={item.text}
                        onChange={(event) =>
                          patchNote(activeNote.id, (note) => ({
                            ...note,
                            checklist: note.checklist.map((entry) =>
                              entry.id === item.id ? { ...entry, text: event.target.value } : entry
                            )
                          }))
                        }
                      />
                      <button
                        className="icon-btn"
                        onClick={() =>
                          patchNote(activeNote.id, (note) => ({
                            ...note,
                            checklist: note.checklist.filter((entry) => entry.id !== item.id)
                          }))
                        }
                      >
                        ×
                      </button>
                    </label>
                  ))}
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="blank-state">
            <h2>先创建第一张便签</h2>
            <p>你可以把灵感、任务和随手记录放在一起，再用右侧清单逐个勾掉。</p>
            <button className="primary-btn" onClick={createNote}>
              创建便签
            </button>
          </section>
        )}
      </main>

      <aside className="inspector">
        <div className="inspector-card">
          <p className="eyebrow">当前状态</p>
          <h3>{statusText}</h3>
        </div>

        <div className="inspector-card">
          <p className="eyebrow">总览</p>
          <ul className="stats-list">
            <li>
              <strong>{store.notes.length}</strong>
              <span>便签数量</span>
            </li>
            <li>
              <strong>
                {store.notes.reduce((sum, note) => sum + note.checklist.length, 0)}
              </strong>
              <span>待办总数</span>
            </li>
            <li>
              <strong>
                {store.notes.reduce(
                  (sum, note) => sum + note.checklist.filter((item) => item.done).length,
                  0
                )}
              </strong>
              <span>已完成</span>
            </li>
          </ul>
        </div>

        <div className="inspector-card">
          <p className="eyebrow">数据管理</p>
          <button className="ghost-btn wide" onClick={exportBackup}>
            导出备份
          </button>
          <button className="ghost-btn wide" onClick={importBackup}>
            导入备份
          </button>
        </div>

        <div className="inspector-card">
          <p className="eyebrow">使用建议</p>
          <p className="helper-text">
            左边用来快速切换便签，中间像记事本一样写内容，右边专门追踪待办完成情况。
          </p>
        </div>
      </aside>
    </div>
  );
}

export default App;

