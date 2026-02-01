import React, { createContext, useContext, useMemo, useRef, useState } from "react";

type MusicContextValue = {
  isReady: boolean;
  isPlaying: boolean;
  start: () => Promise<void>;
  stop: () => void;
  setVolume: (v: number) => void;
};

const MusicContext = createContext<MusicContextValue | null>(null);

const AUDIO_URL =
  "https://uqqrxkeevstxawzycyzc.supabase.co/storage/v1/object/public/audio/boda.mp3";

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Crea el audio 1 sola vez (persistente entre rutas)
  const ensureAudio = () => {
    if (audioRef.current) return audioRef.current;

    const a = new Audio(AUDIO_URL);
    a.loop = true;
    a.preload = "auto";
    a.volume = 0.6;
    a.crossOrigin = "anonymous"; // buena práctica cuando viene de otro dominio

    // Opcional: marcar listo cuando tenga suficiente data para empezar
    const onCanPlay = () => setIsReady(true);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    a.addEventListener("canplay", onCanPlay);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);

    // Guardamos las refs de limpieza en el mismo objeto (hack simple)
    // (si prefieres, lo hacemos con useEffect + cleanup, pero esto funciona)
    (a as any).__cleanup = () => {
      a.removeEventListener("canplay", onCanPlay);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };

    audioRef.current = a;
    return a;
  };

  const value = useMemo<MusicContextValue>(() => {
    return {
      isReady,
      isPlaying,
      start: async () => {
        const a = ensureAudio();

        // Por si viene “dormido” en iOS, fuerza a cargar antes
        try {
          a.load();
        } catch {
          // ignore
        }

        try {
          await a.play(); // ✅ Debe llamarse desde un click real (Portal / Invite)
          // isPlaying se setea por el listener "play"
        } catch {
          // Si el navegador bloquea autoplay, no rompemos nada.
          setIsPlaying(false);
        }
      },
      stop: () => {
        const a = audioRef.current;
        if (!a) return;
        a.pause();
        // isPlaying se setea por el listener "pause"
      },
      setVolume: (v: number) => {
        const a = ensureAudio();
        a.volume = Math.max(0, Math.min(1, v));
      },
    };
  }, [isReady, isPlaying]);

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used within MusicProvider");
  return ctx;
}