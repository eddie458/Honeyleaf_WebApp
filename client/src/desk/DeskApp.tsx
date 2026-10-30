import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AnimatePresence } from 'motion/react';
import { useBook } from '../data/bookStore';
import { useSaveSettings, useSettings, useTrash, type SessionUser } from '../data/queries';
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
import { Radio } from '../tools/Radio';
import { StickerBook } from '../tools/StickerBook';
import { WashiRolls } from '../tools/WashiRolls';
import { Wastebasket } from '../tools/Wastebasket';
import { DeskScene, type DeskObjectSpec } from './DeskScene';
import { AutumnLeaves, CalendarFace, RadioGlow, Steam } from './DeskLife';
import { silence, useRadio, type Station } from './radio';
import { InkLoader } from './InkLoader';
import { PencilCase } from './PencilCase';
import { PenTray } from './PenTray';
import { STAGE_H, STAGE_W, useLayoutMode, useStageScale, useTallStage } from './stage';
import { useDeskKeys } from './useDeskKeys';
import { useIdleLock } from './useIdleLock';
import { useJournalBoot } from './useJournalBoot';
import { toggleMagnifier, useDeskZoom, useWritingZoom, useZoom } from './zoom';
import { ZoomControls } from './ZoomControls';
import s from './DeskApp.module.css';

export type ToolId = 'pens' | 'washi' | 'stickers' | 'camera' | 'calendar' | 'drawer' | 'padlock' | 'keyring' | 'trash' | 'radio';

const SINGLE_STAGE = { w: 760, h: 1240 };
const MUGS = ['cocoa', 'coffee', 'tea'] as const;
const PLANT_STAGES = [0, 6, 16, 40, 90];

/** Where each tool opens on the wide desk (stage units). */
const PANEL_AT: Record<ToolId, { x: number; y: number }> = {
  // High enough for the whole pen card (about 1120 tall) to fit on the desk.
  pens: { x: 20, y: 130 },
  washi: { x: 30, y: 520 },
  stickers: { x: 1500, y: 330 },
  camera: { x: 1720, y: 300 },
  calendar: { x: 520, y: 40 },
  drawer: { x: 1660, y: 60 },
  padlock: { x: 560, y: 860 },
  keyring: { x: 550, y: 160 },
  trash: { x: 1680, y: 560 },
  radio: { x: 1160, y: 230 },
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
  const playing = useRadio((st) => st.playing);
  // The radio remembers its station and volume, and goes quiet when you leave the desk.
  const radioSettings = settings.data?.radio as { station?: Station; volume?: number } | undefined;
  useEffect(() => {
    if (radioSettings && !useRadio.getState().playing) useRadio.getState().set({ station: radioSettings.station ?? 'piano', volume: radioSettings.volume ?? 0.6 });
  }, [radioSettings]);
  useEffect(() => () => silence(), []);
  // Red lines under misspelled words: every text field on the desk follows the drawer's setting.
  const spelling = settings.data?.spellcheck !== false;
  useEffect(() => {
    const root = document.documentElement;
    if (spelling) root.removeAttribute('spellcheck');
    else root.setAttribute('spellcheck', 'false');
    return () => root.removeAttribute('spellcheck');
  }, [spelling]);
  useDeskKeys(close);
  useFileDrops();

  const pages = useMemo(() => index.reduce((n, e) => n + e.pageIds.length, 0), [index]);
  const mug = settings.data?.mug ?? 'cocoa';
  // The lamp is on unless switched off; off means night falls on the desk.
  const lampOn = settings.data?.lamp !== false;
  const tall = useTallStage(SINGLE_STAGE.w, SINGLE_STAGE.h);
  const stage = layout === 'spread' ? { w: STAGE_W, h: STAGE_H } : tall;
  const fitted = useStageScale(stage.w, stage.h);
  const camera = useDeskZoom(stage, fitted);
  useWritingZoom(layout === 'single');
  const writingView = useZoom((st) => st.zoom?.writing === true);

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
    magnifier: { label: camera ? t.desk.magnifierDown : t.desk.magnifier, onActivate: toggleMagnifier, pressed: Boolean(camera) },
    radio: { label: playing ? t.radio.playing : t.desk.radio, onActivate: open('radio'), pressed: tool === 'radio', ...(playing ? { overlay: <RadioGlow /> } : {}) },
    plant: { label: t.desk.plant, onActivate: () => toast(t.desk.plantEntries(pages), 'info'), src: libraryUrl(`props/plant-${plantStage}.svg`) },
    // Quiet for now: their tools arrive in later milestones.
    stamps: { label: t.desk.stamps },
    stickyNotes: { label: t.desk.stickyNotes },
    promptJar: { label: t.desk.promptJar },
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
      case 'radio':
        return <Radio key="radio" {...panelProps('radio')} />;
      case 'trash':
        return <Wastebasket key="trash" {...panelProps('trash')} onRestored={() => void trash.refetch()} />;
      default:
        return null;
    }
  })();

  const journalW = layout === 'spread' ? SPREAD_W : SINGLE_W;
  // Phones: the page centered in the room above the pencil case.
  const journalTop = layout === 'spread' ? (STAGE_H - FRAME_H) / 2 - 22 : Math.max(46, (stage.h - 150 - FRAME_H) / 2);
  const journalStyle: CSSProperties = { position: 'absolute', left: (stage.w - journalW) / 2, top: journalTop };
  // ...with arrows under it to turn the page, when they fit above the case.
  const pageNav = layout === 'single' && stage.h - 140 - (journalTop + FRAME_H) >= 160;

  return (
    <>
      <DeskScene
        scene={scene}
        props={props}
        stage={stage}
        layout={layout === 'spread' ? scene.layout : {}}
        objects={objects}
        night={!lampOn}
        camera={camera}
        scatter={layout === 'spread' ? <AutumnLeaves /> : null}
        front={
          layout === 'spread' ? <PenTray x={1300} y={1212} mode={mode} onMode={setMode} /> : <PencilCase objects={objects} mode={mode} onMode={setMode} stage={tall} />
        }
        above={<AnimatePresence>{panel}</AnimatePresence>}
      >
        <div style={journalStyle} className={s.journal} data-mode={mode}>
          <Book layout={layout} pageNav={pageNav} />
        </div>
      </DeskScene>
      {camera && !writingView && <ZoomControls />}
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
