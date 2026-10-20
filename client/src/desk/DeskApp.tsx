import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AnimatePresence } from 'motion/react';
import { useBook } from '../data/bookStore';
import { useSaveSettings, useSettings, useTrash, type SessionUser } from '../data/queries';
import { useActiveEditor } from '../editor/activeEditor';
import { TextToolbar } from '../editor/Toolbar';
import { libraryUrl } from '../library/library';
import { useLibrary } from '../library/useLibrary';
import { Book } from '../journal/Book';
import { FRAME_H, SINGLE_W, SPREAD_W } from '../journal/JournalFrame';
import { pageAt } from '../journal/target';
import { t } from '../strings/en';
import { Toasts } from '../ui/Toasts';
import { toast } from '../ui/toastStore';
import { CalendarCard } from '../tools/CalendarCard';
import { addPhotosToPage, Camera } from '../tools/Camera';
import { Drawer } from '../tools/Drawer';
import { KeyRing } from '../tools/KeyRing';
import { lockNow, Padlock } from '../tools/Padlock';
import { PenCup } from '../tools/PenCup';
import { StickerBook } from '../tools/StickerBook';
import { WashiRolls } from '../tools/WashiRolls';
import { Wastebasket } from '../tools/Wastebasket';
import { DeskScene, type Camera as Cam, type DeskObjectSpec } from './DeskScene';
import { AutumnLeaves, CalendarFace, Steam } from './DeskLife';
import { InkLoader } from './InkLoader';
import { PencilCase } from './PencilCase';
import { PenTray } from './PenTray';
import { STAGE_H, STAGE_W, useLayoutMode, useStageScale, useTallStage } from './stage';
import { useDeskKeys } from './useDeskKeys';
import { useIdleLock } from './useIdleLock';
import { useJournalBoot } from './useJournalBoot';
import s from './DeskApp.module.css';

export type ToolId = 'pens' | 'washi' | 'stickers' | 'camera' | 'calendar' | 'drawer' | 'padlock' | 'keyring' | 'trash';

const SINGLE_STAGE = { w: 760, h: 1240 };
const MUGS = ['cocoa', 'coffee', 'tea'] as const;
const PLANT_STAGES = [0, 6, 16, 40, 90];

/** Where each tool opens on the wide desk (stage units). */
const PANEL_AT: Record<ToolId, { x: number; y: number }> = {
  pens: { x: 20, y: 250 },
  washi: { x: 30, y: 520 },
  stickers: { x: 1500, y: 330 },
  camera: { x: 1720, y: 300 },
  calendar: { x: 520, y: 40 },
  drawer: { x: 1660, y: 60 },
  padlock: { x: 560, y: 860 },
  keyring: { x: 550, y: 160 },
  trash: { x: 1680, y: 560 },
};

