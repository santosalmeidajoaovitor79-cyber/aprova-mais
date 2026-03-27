const PREFIX = "aprova_study_topic_cache_";

export function readTopicCache(userId) {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(PREFIX + userId);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeTopicCache(userId, cache) {
  if (!userId) return;
  try {
    localStorage.setItem(PREFIX + userId, JSON.stringify(cache));
  } catch {
    /* quota / private mode */
  }
}
