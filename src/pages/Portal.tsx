import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { LazyMotion, domAnimation, motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useMusic } from "../music/MusicProvider";

type Phase = "idle" | "video" | "ready" | "leaving";

export default function PortalCarta() {
  const navigate = useNavigate();
  const music = useMusic();

  const [phase, setPhase] = useState<Phase>("idle");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  const VIDEO_SRC =
    "https://uqqrxkeevstxawzycyzc.supabase.co/storage/v1/object/public/fotos/video%202.0.mp4";

  // Timing
  const EXIT_FADE_MS = 850;
  const NAV_DELAY_MS = 650;

  // Click areas
const envelopeHit = useMemo(
    () =>
      ({
        top: "35.7%",
        left: "10%",
        width: "80%",
        height: "25%",
      }) as const,
    []
  );

  const finalHit = useMemo(
    () =>
      ({
        top: "48%",
        left: "48%",
        width: "25%",
        height: "15%",
        transform: "translate(-50%, -50%)",
      }) as const,
    []
  );

  // Configure video once
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    try {
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      v.controls = false;

      // ✅ importante: que cargue el primer frame
      v.load();
    } catch {
      // ignore
    }
  }, []);

  // ✅ Fuerza mostrar el PRIMER frame real del video (sin poster)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const freezeFirstFrame = async () => {
      try {
        // En algunos browsers, currentTime=0 no “pinta”.
        // 0.01 ayuda a forzar el frame sin saltar visualmente.
        v.pause();

        // Espera metadata para poder hacer seek
        if (!Number.isFinite(v.duration) || v.duration === 0) {
          // noop, igual intentamos en eventos
        }

        v.currentTime = 0.01;

        // Espera a que el seek aplique y luego pausa
        // (con esto el frame queda “dibujado”)
        await new Promise<void>((resolve) => {
          const done = () => {
            v.removeEventListener("seeked", done);
            resolve();
          };
          v.addEventListener("seeked", done, { once: true });
          // fallback: si seeked no dispara, igual resolve
          window.setTimeout(() => {
            v.removeEventListener("seeked", done);
            resolve();
          }, 250);
        });

        v.pause();
        setVideoReady(true);
      } catch {
        // si falla, igual marcamos ready cuando haya data
      }
    };

    const onLoadedData = () => {
      // ya hay data para pintar al menos un frame
      freezeFirstFrame();
    };

    const onLoadedMetadata = () => {
      // metadata listo, intentamos congelar
      freezeFirstFrame();
    };

    v.addEventListener("loadeddata", onLoadedData);
    v.addEventListener("loadedmetadata", onLoadedMetadata);

    // Intento inmediato por si ya estaba cacheado
    freezeFirstFrame();

    return () => {
      v.removeEventListener("loadeddata", onLoadedData);
      v.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, []);

  const startVideo = async () => {
    if (phase !== "idle") return;

    // Start music from click
    try {
      await music.start();
    } catch {
      // ignore
    }

    setPhase("video");

    requestAnimationFrame(async () => {
      const v = videoRef.current;
      if (!v) return;

      try {
        // ✅ vuelve al inicio real
        v.currentTime = 0;
        v.muted = true;
        v.playsInline = true;
        await v.play();
      } catch {
        window.setTimeout(async () => {
          try {
            await videoRef.current?.play();
          } catch {
            // ignore
          }
        }, 120);
      }
    });
  };

  const onVideoEnded = () => {
    const v = videoRef.current;
    if (!v) {
      setPhase("ready");
      return;
    }

    try {
      v.pause();
      // ✅ freeze en el último frame
      const safeEnd = Math.max(0, (v.duration || 0) - 0.04);
      if (Number.isFinite(safeEnd) && safeEnd > 0) v.currentTime = safeEnd;
    } catch {
      // ignore
    }

    setPhase("ready");
  };

  const goInvite = () => {
    if (phase === "leaving") return;

    setPhase("leaving");
    try {
      videoRef.current?.pause();
    } catch {
      // ignore
    }

    window.setTimeout(() => navigate("/invite"), NAV_DELAY_MS);
  };

  const isLeaving = phase === "leaving";
  const showFinalHit = phase === "ready";

  return (
    <LazyMotion features={domAnimation}>
      <style>{styles()}</style>

      <div className="portalRoot">
        {/* ✅ Solo VIDEO (sin poster, sin bg) */}
        <div className="videoBase">
          <video
            ref={videoRef}
            className="videoFull"
            src={VIDEO_SRC}
            playsInline
            muted
            preload="auto"
            controls={false}
            disablePictureInPicture
            controlsList="nodownload noplaybackrate noremoteplayback"
            onEnded={onVideoEnded}
          />
        </div>

        {/* (Opcional) si dura en mostrar el primer frame, dejamos un fade sutil */}
        <AnimatePresence>
          {!videoReady && (
            <motion.div
              className="loadingShade"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>

        {/* Hit inicial (solo idle) */}
        {phase === "idle" && (
          <button
            type="button"
            className="hit"
            style={envelopeHit as CSSProperties}
            onClick={startVideo}
            aria-label="Abrir invitación"
          />
        )}

        {/* Tap overlay durante reproducción (por si play se bloquea) */}
        {phase === "video" && (
          <button
            type="button"
            className="tapToPlay"
            aria-label="Reproducir video"
            onClick={() => {
              videoRef.current?.play().catch(() => {});
            }}
          />
        )}

        {/* Hit final */}
        <AnimatePresence>
          {showFinalHit && (
            <motion.button
              type="button"
              className="hitFinal"
              style={finalHit as CSSProperties}
              onClick={goInvite}
              aria-label="Ver más detalles"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            />
          )}
        </AnimatePresence>

        {/* Fade elegante al salir */}
        <AnimatePresence>
          {isLeaving && (
            <motion.div
              className="fadeElegant"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: EXIT_FADE_MS / 1000, ease: [0.2, 0.8, 0.2, 1] }}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>
      </div>
    </LazyMotion>
  );
}

const styles = () => `
*{ box-sizing:border-box; }
html,body{ height:100%; }
body{ margin:0; background:#000; }

.portalRoot{
  position:relative;
  width:100vw;
  min-height:100svh;
  overflow:hidden;
  background:#000;
}

.videoBase{
  position:fixed;
  inset:0;
  z-index: 10;
  background:#000;
  transform: translateZ(0);
}

.videoFull{
  width:100%;
  height:100%;
  display:block;
  object-fit: cover;
  image-rendering: auto;
  transform: translateZ(0);
  backface-visibility: hidden;
}

/* Shade mientras carga el primer frame */
.loadingShade{
  position:fixed;
  inset:0;
  z-index: 15;
  background: #000;
}

.hit{
  position:fixed;
  border:0;
  padding:0;
  background:transparent;
  cursor:pointer;
  z-index: 30;
}

.tapToPlay{
  position:fixed;
  inset:0;
  border:0;
  padding:0;
  background:transparent;
  cursor: default;
  z-index: 20;
}

.hitFinal{
  position:fixed;
  border:0;
  padding:0;
  background:transparent;
  cursor:pointer;
  z-index: 40;
}

.fadeElegant{
  position:fixed;
  inset:0;
  z-index: 60;
  pointer-events:none;
  background: rgba(0,0,0,.88);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
`;