export function DeskApp({ user }: { user: SessionUser }) {
  const boot = useJournalBoot(user);
  const layout = useLayoutMode();
  const scene = useLibrary((st) => st.scenes[0]);
  const props = useLibrary((st) => st.props);
  const index = useBook((st) => st.index);
  const mode = useBook((st) => st.mode);
  const setMode = useBook((st) => st.setMode);
  const [tool, setTool] = useState<ToolId | null>(null);
  const settings = useSettings();
  const saveSettings = useSaveSettings();
  const trash = useTrash();
  const lockMinutes = settings.data?.lockMinutes ?? user.lockMinutes ?? 15;
  const close = useCallback(() => setTool(null), []);

  useIdleLock(lockMinutes, lockNow);
  useDeskKeys(close);
  useFileDrops();

  const pages = useMemo(() => index.reduce((n, e) => n + e.pageIds.length, 0), [index]);
  const mug = settings.data?.mug ?? 'cocoa';
  const lampOn = Boolean(settings.data?.lamp);
  const tall = useTallStage(SINGLE_STAGE.w, SINGLE_STAGE.h);
  const stage = layout === 'spread' ? { w: STAGE_W, h: STAGE_H } : tall;
  const camera = useCaretCamera(layout === 'single', stage);

  if (boot === 'error') return <InkLoader label={t.errors.network} />;
  if (boot === 'loading' || !scene) return <InkLoader label={t.app.loading} />;

  const open = (id: ToolId) => () => setTool((cur) => (cur === id ? null : id));
  const plantStage = PLANT_STAGES.filter((n) => pages >= n).length;
  const objects: Record<string, DeskObjectSpec> = {
    lamp: { label: lampOn ? t.desk.lampOn : t.desk.lampOff, pressed: lampOn, onActivate: () => saveSettings.mutate({ lamp: !lampOn }) },
    pencilCup: { label: t.desk.pencilCup, onActivate: open('pens'), pressed: tool === 'pens' },
    washi: { label: t.desk.washi, onActivate: open('washi'), pressed: tool === 'washi' },
    stickerBook: { label: t.desk.stickerBook, onActivate: open('stickers'), pressed: tool === 'stickers' },
    camera: { label: t.desk.camera, onActivate: open('camera'), pressed: tool === 'camera' },
    calendar: { label: t.desk.calendar, onActivate: open('calendar'), pressed: tool === 'calendar', overlay: <CalendarFace date={todayIso()} /> },
    drawer: { label: t.desk.drawer, onActivate: open('drawer'), pressed: tool === 'drawer' },
    padlock: { label: t.desk.padlock, onActivate: open('padlock'), pressed: tool === 'padlock' },
    wastebasket: {
      label: t.desk.wastebasket,
      onActivate: open('trash'),
      pressed: tool === 'trash',
      src: libraryUrl(trash.data && trash.data.length > 0 ? 'props/wastebasket.svg' : 'props/wastebasket-empty.svg'),
    },
    mug: {
      label: t.desk.mugOf[mug],
      onActivate: () => saveSettings.mutate({ mug: MUGS[(MUGS.indexOf(mug) + 1) % MUGS.length] }),
      src: libraryUrl(`props/mug-${mug}.svg`),
      overlay: <Steam />,
    },
    plant: { label: t.desk.plant, onActivate: () => toast(t.desk.plantEntries(pages), 'info'), src: libraryUrl(`props/plant-${plantStage}.svg`) },
    // Quiet for now: their tools arrive in later milestones.
    stamps: { label: t.desk.stamps },
    stickyNotes: { label: t.desk.stickyNotes },
    magnifier: { label: t.desk.magnifier },
    promptJar: { label: t.desk.promptJar },
    radio: { label: t.desk.radio },
    journals: { label: t.desk.journals },
  };
  if (user.role === 'admin') objects.keyring = { label: t.desk.keyring, onActivate: open('keyring'), pressed: tool === 'keyring' };

  const panelProps = (id: ToolId) => (layout === 'spread' ? { ...PANEL_AT[id], onClose: close } : { x: 20, y: 120, onClose: close });
  const panel = (() => {
    switch (tool) {
      case 'pens':
        return <PenCup key="pens" {...panelProps('pens')} />;
      case 'washi':
        return <WashiRolls key="washi" {...panelProps('washi')} />;
      case 'stickers':
        return <StickerBook key="stickers" {...panelProps('stickers')} />;
      case 'camera':
        return <Camera key="camera" {...panelProps('camera')} />;
      case 'calendar':
        return <CalendarCard key="calendar" {...panelProps('calendar')} />;
      case 'drawer':
        return <Drawer key="drawer" {...panelProps('drawer')} />;
      case 'padlock':
        return <Padlock key="padlock" {...panelProps('padlock')} />;
      case 'keyring':
        return <KeyRing key="keyring" {...panelProps('keyring')} myId={user.id} />;
      case 'trash':
        return <Wastebasket key="trash" {...panelProps('trash')} onRestored={() => void trash.refetch()} />;
      default:
        return null;
    }
  })();

  const journalW = layout === 'spread' ? SPREAD_W : SINGLE_W;
  const journalStyle: CSSProperties = {
    position: 'absolute',
    left: (stage.w - journalW) / 2,
    // Phones: the page centered in the room above the pencil case.
    top: layout === 'spread' ? (STAGE_H - FRAME_H) / 2 - 22 : Math.max(46, (stage.h - 150 - FRAME_H) / 2),
  };

  return (
    <>
      <DeskScene
        scene={scene}
        props={props}
        stage={stage}
        layout={layout === 'spread' ? scene.layout : {}}
        objects={objects}
        lampOn={lampOn}
        camera={camera}
        scatter={layout === 'spread' ? <AutumnLeaves /> : null}
        front={
          <>
            {layout === 'spread' ? (
              <PenTray x={1300} y={1212} mode={mode} onMode={setMode} />
            ) : (
              <PencilCase objects={objects} mode={mode} onMode={setMode} stage={tall} />
            )}
            <AnimatePresence>{panel}</AnimatePresence>
          </>
        }
      >
        <div style={journalStyle} className={s.journal} data-mode={mode}>
          <Book layout={layout} />
        </div>
      </DeskScene>
      <TextToolbar />
      <Toasts />
    </>
  );
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Photos dropped on a page or pasted while writing become instant prints. */
function useFileDrops(): void {
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    const drop = async (e: DragEvent) => {
      const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      e.preventDefault();
      const target = await pageAt(e.clientX, e.clientY);
      await addPhotosToPage(files, target ?? undefined);
    };
    const paste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      e.preventDefault();
      void addPhotosToPage(files);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    window.addEventListener('paste', paste, true);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
      window.removeEventListener('paste', paste, true);
    };
  }, []);
}

