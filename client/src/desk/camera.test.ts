import { describe, expect, it } from 'vitest';
import { flickOf, slowed, STOPPED, stageTransform, type Touch } from './camera';

const stage = { w: 760, h: 1600 };

describe('where the desk goes for a zoom', () => {
  it('leaves the whole desk to the stylesheet', () => {
    expect(stageTransform(null, stage, 0.5)).toBe('');
  });

  it('puts the point it looks at in the middle of the window', () => {
    // Looking at the middle of the stage: no need to move it, only to scale it.
    expect(stageTransform({ level: 2, x: 380, y: 800 }, stage, 0.5)).toBe('translate(0px, 0px) scale(1)');
    // 100 stage units right and 200 down of the middle, seen at twice the fitted size.
    expect(stageTransform({ level: 2, x: 480, y: 1000 }, stage, 0.5)).toBe('translate(-100px, -200px) scale(1)');
  });
});

const drag = (points: [t: number, y: number][]): Touch[] => points.map(([t, y]) => ({ t, x: 100, y }));

describe('a flick', () => {
  it('is how fast the finger was going at the end', () => {
    expect(flickOf(drag([[0, 500], [40, 460], [80, 420]]), 90)).toEqual({ x: 0, y: -1 });
  });

  it('ignores how the drag began', () => {
    const v = flickOf(drag([[0, 900], [400, 500], [460, 470], [520, 440]]), 530);
    expect(v?.y).toBeCloseTo(-0.5);
  });

  it('is not a slow drag', () => {
    expect(flickOf(drag([[0, 500], [40, 496], [80, 492]]), 90)).toBeNull();
  });

  it('is not a finger that stopped before it lifted', () => {
    expect(flickOf(drag([[0, 500], [40, 460], [80, 420]]), 200)).toBeNull();
  });

  it('is not a tap', () => {
    expect(flickOf([], 10)).toBeNull();
    expect(flickOf(drag([[0, 500]]), 10)).toBeNull();
  });

  it('never sends the page flying', () => {
    const v = flickOf(drag([[0, 2000], [10, 1000]]), 12);
    expect(Math.hypot(v!.x, v!.y)).toBeCloseTo(4);
  });
});

describe('a glide', () => {
  it('slows smoothly, however the frames fall', () => {
    const once = slowed({ x: 0, y: 2 }, 32);
    const twice = slowed(slowed({ x: 0, y: 2 }, 16), 16);
    expect(once.y).toBeLessThan(2);
    expect(twice.y).toBeCloseTo(once.y);
  });

  it('comes to a stop in about a second or two', () => {
    let v = { x: 0, y: 4 };
    let ms = 0;
    while (Math.hypot(v.x, v.y) > STOPPED) {
      v = slowed(v, 16);
      ms += 16;
    }
    expect(ms).toBeGreaterThan(1000);
    expect(ms).toBeLessThan(2500);
  });
});
