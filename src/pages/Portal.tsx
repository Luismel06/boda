import React, { useEffect, useMemo, useRef, useState } from "react";
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
  const BG_IMG = "/bg-portal.jpeg";
  const VIDEO_SRC =
    "https://uqqrxkeevstxawzycyzc.supabase.co/storage/v1/object/public/fotos/video-pantalla-completav2.mp4";

  // ⏱️ Timing
  const EXIT_FADE_MS = 850;
  const NAV_DELAY_MS = 650;

  // 1) Área clickeable del sobre en la imagen de fondo
  const envelopeHit = useMemo(() => {
    return {
      top: "35.7%",
      left: "10%",
      width: "83%",
      height: "35%",
    } as const;
  }, []);

  // 2) Área clickeable EN EL ÚLTIMO FRAME del video (tu ya lo ajustaste)
  const finalHit = useMemo(() => {
    return {
      top: "50%",
      left: "50%",
      width: "25%",
      height: "20%",
    } as const;
  }, []);

  // Preload del video
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
    } catch {}
  }, []);

  const startVideo = async () => {
    if (phase !== "idle") return;

    await music.start();

    setPhase("video");

    requestAnimationFrame(async () => {
      const v = videoRef.current;
      if (!v) return;

      try {
        v.currentTime = 0;
        v.muted = true;
        v.playsInline = true;
        await v.play();
      } catch {
        window.setTimeout(async () => {
          try {
            await videoRef.current?.play();
          } catch {}
        }, 120);
      }
    });
  };

  // ✅ Termina el video => freeze frame + solo dejamos el hitFinal
  const onVideoEnded = () => {
    try {
      videoRef.current?.pause(); // deja el último frame visible
    } catch {}
    setPhase("ready");
  };

  // ✅ Segundo click => transición + navigate
  const goInvite = () => {
    if (phase === "leaving") return;

    setPhase("leaving");

    try {
      videoRef.current?.pause();
    } catch {}

    window.setTimeout(() => navigate("/invite"), NAV_DELAY_MS);
  };

  const isLeaving = phase === "leaving";
  const showVideoLayer = phase === "video" || phase === "ready" || phase === "leaving";
  const showFinalHit = phase === "ready";
  const lockAllClicks = phase === "ready"; // ✅ aquí bloqueamos todo menos hitFinal

  return (
    <LazyMotion features={domAnimation}>
      <style>{styles(BG_IMG, EXIT_FADE_MS)}</style>

      <div className="portalRoot">
        <div className="bg" aria-hidden="true" />

        {phase === "idle" && (
          <button
            type="button"
            className="hit"
            style={envelopeHit as React.CSSProperties}
            onClick={startVideo}
            aria-label="Abrir invitación"
          />
        )}

        <AnimatePresence>
          {showVideoLayer && (
            <motion.div
              className="videoOverlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <motion.div
                className="videoInner"
                initial={false}
                animate={{
                  scale: isLeaving ? 1.03 : 1,
                  filter: isLeaving ? "blur(1px)" : "blur(0px)",
                }}
                transition={{ duration: EXIT_FADE_MS / 1000, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <video
                  ref={videoRef}
                  className="videoFull"
                  src={VIDEO_SRC}
                  playsInline
                  muted
                  autoPlay={phase === "video"} // solo autoplay cuando arranca
                  preload="auto"
                  controls={false}
                  crossOrigin="anonymous"
                  onEnded={onVideoEnded}
                  // ✅ En ready NO permitimos play/replay por click
                  onClick={phase === "video" ? () => videoRef.current?.play() : undefined}
                />
              </motion.div>

              {/* ✅ Bloquea TODO click/touch en ready */}
              {lockAllClicks && (
                <button
                  type="button"
                  className="blockAll"
                  aria-label="Bloqueo de interacción"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                />
              )}

              {/* ✅ El ÚNICO click permitido */}
              {showFinalHit && (
                <button
                  type="button"
                  className="hitFinal"
                  style={finalHit as React.CSSProperties}
                  onClick={goInvite}
                  aria-label="Ver más detalles"
                />
              )}

              <motion.div
                className="fadeElegant"
                initial={{ opacity: 0 }}
                animate={{ opacity: isLeaving ? 1 : 0 }}
                transition={{ duration: EXIT_FADE_MS / 1000, ease: [0.2, 0.8, 0.2, 1] }}
                aria-hidden="true"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LazyMotion>
  );
}

const styles = (bgImg: string,) => `
*{ box-sizing:border-box; }
html,body{ height:100%; }
body{ margin:0; background:#000; }

.portalRoot{
  position:relative;
  width:100vw;
  min-height:100svh;
  overflow:hidden;
}

/* Fondo */
.bg{
  position:fixed;
  inset:0;
  background-image:url("${bgImg}");
  background-repeat:no-repeat;
  background-position:center;
  background-size:cover;
}

/* Click del sobre (en la imagen) */
.hit{
  position:fixed;
  border:0;
  padding:0;
  background:transparent;
  cursor:pointer;
  z-index: 10;
}

/* Video fullscreen */
.videoOverlay{
  position:fixed;
  inset:0;
  z-index: 20;
  background:#000;
}

.videoInner{
  position:absolute;
  inset:0;
  will-change: transform, filter;
}

.videoFull{
  width:100%;
  height:100%;
  display:block;
  object-fit: cover;
}

/* ✅ Bloqueador: tapa todo (ready) */
.blockAll{
  position:absolute;
  inset:0;
  border:0;
  padding:0;
  background:transparent;
  cursor: default;
  z-index: 24; /* debajo del hitFinal */
}

/* ✅ Hit area del último frame (único click) */
.hitFinal{
  position:absolute;
  border:0;
  padding:0;
  background:transparent;
  cursor:pointer;
  z-index: 25;
  /* debug:
  outline: 2px dashed rgba(0,255,180,.9);
  background: rgba(0,255,180,.10);
  */
}

/* Fade elegante al salir */
.fadeElegant{
  position:absolute;
  inset:0;
  pointer-events:none;
  background: rgba(0,0,0,.88);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
`;