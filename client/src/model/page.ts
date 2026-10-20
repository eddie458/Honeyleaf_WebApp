// Page geometry shared by the editor, the renderer and the flow engine.
// A page is A5 at 4 units per millimetre; the ruled grid is 7 mm.

export const PAGE_W = 594;
export const PAGE_H = 840;
export const GRID = 28;
export const ROWS = PAGE_H / GRID; // 30

export interface WritingArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** The first page of an entry leaves room for its date and title. */
export const DEFAULT_AREA: WritingArea = { top: 4 * GRID, right: 36, bottom: GRID, left: 76 };
/** Later pages of an entry start writing on the first ruled line. */
export const CONT_AREA: WritingArea = { top: 3 * GRID, right: 36, bottom: GRID, left: 76 };
