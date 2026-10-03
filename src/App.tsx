import { useState, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import { ScreenType, MemoryPage, ScrapbookItem } from './types';
import { INITIAL_PAGES } from './data/initialMemories';
import { AlbumScreen } from './components/AlbumScreen';
import { EditorScreen } from './components/EditorScreen';
import { fetchPages, createPage, savePageWithItems, updatePageWithItems } from './lib/memoriesService';
import type { PageWithItems } from './lib/memoriesService';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000';
type SyncStatus = 'loading' | 'synced' | 'error';

// Position of items is stored as percentages of the canvas/page (0-100).
// Legacy rows stored raw pixels on the editor canvas, so convert them once.
const EDITOR_CANVAS_WIDTH = 596;
const EDITOR_CANVAS_HEIGHT = 750;

function roundPct(v: number): number {
  return Math.round(v * 10) / 10;
}

function toItemInsert(item: ScrapbookItem) {
  return {
    type: item.type as string,
    url: item.imageUrl || item.videoUrl || null,
    caption: item.caption || null,
    rotation: item.rotation ?? 0,
    x: item.x ?? 0,
    y: item.y ?? 0,
    properties: { pct: true },
  };
}

function rowsToMemoryPages(data: PageWithItems[]): MemoryPage[] {
  return data.map((p) => ({
    id: p.id,
    type: p.page_type === 'photo_caption' ? 'photo_caption' : 'story',
    title: p.title || undefined,
    narrative: p.narrative || undefined,
    fontFamily: (p.font_family as MemoryPage['fontFamily']) || 'serif',
    spotifyEmbedUrl: p.spotify_url || undefined,
    items: (p.scrapbook_items || []).map((item) => {
      const isPct = (item.properties as any)?.pct === true;
      return {
        id: item.id,
        type: item.type as ScrapbookItem['type'],
        imageUrl: item.url || undefined,
        videoUrl: item.type === 'video' ? item.url || undefined : undefined,
        caption: item.caption || undefined,
        rotation: item.rotation || 0,
        x: isPct ? item.x : roundPct((item.x || 0) / EDITOR_CANVAS_WIDTH * 100),
        y: isPct ? item.y : roundPct((item.y || 0) / EDITOR_CANVAS_HEIGHT * 100),
        ...(item.properties as Record<string, unknown>),
      };
    }),
  }));
}

async function persistNewPageToSupabase(newPage: MemoryPage | null) {
  if (!newPage) return;
  if (newPage.type === 'photo_caption') {
    const items = (newPage.items || []).map(toItemInsert);
    return savePageWithItems(
      {
        user_id: DEFAULT_USER_ID,
        page_type: 'photo_caption',
        title: null,
        narrative: null,
        font_family: newPage.fontFamily || 'serif',
        spotify_url: null,
      },
      items,
    );
  }
  return createPage({
    user_id: DEFAULT_USER_ID,
    page_type: 'story',
    title: newPage.title || null,
    narrative: newPage.narrative || null,
    font_family: newPage.fontFamily || 'serif',
    spotify_url: newPage.spotifyEmbedUrl || null,
  });
}

async function persistEditToSupabase(pageId: string, page: MemoryPage) {
  const items = (page.items || []).map(toItemInsert);
  const isCollage = page.type === 'photo_caption';
  return updatePageWithItems(
    pageId,
    {
      user_id: DEFAULT_USER_ID,
      page_type: isCollage ? 'photo_caption' : 'story',
      title: isCollage ? null : page.title || null,
      narrative: isCollage ? null : page.narrative || null,
      font_family: page.fontFamily || 'serif',
      spotify_url: isCollage ? null : page.spotifyEmbedUrl || null,
    },
    items,
  );
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('album');
  const [transitionDirection, setTransitionDirection] = useState<'slide_up' | 'push_back'>('slide_up');
  const [pages, setPages] = useState<MemoryPage[]>(INITIAL_PAGES);
  const [editingPage, setEditingPage] = useState<MemoryPage | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading');

  useEffect(() => {
    async function loadPages() {
      try {
        const { data, error } = await fetchPages(DEFAULT_USER_ID);

        if (error) throw error;

        if (data && data.length > 0) {
          const dbPages = rowsToMemoryPages(data as unknown as PageWithItems[]);

          setPages([
            INITIAL_PAGES[0],
            INITIAL_PAGES[1],
            INITIAL_PAGES[2],
            ...dbPages,
            INITIAL_PAGES[3],
            INITIAL_PAGES[4],
          ]);
          setSyncStatus('synced');
        } else {
          setSyncStatus('synced');
        }
      } catch (err) {
        console.error('[Album] Error al conectar con Supabase:', err);
        setSyncStatus('error');
      } finally {
        setIsLoading(false);
      }
    }

    loadPages();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Navigation handlers
  const handleOpenEditor = (page?: MemoryPage) => {
    setEditingPage(page ?? null);
    setTransitionDirection('slide_up');
    setCurrentScreen('editor');
  };

  const handleCancelEditor = () => {
    setEditingPage(null);
    setTransitionDirection('push_back');
    setCurrentScreen('album');
  };

  const handleSaveEditor = async (newPage: MemoryPage) => {
    // Editing an existing page: update the same DB row, keep its id + type.
    if (editingPage) {
      const updated: MemoryPage = {
        ...newPage,
        id: editingPage.id,
        type: editingPage.type,
      };

      setPages((prev) => prev.map((p) => (p.id === editingPage.id ? updated : p)));
      setEditingPage(null);
      setTransitionDirection('push_back');
      setCurrentScreen('album');

      try {
        const { error } = await persistEditToSupabase(editingPage.id, updated);
        if (error) throw error;
        showToast('Cambios guardados y sincronizados.');
      } catch (err) {
        console.error('[Album] Sync error:', err);
        showToast('Cambios guardados. Error al sincronizar.');
      }
      return;
    }

    // New memory: split into a collage page (photos) + a text page.
    const hasItems = newPage.items && newPage.items.length > 0;

    const collagePage: MemoryPage | null = hasItems
      ? {
          ...newPage,
          id: `${newPage.id}-collage`,
          type: 'photo_caption',
          title: undefined,
          narrative: undefined,
          spotifyEmbedUrl: undefined,
        }
      : null;

    const textPage: MemoryPage = {
      ...newPage,
      id: `${newPage.id}-text`,
      type: 'story',
      items: [],
    };

    setPages((prevPages) => {
      const insertIndex = Math.max(0, prevPages.length - 2);
      const updated = [...prevPages];

      if (collagePage) {
        updated.splice(insertIndex, 0, collagePage);
      }
      updated.splice(insertIndex + (collagePage ? 1 : 0), 0, textPage);

      return updated;
    });

    setTransitionDirection('push_back');
    setCurrentScreen('album');

    try {
      const [r1, r2] = await Promise.all([
        persistNewPageToSupabase(collagePage),
        persistNewPageToSupabase(textPage),
      ]);
      const err = r1?.error || r2?.error;
      if (err) throw err;
      showToast('¡Guardado y sincronizado!');
    } catch (err) {
      console.error('[Album] Sync error:', err);
      showToast('Guardado localmente. Error al sincronizar.');
    }
  };

  // Motion variants for slide_up & push_back
  const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
  const screenVariants: Variants = {
    initial: (direction: 'slide_up' | 'push_back') => {
      if (direction === 'slide_up') {
        return { y: '100%', opacity: 0.8, scale: 0.98 };
      } else {
        return { scale: 0.92, opacity: 0.4, y: 0 };
      }
    },
    animate: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: EASE,
      },
    },
    exit: (direction: 'slide_up' | 'push_back') => {
      if (direction === 'slide_up') {
        return {
          scale: 0.94,
          opacity: 0.6,
          transition: { duration: 0.35, ease: EASE },
        };
      } else {
        return {
          y: '100%',
          opacity: 0.8,
          transition: { duration: 0.35, ease: EASE },
        };
      }
    },
  };

  return (
    <div className="w-full min-h-screen bg-[#4a3b2c] overflow-hidden relative font-serif">
      {/* Loading State */}
      {isLoading && (
        <div className="w-full min-h-screen flex flex-col items-center justify-center text-[#d4af37]">
          <div className="w-12 h-12 border-4 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin mb-4"></div>
          <p className="font-serif-display text-lg tracking-widest">Cargando álbum...</p>
        </div>
      )}

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#002434] text-[#fcf9f2] px-6 py-3 rounded-full shadow-2xl border border-[#cba72f]/40 flex items-center gap-3 font-sans-ui text-sm"
          >
            <div className="w-2 h-2 rounded-full bg-[#cba72f] animate-pulse"></div>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {!isLoading && (
        <AnimatePresence mode="wait" custom={transitionDirection}>
          {currentScreen === 'album' ? (
            <motion.div
              key="album-screen"
              custom={transitionDirection}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full min-h-screen"
            >
              <AlbumScreen
                pages={pages}
                onNavigateToEditor={handleOpenEditor}
                onEditPage={handleOpenEditor}
              />
            </motion.div>
          ) : (
            <motion.div
              key="editor-screen"
              custom={transitionDirection}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full min-h-screen"
            >
              <EditorScreen
                onCancel={handleCancelEditor}
                onSave={(newPage) => void handleSaveEditor(newPage)}
                initialPage={editingPage}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Sync status indicator */}
      {!isLoading && syncStatus === 'error' && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 text-[#fcf9f2] px-4 py-1.5 rounded-full text-xs font-sans-ui shadow-xl">
          Sin conexión con la nube. Se muestran páginas locales.
        </div>
      )}
    </div>
  );
}
