const prefix = 'ea';

export function customId(action, ...parts) {
  return [prefix, action, ...parts.filter(Boolean)].join(':').slice(0, 100);
}

export function parseCustomId(id) {
  const [scope, action, ...parts] = id.split(':');

  if (scope !== prefix || !action) {
    return null;
  }

  return { action, parts };
}
