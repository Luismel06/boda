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

  // Assets
  // ✅ Ya NO usamos BG como fondo, lo usamos como POSTER del video (primer frame visual)
  const POSTER_IMG =
    "https://uqqrxkeevstxawzycyzc.supabase.co/storage/v1/object/public/fotos/Inicio-def.png";

  const VIDEO_SRC =
    "https://uqqrxkeevstxawzycyzc.supabase.co/storage/v1/object/public/fotos/VIDEO%201111.mp4";

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
        left: "50%",
        width: "25%",
        height: "15%",
        transform: "translate(-50%, -50%)",
      }) as const,
    []
  );

  // Configure video element once
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      v.controls = false;
    } catch {
      // ignore
    }
  }, []);

  const startVideo = async () => {
    if (phase !== "idle") return;

    // Start music from a real click
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
        // ✅ fuerza empezar desde el inicio
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

    // ✅ “Freeze” en el último frame:
    // 1) pausa
    // 2) aseguramos que se quede al final (por si el browser regresa a 0)
    try {
      v.pause();
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

  // ✅ En tu versión anterior tenías esto:
  // const lockAllClicks = phase === "ready";
  // pero eso bloqueaba también el hitFinal (porque cubre toda la pantalla).
  // Aquí NO bloqueamos toda la pantalla; solo controlamos por fase.

  return (
    <LazyMotion features={domAnimation}>
      <style>{styles()}</style>

      <div className="portalRoot">
        {/* ✅ VIDEO siempre presente (sin fondo detrás) */}
        <div className="videoBase">
          <video
            ref={videoRef}
            className="videoFull"
            src={VIDEO_SRC}
            poster={POSTER_IMG}
            playsInline
            muted
            preload="auto"
            controls={false}
            disablePictureInPicture
            controlsList="nodownload noplaybackrate noremoteplayback"
            // ✅ Para que al terminar no se quede “en negro” en algunos browsers:
            // mantenemos la pantalla y luego fijamos currentTime en onVideoEnded.
            onEnded={onVideoEnded}
          />
        </div>

        {/* ✅ Hit inicial (solo cuando está idle) */}
        {phase === "idle" && (
          <button
            type="button"
            className="hit"
            style={envelopeHit as CSSProperties}
            onClick={startVideo}
            aria-label="Abrir invitación"
          />
        )}

        {/* ✅ Cuando está en fase video, permitimos click para “reintentar play” si el browser lo bloqueó */}
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

        {/* ✅ Hit final */}
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

/* Video siempre full screen */
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

  /* evita “softness” por render raro */
  image-rendering: auto;
  transform: translateZ(0);
  backface-visibility: hidden;
}

/* Hit inicial */
.hit{
  position:fixed;
  border:0;
  padding:0;
  background:transparent;
  cursor:pointer;
  z-index: 30;
}

/* Tap overlay durante reproducción (por si el play se bloquea) */
.tapToPlay{
  position:fixed;
  inset:0;
  border:0;
  padding:0;
  background:transparent;
  cursor: default;
  z-index: 20;
}

/* Hit final */
.hitFinal{
  position:fixed;
  border:0;
  padding:0;
  background:transparent;
  cursor:pointer;
  z-index: 40;
}

/* Fade elegante al salir */
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
