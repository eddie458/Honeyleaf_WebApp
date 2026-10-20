import { libraryUrl, loadManifest } from './library';

interface TextureEntry {
  file: string;
  size: [number, number];
  scale: number;
  kind: 'lightmap' | 'overlay' | 'mask';
}

interface TextureManifest {
  textures: Record<string, TextureEntry>;
}

/**
 * Publishes each texture as CSS custom properties on :root:
 *   --tex-<id>       url(...)
 *   --tex-<id>-w/-h  tile size in stage units (pixels × scale)
 * Stylesheets only ever refer to these variables.
 */
export async function applyTextures(): Promise<void> {
  const manifest = await loadManifest<TextureManifest>('textures');
  const style = document.documentElement.style;
  const preload: Promise<unknown>[] = [];
  for (const [id, tex] of Object.entries(manifest.textures)) {
    const url = libraryUrl(tex.file);
    style.setProperty(`--tex-${id}`, `url("${url}")`);
    style.setProperty(`--tex-${id}-w`, `${tex.size[0] * tex.scale}px`);
    style.setProperty(`--tex-${id}-h`, `${tex.size[1] * tex.scale}px`);
    const img = new Image();
    img.src = url;
    preload.push(img.decode().catch(() => undefined));
  }
  await Promise.all(preload);
}
