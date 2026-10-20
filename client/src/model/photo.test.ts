import { describe, expect, it } from 'vitest';
import { migratePage } from './migrations';
import { cleanCrop, clampCrop, DEFAULT_CROP, frameAspect, frameInsets, panCrop, photoLayout, photoSize, placePicture, zoomCropAt } from './photo';

const close = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('photo frames', () => {
  it('keeps the square instant print as it always was', () => {
    expect(photoSize('instant')).toEqual({ w: 236, h: 286 });
    const i = frameInsets('instant', 236, 286);
    // A square window, with the wide strip at the bottom.
    close((236 * (1 - i.left - i.right)) / (286 * (1 - i.top - i.bottom)), 1, 0.01);
    expect(i.bottom).toBeGreaterThan(i.top * 3);
  });

  it('shapes a classic print to the picture, with an even border', () => {
    const wide = photoSize('print', 3 / 2);
    expect(wide.w).toBe(280);
    const tall = photoSize('print', 2 / 3);
    expect(tall.h).toBe(280);
    const i = frameInsets('print', wide.w, wide.h);
    close(i.left * wide.w, i.top * wide.h);
    // The window has the picture's own shape, so nothing is cut at first.
    const { window: win } = photoLayout('print', 280, 280 / frameAspect('print', 3 / 2), 3 / 2, DEFAULT_CROP);
    close(win.w / win.h, 3 / 2, 1e-3);
    // No border at all: the frame is the picture.
    close(frameAspect('plain', 4 / 3), 4 / 3);
    expect(frameInsets('plain', 280, 210)).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
  });

  it('carries a resize over to another frame', () => {
    const bigger = photoSize('instant-wide', 1.5, 236 * 1.5 / 236);
    expect(bigger.w).toBe(Math.round(photoSize('instant-wide').w * 1.5));
  });
});

describe('arranging a photo in its frame', () => {
  it('covers the window, centered, at first', () => {
    // A 3:2 picture in a square window: it overhangs left and right equally.
    const p = placePicture(1, 1.5, DEFAULT_CROP);
    close(p.h, 1);
    close(p.w, 1.5);
    close(p.left, -0.25);
    close(p.top, 0);
  });

  it('slides with the pointer, but never past an edge', () => {
    const moved = panCrop(1, 1.5, DEFAULT_CROP, 0.1, 0);
    // The picture moved right, so the middle now shows a point further left.
    expect(moved.x).toBeLessThan(0.5);
    close(placePicture(1, 1.5, moved).left, -0.15);
    const far = panCrop(1, 1.5, DEFAULT_CROP, 5, 5);
    const p = placePicture(1, 1.5, far);
    close(p.left, 0);
    close(p.top, 0);
    // Up and down there is nothing to slide at zoom 1.
    close(far.y, 0.5);
  });

  it('zooms around the point you point at', () => {
    const z = zoomCropAt(1, 1, DEFAULT_CROP, 2, 0.25, 0.25);
    const p = placePicture(1, 1, z);
    // The picture point that was under (0.25, 0.25) is still there.
    close((0.25 - p.left) / p.w, 0.25);
    close((0.25 - p.top) / p.h, 0.25);
    expect(z.zoom).toBe(2);
    expect(zoomCropAt(1, 1, DEFAULT_CROP, 99).zoom).toBe(5);
    expect(zoomCropAt(1, 1, DEFAULT_CROP, 0.2).zoom).toBe(1);
  });

  it('pulls a crop back inside the picture', () => {
    const c = clampCrop(1, 1, { x: 0, y: 1, zoom: 2 });
    close(c.x, 0.25);
    close(c.y, 0.75);
  });

  it('cleans what it reads back', () => {
    expect(cleanCrop({ x: 2, y: -1, zoom: 9 })).toEqual({ x: 1, y: 0, zoom: 5 });
    expect(cleanCrop({ x: '0.5', y: 0.5, zoom: 1 })).toBeNull();
    const page = migratePage({
      v: 1,
      paper: { id: 'lined-cream' },
      decorations: [
        { id: 'a', type: 'photo', asset: 'user:x', frame: 'print', filter: 'none', ratio: 1.5, crop: { x: 0.3, y: 0.5, zoom: 2 }, x: 100, y: 100, w: 280, h: 190, rot: 0, z: 1, layer: 'front' },
        { id: 'b', type: 'photo', asset: 'user:y', frame: 'instant', filter: 'none', ratio: -4, crop: 'oops', x: 100, y: 100, w: 236, h: 286, rot: 0, z: 2, layer: 'front' },
      ],
    });
    const [a, b] = page.decorations;
    expect(a).toMatchObject({ ratio: 1.5, crop: { x: 0.3, y: 0.5, zoom: 2 } });
    expect(b).not.toHaveProperty('ratio');
    expect(b).not.toHaveProperty('crop');
  });
});
