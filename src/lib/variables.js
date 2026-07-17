export function extractVariables(content) {
  if (!content) return [];
  const regex = /\{\{([A-Z0-9_]+)\}\}/g;
  const variables = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1];
    if (!variables.find(v => v.name === name)) {
      variables.push({ name, description: '' });
    }
  }
  return variables;
}

export function highlightVariablesInHtml(html, values) {
  if (!html) return '';
  let result = html;
  const regex = /\{\{([A-Z0-9_]+)\}\}/g;
  result = result.replace(regex, (match, name) => {
    const value = values?.[name];
    if (value !== undefined && value !== '') {
      return `<span class="var-filled">${value}</span>`;
    }
    return `<span class="var-pending">{{${name}}}</span>`;
  });
  return result;
}