import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// sw.js を偽の self・caches・fetch の上で動かす
function loadSw() {
  const handlers = {};
  const puts = [];
  const added = [];
  const cache = {
    addAll: async (list) => added.push(...list),
    put: async (...args) => puts.push(args),
  };
  const sandbox = {
    self: {
      addEventListener: (type, fn) => (handlers[type] = fn),
      skipWaiting: () => {},
      clients: { claim: () => {} },
      location: { origin: 'http://localhost' },
    },
    location: { origin: 'http://localhost' },
    caches: { open: async () => cache, keys: async () => [], match: async () => 'CACHED' },
    fetch: async () => ({ clone: () => 'CLONE' }),
    Request: class {
      constructor(url, init) {
        this.url = url;
        this.cache = init && init.cache;
      }
    },
    URL,
  };
  vm.runInNewContext(readFileSync('sw.js', 'utf8'), sandbox);
  return { handlers, puts, added };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('sw', () => {
  it('ページを開いて取れたら、index.html のキャッシュをその中身で入れ替える', async () => {
    const { handlers, puts } = loadSw();
    let res;
    handlers.fetch({
      request: { method: 'GET', mode: 'navigate', url: 'http://localhost/' },
      respondWith: (p) => (res = p),
    });
    await res;
    await flush();
    expect(puts).toEqual([['./index.html', 'CLONE']]);
  });

  it('入れるときは HTTP のキャッシュを使わずに取り直す', async () => {
    const { handlers, added } = loadSw();
    let done;
    handlers.install({ waitUntil: (p) => (done = p) });
    await done;
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((r) => r.cache === 'reload')).toBe(true);
    expect(added.map((r) => r.url)).toContain('./src/main.js');
  });
});
