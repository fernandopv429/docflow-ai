// Resolve blocos condicionais {{#if TOKEN}}...{{/if}} (com {{else}} opcional)
// para que nunca apareçam como texto cru para o usuário. As flags decidem qual
// ramo permanece. Usado pelo montador da peça (montarPeca.js).
export function applyConditionals(html, flags = {}) {
  if (!html) return html;
  const IF_RE = /\{\{#if\s+([A-Z0-9_]+)\}\}/;
  let out = html;
  let guard = 0;
  while (IF_RE.test(out) && guard < 500) {
    guard += 1;
    out = out.replace(/\{\{#if\s+([A-Z0-9_]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/, (m, key, whenTrue, whenFalse) => {
      if (/\{\{#if\s+[A-Z0-9_]+\}\}/.test(whenTrue)) return m; // aguarda a próxima passada (aninhado)
      return flags[key] ? whenTrue : (whenFalse || '');
    });
  }
  return out;
}
