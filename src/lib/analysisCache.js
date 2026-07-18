// Caches AI analysis results per template so switching between the
// editor and the generation screen doesn't trigger a paid re-analysis.
const key = (templateId) => `docflow_analysis_${templateId}`;

export function saveAnalysis(templateId, values, urls) {
  if (!templateId) return;
  try {
    sessionStorage.setItem(key(templateId), JSON.stringify({ values: values || {}, urls: urls || [] }));
  } catch {
    // storage full/unavailable — cache is best-effort
  }
}

export function loadAnalysis(templateId) {
  if (!templateId) return null;
  try {
    const raw = sessionStorage.getItem(key(templateId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}