/**
 * On phones, writing zooms the page to a comfortable size and follows the
 * caret, keeping it above the on-screen keyboard.
 */
function useCaretCamera(enabled: boolean, stage: { w: number; h: number }): Cam | null {
  const editor = useActiveEditor((st) => st.editor);
  const fitted = useStageScale(stage.w, stage.h);
  const [cam, setCam] = useState<Cam | null>(null);
  useEffect(() => {
    if (!enabled || !editor) {
      setCam(null);
      return;
    }
    const comfortable = 16 / 22;
    if (fitted >= comfortable * 0.95) {
      setCam(null);
      return;
    }
    const follow = () => {
      if (editor.isDestroyed || !editor.isFocused) {
        setCam(null);
        return;
      }
      const rect = editor.view.coordsAtPos(editor.state.selection.head);
      const vv = window.visualViewport;
      const viewH = vv?.height ?? window.innerHeight;
      // Screen → stage at the current (fitted or zoomed) scale.
      const stageEl = editor.view.dom.closest('[data-stage]') as HTMLElement | null;
      if (!stageEl) return;
      const sr = stageEl.getBoundingClientRect();
      const k = stage.w / sr.width;
      const x = (rect.left - sr.left) * k;
      const y = (rect.top - sr.top) * k;
      const scale = comfortable;
      const halfW = window.innerWidth / scale / 2;
      const cx = Math.min(stage.w - halfW, Math.max(halfW, x));
      const cy = y + (viewH / scale) * 0.15;
      setCam((prev) => (prev && Math.abs(prev.x - cx) < 6 && Math.abs(prev.y - cy) < 6 ? prev : { scale, x: cx, y: cy }));
    };
    follow();
    editor.on('selectionUpdate', follow);
    editor.on('focus', follow);
    editor.on('blur', follow);
    window.visualViewport?.addEventListener('resize', follow);
    return () => {
      editor.off('selectionUpdate', follow);
      editor.off('focus', follow);
      editor.off('blur', follow);
      window.visualViewport?.removeEventListener('resize', follow);
    };
  }, [enabled, editor, fitted, stage.w, stage.h]);
  return cam;
}
