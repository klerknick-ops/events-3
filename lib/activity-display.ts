// Display helpers for activity entries (icons by action type).

export function activityIcon(action: string): string {
  if (action.startsWith("EVENT_CREATED")) return "✨";
  if (action.startsWith("STATUS")) return "🏷";
  if (action.startsWith("EVENT")) return "✏️";
  if (action.startsWith("SLOT")) return "🕑";
  if (action.startsWith("PRODUCT")) return "🍽";
  if (action.startsWith("ROOM")) return "🛏";
  if (action.startsWith("DAY")) return "📅";
  if (action.startsWith("TASK")) return "✓";
  if (action.startsWith("NOTE")) return "📝";
  if (action.startsWith("DOC")) return "📄";
  return "•";
}
