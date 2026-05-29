export const READ_STATE_KEY = "handled_read_state_v1";
export const READ_STATE_EVENT = "handled-read-state-changed";

export type EmailReadState = "read" | "unread";
export type ReadStateMap = Record<string, EmailReadState>;

export function loadReadStateMap(): ReadStateMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(READ_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as ReadStateMap;
  } catch {
    return {};
  }
}

function saveReadStateMap(map: ReadStateMap): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(READ_STATE_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event(READ_STATE_EVENT));
  } catch {
    // quota — ignore
  }
}

export function setReadStateForIds(ids: string[], state: EmailReadState): void {
  if (!ids.length) return;
  const map = loadReadStateMap();
  for (const id of ids) {
    map[id] = state;
  }
  saveReadStateMap(map);
}

export function isUnread(id: string, map: ReadStateMap): boolean {
  return map[id] === "unread";
}
