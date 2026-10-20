// Everything swappable (fonts, textures, props, stickers, tapes, stamps…) is
// listed in JSON manifests under /library/manifests and loaded at runtime, so
// art can be replaced without touching code.

const cache = new Map<string, Promise<unknown>>();

/** Absolute URL of any file the app ships (icons…), honoring the base URL. */
export function publicUrl(path: string): string {
  return new URL(path, document.baseURI).toString();
}

/** Absolute URL of a file inside the library folder, honoring the base URL. */
export function libraryUrl(path: string): string {
  return new URL(`library/${path}`, document.baseURI).toString();
}

export function loadManifest<T>(name: string): Promise<T> {
  let pending = cache.get(name) as Promise<T> | undefined;
  if (!pending) {
    pending = fetch(libraryUrl(`manifests/${name}.json`), { credentials: 'same-origin' }).then((res) => {
      if (!res.ok) throw new Error(`Could not load the ${name} manifest (${res.status})`);
      return res.json() as Promise<T>;
    });
    cache.set(name, pending);
  }
  return pending;
}
