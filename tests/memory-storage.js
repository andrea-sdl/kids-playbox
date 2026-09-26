// A stand-in for localStorage so tests run in Node.
export function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    raw: data,
  };
}

// Storage that throws on every call, like Safari private mode used to.
export function brokenStorage() {
  const fail = () => {
    throw new Error('storage disabled');
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}
