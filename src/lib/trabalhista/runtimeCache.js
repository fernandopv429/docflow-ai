const buckets = new Map();

export function runtimeCacheKey(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export async function withRuntimeCache(namespace, key, loader, options = {}) {
  const { ttlMs = 10 * 60 * 1000, onHit } = options;
  if (!buckets.has(namespace)) buckets.set(namespace, new Map());
  const bucket = buckets.get(namespace);
  const cached = bucket.get(key);

  if (cached && Date.now() - cached.createdAt < ttlMs) {
    onHit?.();
    return cached.value;
  }

  const value = Promise.resolve().then(loader);
  bucket.set(key, { createdAt: Date.now(), value });
  try {
    return await value;
  } catch (error) {
    bucket.delete(key);
    throw error;
  }
}