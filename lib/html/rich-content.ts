// Shared helpers for admin-authored rich HTML (blog posts, policies, …).
// Content is written by authenticated admins, so this is defence-in-depth rather
// than untrusted-input sanitisation: strip the handful of vectors that could hurt
// even a trusted author (pasted <script>, inline event handlers, javascript: URLs).

// Remove obviously dangerous constructs from an HTML string.
export function sanitizeRichHtml(html: string): string {
  if (!html) return '';
  return html
    // Drop <script>…</script> and <style>…</style> blocks entirely.
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    // Drop <iframe>/<object>/<embed> (not needed for blog content).
    .replace(/<\s*(iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(iframe|object|embed)[^>]*\/?>/gi, '')
    // Strip inline event handlers: on*="…" / on*='…' / on*=value.
    .replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '')
    // Neutralise javascript: in href/src.
    .replace(/(href|src)\s*=\s*"(\s*javascript:[^"]*)"/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*'(\s*javascript:[^']*)'/gi, "$1='#'");
}

// Turn a stored content value into display-ready, sanitised HTML.
// HTML (from the WYSIWYG editor) is used as-is; legacy plain text is split into
// paragraphs so old posts still render correctly.
export function renderRichContent(content: string | null | undefined): string {
  const body = (content ?? '').trim();
  if (!body) return '';
  const html = body.startsWith('<')
    ? body
    : body
        .split(/\n{2,}/)
        .map((para) => `<p>${para.split('\n').join('<br>')}</p>`)
        .join('');
  return sanitizeRichHtml(html);
}
