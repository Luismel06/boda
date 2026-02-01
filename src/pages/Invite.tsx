import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";

/** =======================
 *  Supabase
 *  ======================= */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** =======================
 *  Types
 *  ======================= */
type RSVPInsert = {
  first_name: string;
  last_name: string;
  phone: string;
  guests_count: number;
  kids: boolean;
  kids_count: number;
};

type Toast = { type: "ok" | "err"; msg: string } | null;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatDateDMY(dateISO: string) {
  const d = new Date(dateISO);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** =======================
 *  Tiny helpers
 *  ======================= */
function useIntersectionActive(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? "");
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0];
        if (vis?.target?.id) setActive(vis.target.id);
      },
      { threshold: [0.25, 0.45, 0.6] }
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids.join("|")]);

  return active;
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** =======================
 *  Calendar helpers (.ics + Google Calendar)
 *  ======================= */
function toICSDateUTC(d: Date) {
  const iso = d.toISOString();
  const y = iso.slice(0, 4);
  const m = iso.slice(5, 7);
  const day = iso.slice(8, 10);
  const hh = iso.slice(11, 13);
  const mm = iso.slice(14, 16);
  const ss = iso.slice(17, 19);
  return `${y}${m}${day}T${hh}${mm}${ss}Z`;
}
function icsEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\r?\n/g, "\\n");
}
function downloadICS(opts: {
  title: string;
  description: string;
  location: string;
  startISO: string;
  durationHours?: number;
  fileName?: string;
}) {
  const start = new Date(opts.startISO);
  const end = new Date(start.getTime() + (opts.durationHours ?? 4) * 60 * 60 * 1000);

  const uid = `${Date.now()}-${Math.random().toString(16).slice(2)}@invite`;
  const dtstamp = toICSDateUTC(new Date());
  const dtstart = toICSDateUTC(start);
  const dtend = toICSDateUTC(end);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Invite//Wedding//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${icsEscape(opts.title)}`,
    `DESCRIPTION:${icsEscape(opts.description)}`,
    `LOCATION:${icsEscape(opts.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const ics = lines.join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = opts.fileName ?? "evento.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function openGoogleCalendar(opts: {
  title: string;
  description: string;
  location: string;
  startISO: string;
  durationHours?: number;
}) {
  const start = new Date(opts.startISO);
  const end = new Date(start.getTime() + (opts.durationHours ?? 4) * 60 * 60 * 1000);
  const dates = `${toICSDateUTC(start)}/${toICSDateUTC(end)}`;

  const url =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(opts.title)}` +
    `&dates=${encodeURIComponent(dates)}` +
    `&details=${encodeURIComponent(opts.description)}` +
    `&location=${encodeURIComponent(opts.location)}`;

  window.open(url, "_blank");
}

/** =======================
 *  Type reveal (letters)
 *  ======================= */
function TypeReveal({
  text,
  className,
  delay = 0,
  stagger = 0.02,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const reduce = useReducedMotion();
  const letters = useMemo(() => text.split(""), [text]);

  if (reduce) return <span className={className}>{text}</span>;

  return (
    <motion.span
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ amount: 0.75, once: true }}
      variants={{
        hidden: {},
        show: { transition: { delayChildren: delay, staggerChildren: stagger } },
      }}
      style={{ display: "inline-block" }}
    >
      {letters.map((ch, i) => (
        <motion.span
          key={i}
          style={{ display: "inline-block", whiteSpace: ch === " " ? "pre" : "normal" }}
          variants={{
            hidden: { opacity: 0, y: 10, filter: "blur(10px)" },
            show: { opacity: 1, y: 0, filter: "blur(0px)" },
          }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
        >
          {ch === " " ? "\u00A0" : ch}
        </motion.span>
      ))}
    </motion.span>
  );
}

/** =======================
 *  Clean Section (NEW)
 *  - Sin marcos “duros”
 *  - Separación por línea (no cajas apiladas)
 *  - Look tipo Canva
 *  ======================= */
function SheetSection({
  id,
  children,
  bgImage,
  watermark,
}: {
  id: string;
  children: React.ReactNode;
  bgImage?: string;
  watermark?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 92%", "start 55%"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 18, 0]);
  const opacity = useTransform(scrollYProgress, [0, 1], [reduce ? 1 : 0, 1]);

  const yS = useSpring(y, { stiffness: 160, damping: 22, mass: 0.9 });
  const oS = useSpring(opacity, { stiffness: 130, damping: 20 });

  return (
    <motion.section
      id={id}
      ref={ref as any}
      className="sec"
      style={{
        y: yS,
        opacity: oS,
        ["--secBg" as any]: bgImage ? `url(${bgImage})` : "none",
      }}
      data-hasbg={bgImage ? "1" : "0"}
      initial={false}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="secInner">
        {watermark ? (
          <div className="watermark" aria-hidden="true">
            {watermark}
          </div>
        ) : null}
        {children}
      </div>
    </motion.section>
  );
}

/** =======================
 *  Coverflow Carousel + lightbox
 *  (Mantengo tu lógica/funcionalidad)
 *  ======================= */
function CoverflowCarousel({
  images,
  onOpen,
}: {
  images: string[];
  onOpen: (src: string, i: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const items = Array.from(el.querySelectorAll<HTMLElement>("[data-slide]"));

        let bestIdx = 0;
        let bestDist = Infinity;

        items.forEach((item, idx) => {
          const r = item.getBoundingClientRect();
          const c = r.left + r.width / 2;
          const dist = Math.abs(centerX - c);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = idx;
          }
        });

        setActive(bestIdx);
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const go = (dir: -1 | 1) => {
    const el = wrapRef.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>("[data-slide]"));
    const next = Math.max(0, Math.min(items.length - 1, active + dir));
    items[next]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const jumpTo = (idx: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>("[data-slide]"));
    items[idx]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  return (
    <div className="cfw">
      <div className="cfwTopRow">
        <div className="cfwTitle">Galería</div>
        <div className="cfwCount">
          Foto <strong>{active + 1}</strong> / {images.length}
        </div>
      </div>

      <div className="cfwShell">
        <button className="cfwArrow left" onClick={() => go(-1)} aria-label="Anterior" type="button">
          ‹
        </button>

        <div className="cfwTrack" ref={wrapRef}>
          {images.map((src, idx) => (
            <button
              key={`${src}-${idx}`}
              data-slide
              className={`cfwSlide ${idx === active ? "isActive" : ""}`}
              onClick={() => onOpen(src, idx)}
              aria-label={`Abrir foto ${idx + 1}`}
              type="button"
            >
              <div className="cfwCard">
                <img src={src} alt={`Foto ${idx + 1}`} loading="lazy" />
                <div className="cfwGlass" aria-hidden="true" />
              </div>
            </button>
          ))}
        </div>

        <button className="cfwArrow right" onClick={() => go(1)} aria-label="Siguiente" type="button">
          ›
        </button>
      </div>

      <div className="cfwThumbs" aria-label="Miniaturas">
        {images.map((src, i) => (
          <button
            key={src + i}
            className={`cfwThumb ${i === active ? "on" : ""}`}
            onClick={() => jumpTo(i)}
            type="button"
            aria-label={`Ir a foto ${i + 1}`}
          >
            <img src={src} alt="" loading="lazy" />
          </button>
        ))}
      </div>

      <div className="cfwHint">Toca una foto para verla en pantalla completa</div>
    </div>
  );
}

/** =======================
 *  Confetti (soft)
 *  ======================= */
function ConfettiBurst({ show }: { show: boolean }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(() => {
    const arr = Array.from({ length: 26 }).map((_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 280,
      y: 230 + Math.random() * 220,
      r: (Math.random() - 0.5) * 260,
      s: 0.65 + Math.random() * 0.85,
      d: 0.65 + Math.random() * 0.55,
      o: 0.45 + Math.random() * 0.35,
    }));
    return arr;
  }, [show]);

  if (reduce) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="confetti"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-hidden="true"
        >
          {pieces.map((p) => (
            <motion.span
              key={p.id}
              className="confettiPiece"
              initial={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.8 }}
              animate={{ opacity: p.o, x: p.x, y: p.y, rotate: p.r, scale: p.s }}
              transition={{ duration: p.d, ease: [0.2, 0.8, 0.2, 1] }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** =======================
 *  Divider line (solo línea)
 *  ======================= */
function SectionDivider() {
  return (
    <motion.div
      className="sectionSepWrap"
      initial={{ opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      aria-hidden="true"
    >
      <motion.div
        className="sectionSep"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
      />
    </motion.div>
  );
}

/** =======================
 *  Audio reactive background (WebAudio)
 *  (lo mantengo, pero adaptado a tema blanco/azul)
 *  ======================= */
function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function avgRange(data: Uint8Array, from: number, to: number) {
  const a = Math.max(0, from);
  const b = Math.min(data.length - 1, to);
  let sum = 0;
  let count = 0;
  for (let i = a; i <= b; i++) {
    sum += data[i];
    count++;
  }
  return count ? sum / count / 255 : 0;
}

function useAudioReactiveCSS(audioRef: React.RefObject<HTMLAudioElement | null>, enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef<number | null>(null);

  const setVars = (pulse: number, bass: number, mid: number, treble: number) => {
    const root = document.documentElement;
    root.style.setProperty("--pulse", String(clamp01(pulse)));
    root.style.setProperty("--bass", String(clamp01(bass)));
    root.style.setProperty("--mid", String(clamp01(mid)));
    root.style.setProperty("--treble", String(clamp01(treble)));
  };

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setVars(0, 0, 0, 0);
  };

  const ensure = () => {
    const a = audioRef.current;
    if (!a) return;

    if (ctxRef.current && analyserRef.current && sourceRef.current && dataRef.current) return;

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.82;

    const source = ctx.createMediaElementSource(a);
    source.connect(analyser);
    analyser.connect(ctx.destination);

    const data = new Uint8Array(analyser.frequencyBinCount);

    ctxRef.current = ctx;
    analyserRef.current = analyser;
    sourceRef.current = source;
    dataRef.current = data;
  };

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    ensure();

    const ctx = ctxRef.current;
    const analyser = analyserRef.current;
    const data = dataRef.current;

    if (!ctx || !analyser || !data) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    let sp = 0;
    let sb = 0;
    let sm = 0;
    let st = 0;

    const tick = () => {
      analyser.getByteFrequencyData(data);

      const bass = avgRange(data, 0, 22);
      const mid = avgRange(data, 23, 90);
      const treble = avgRange(data, 91, 180);

      const pulseRaw = clamp01(bass * 0.85 + mid * 0.25);

      sp = sp + (pulseRaw - sp) * 0.08;
      sb = sb + (bass - sb) * 0.08;
      sm = sm + (mid - sm) * 0.06;
      st = st + (treble - st) * 0.05;

      setVars(sp, sb, sm, st);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => stop();
  }, [enabled]);
}

/** =======================
 *  Page
 *  ======================= */
function RippleCanvas({ enabled }: { enabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const ripplesRef = useRef<Array<{
    x: number;
    y: number;
    r: number;
    vr: number;
    vy: number;
    a: number;
    life: number;
    hue: number;
    w: number;
  }>>([]);

  const lastSpawnRef = useRef(0);
  const lastPulseRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  const getVar = (name: string) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  const resize = () => {
    const c = canvasRef.current;
    if (!c) return;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = window.innerWidth;
    const h = window.innerHeight;

    sizeRef.current = { w, h, dpr };
    c.width = Math.floor(w * dpr);
    c.height = Math.floor(h * dpr);
    c.style.width = w + "px";
    c.style.height = h + "px";

    const ctx = c.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const spawnRipple = (strength: number, bass: number, treble: number) => {
    const { w, h } = sizeRef.current;
    if (!w || !h) return;

    // “Golpes” nacen abajo, con una leve variación lateral
    const x = w * (0.10 + Math.random() * 0.80);

let y;
if (Math.random() < 0.70) {
  // mayoría: mitad inferior (se ve elegante)
  y = h * (0.45 + Math.random() * 0.50);
} else {
  // algunos: cualquier parte
  y = h * (0.08 + Math.random() * 0.84);
}

    const s = Math.max(0.12, Math.min(1, strength));
    const speedUp = 120 + bass * 420;            // sube más con bass
    const speedRad = 160 + s * 520;              // expande más con pulse

    // Tono azul dinámico (sin salirte de la paleta)
    const hue = 208 + treble * 18; // ~azules

    ripplesRef.current.push({
      x,
      y,
      r: 0,
      vr: speedRad,            // px/s
      vy: speedUp,             // px/s
      a: 0.25 + s * 0.55,      // alpha base (MUY visible)
      life: 1.25 + s * 0.55,   // segundos
      hue,
      w: 1.2 + s * 2.2,        // grosor del anillo
    });

    // A veces mete un segundo “golpe” más pequeño para dramatismo
    if (s > 0.35 && Math.random() < 0.55) {
      ripplesRef.current.push({
        x: x + (Math.random() - 0.5) * 120,
        y: y + (Math.random() - 0.5) * 30,
        r: 0,
        vr: speedRad * 0.78,
        vy: speedUp * 1.06,
        a: 0.18 + s * 0.40,
        life: 1.05 + s * 0.45,
        hue: hue + 6,
        w: 1.0 + s * 1.8,
      });
    }
  };

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;

    let lastT = performance.now();

    const tick = (t: number) => {
      const dt = Math.min(0.033, (t - lastT) / 1000); // clamp ~30fps step
      lastT = t;

      const { w, h } = sizeRef.current;

      // Leer vars del audio (ya confirmaste que se mueven)
      const pulse = getVar("--pulse");
      const bass = getVar("--bass");
      const treble = getVar("--treble");

      // Spawn “golpes”: cuando sube el pulso o pasa cierto tiempo y hay audio
      const dp = pulse - lastPulseRef.current;
      lastPulseRef.current = pulse;

      if (enabled && (dp > 0.055 || (pulse > 0.20 && t - lastSpawnRef.current > 380))) {
        lastSpawnRef.current = t;
        spawnRipple(pulse, bass, treble);
      }

      // Limpieza (con leve “trail” para look acuoso)
      ctx.clearRect(0, 0, w, h);

      // Composición “agua brillante”
      ctx.globalCompositeOperation = "lighter";

      const arr = ripplesRef.current;
      for (let i = arr.length - 1; i >= 0; i--) {
        const r = arr[i];

        // update
        r.r += r.vr * dt;
        r.y -= r.vy * dt;           // ✅ sube de abajo hacia arriba
        r.life -= dt;

        // Fade out (suave)
        const k = Math.max(0, Math.min(1, r.life / 1.6));
        const alpha = r.a * k;

        // Dibuja 3 anillos por ripple (como imagen)
        // (ring spacing crece con el radio)
        const ringGap = 14 + (r.r * 0.012);
        const rings = 3;

        for (let j = 0; j < rings; j++) {
          const rr = r.r + j * ringGap;

          // gradiente de stroke para que se vea “acuoso”
          const g = ctx.createRadialGradient(r.x, r.y, Math.max(0, rr - 6), r.x, r.y, rr + 14);
          g.addColorStop(0, `hsla(${r.hue}, 85%, 70%, 0)`);
          g.addColorStop(0.35, `hsla(${r.hue}, 85%, 70%, ${alpha * 0.85})`);
          g.addColorStop(0.60, `hsla(${r.hue}, 85%, 62%, ${alpha})`);
          g.addColorStop(1, `hsla(${r.hue}, 85%, 60%, 0)`);

          ctx.strokeStyle = g;
          ctx.lineWidth = r.w;

          ctx.beginPath();
          ctx.arc(r.x, r.y, rr, 0, Math.PI * 2);
          ctx.stroke();
        }

        // matar si sale de pantalla o muere
        if (r.life <= 0 || r.y + r.r < -80) {
          arr.splice(i, 1);
        }
      }

      // volver a normal
      ctx.globalCompositeOperation = "source-over";

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [enabled]);

  return (
    <canvas
      ref={canvasRef}
      className={`rippleCanvas ${enabled ? "on" : ""}`}
      aria-hidden="true"
    />
  );
}
export default function Invite() {
  const WEDDING = useMemo(
    () => ({
      couple: "Junior & Glenny",
      initials: "JG",
      dateISO: "2026-06-26T17:00:00-04:00",
      monthTitle: "Junio 2026",
      venue: "Salón Vista Marina",
      city: "Santo Domingo, RD",
      time: "5:00 PM",
      addressLine: "",
      mapsQuery: "Salón Vista Marina Santo Domingo",

      heroPhoto: `${supabaseUrl}/storage/v1/object/public/fotos/foto1.jpeg`,
      sectionBg1: `${supabaseUrl}/storage/v1/object/public/fotos/foto1.jpeg`,
      sectionBg2: `${supabaseUrl}/storage/v1/object/public/fotos/foto3.jpeg`,
      sectionBg3: `${supabaseUrl}/storage/v1/object/public/fotos/foto4.jpeg`,

      carousel: [
        `${supabaseUrl}/storage/v1/object/public/fotos/foto2.jpeg`,
        `${supabaseUrl}/storage/v1/object/public/fotos/foto3.jpeg`,
        `${supabaseUrl}/storage/v1/object/public/fotos/foto4.jpeg`,
        `${supabaseUrl}/storage/v1/object/public/fotos/foto5.jpeg`,
      ],

      pinterestUrl: "https://www.pinterest.com/search/pins/?q=outfits%20boda%20formal%20elegante%20hombre%20mujer",
      dressExample: "https://uqqrxkeevstxawzycyzc.supabase.co/storage/v1/object/public/fotos/dress-codev2.jpeg",

      bank: {
        bank: "Banco BHD",
        type: "Cuenta de ahorros",
        account: "40166990017",
        name: "Glenny Aquino",
        cedula: "00117953034",
      },

      musicSrc: "https://uqqrxkeevstxawzycyzc.supabase.co/storage/v1/object/public/audio/boda.mp3",
    }),
    []
  );

  /** Fonts (mantengo tus fuentes) */
  useEffect(() => {
    const id = "invite-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=Great+Vibes&family=Playfair+Display:wght@400;500;600&display=swap";
    document.head.appendChild(link);
  }, []);

  /** Sections */
  const SECTION_IDS = useMemo(() => ["nuestra-boda", "momentos", "ceremonia", "vestimenta", "regalos", "rsvp"], []);
  const active = useIntersectionActive(SECTION_IDS);

  /** Scroll progress */
  const { scrollYProgress, scrollY } = useScroll();
  const prog = useSpring(scrollYProgress, { stiffness: 120, damping: 22 });

  /** HERO parallax */
  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress: heroProg } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroImgScale = useTransform(heroProg, [0, 1], [1.12, 1.0]);
  const heroShadeO = useTransform(heroProg, [0, 1], [1, 0.65]);
  const badgeY = useTransform(heroProg, [0, 1], [0, -40]);
  const badgeO = useTransform(heroProg, [0, 0.7], [1, 0]);

  /** ✅ HERO blur after 2 seconds + text highlight */
  const [heroBlurOn, setHeroBlurOn] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setHeroBlurOn(true), 2000);
    return () => window.clearTimeout(t);
  }, []);

  /** ✅ Floating buttons contrast */
  const [floatingMode, setFloatingMode] = useState<"light" | "dark">("light");
  useMotionValueEvent(scrollY, "change", (y) => {
    const heroH = heroRef.current?.clientHeight ?? window.innerHeight;
    const inHero = y < heroH - 80;
    setFloatingMode(inHero ? "light" : "dark");
  });

  /** Countdown */
  const [count, setCount] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    const target = new Date(WEDDING.dateISO).getTime();
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      const total = Math.floor(diff / 1000);
      const d = Math.floor(total / 86400);
      const h = Math.floor((total % 86400) / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      setCount({ d, h, m, s });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [WEDDING.dateISO]);

  /** Calendar grid */
  const calCells = useMemo(() => {
    const d = new Date(WEDDING.dateISO);
    const y = d.getFullYear();
    const m = d.getMonth();
    const hit = d.getDate();
    const first = new Date(y, m, 1);
    const firstDow = first.getDay();
    const daysIn = new Date(y, m + 1, 0).getDate();

    const cells: Array<{ label: string; hit?: boolean; muted?: boolean; dow?: boolean }> = [];
    ["D", "L", "M", "M", "J", "V", "S"].forEach((x) => cells.push({ label: x, dow: true }));
    for (let i = 0; i < firstDow; i++) cells.push({ label: "", muted: true });
    for (let n = 1; n <= daysIn; n++) cells.push({ label: String(n), hit: n === hit });
    return cells;
  }, [WEDDING.dateISO]);

  /** Maps */
  const openMaps = () => {
    const q = encodeURIComponent(WEDDING.mapsQuery);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
  };

  /** Audio */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [musicOn, setMusicOn] = useState(false);
  const [musicReady, setMusicReady] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.loop = true;
    a.volume = 0.55;
    a.muted = true;

    const onCanPlay = () => setMusicReady(true);
    a.addEventListener("canplay", onCanPlay);
    return () => a.removeEventListener("canplay", onCanPlay);
  }, []);

  useAudioReactiveCSS(audioRef, musicOn);

  const toggleMusic = async () => {
    const a = audioRef.current;
    if (!a) return;

    try {
      if (!musicOn) {
        a.muted = false;
        await a.play();
        setMusicOn(true);
      } else {
        a.pause();
        setMusicOn(false);
      }
    } catch {
      setMusicOn(false);
    }
  };

  /** Toast */
  const [toast, setToast] = useState<Toast>(null);
  const showToast = (type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    window.setTimeout(() => setToast(null), 2800);
  };

  /** Calendar actions */
  const weddingTitle = `Boda: ${WEDDING.couple}`;
  const weddingLocation = `${WEDDING.venue}, ${WEDDING.city}`;
  const weddingDescription =
    `¡Te esperamos! ✨\n\n` +
    `Lugar: ${WEDDING.venue}\n` +
    `Ciudad: ${WEDDING.city}\n` +
    `Hora: ${WEDDING.time}\n` +
    `Notas: ${WEDDING.addressLine}`;

  const addToCalendarICS = () => {
    try {
      downloadICS({
        title: weddingTitle,
        description: weddingDescription,
        location: weddingLocation,
        startISO: WEDDING.dateISO,
        durationHours: 4,
        fileName: `Boda-${WEDDING.couple.replace(/\s*&\s*/g, "-")}.ics`,
      });
      showToast("ok", "Listo: evento descargado (.ics). Ábrelo para guardarlo en tu calendario.");
    } catch {
      showToast("err", "No se pudo crear el evento. Intenta de nuevo.");
    }
  };

  const addToGoogleCalendar = () => {
    try {
      openGoogleCalendar({
        title: weddingTitle,
        description: weddingDescription,
        location: weddingLocation,
        startISO: WEDDING.dateISO,
        durationHours: 4,
      });
    } catch {
      showToast("err", "No se pudo abrir Google Calendar.");
    }
  };

  /** Lightbox */
  const [lightbox, setLightbox] = useState<{ src: string; i: number } | null>(null);

  const goLightbox = useCallback(
    (dir: -1 | 1) => {
      setLightbox((lb) => {
        if (!lb) return lb;
        const n = WEDDING.carousel.length;
        const nextI = (lb.i + dir + n) % n;
        return { src: WEDDING.carousel[nextI], i: nextI };
      });
    },
    [WEDDING.carousel]
  );

  useEffect(() => {
    if (!lightbox) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowLeft") goLightbox(-1);
      if (e.key === "ArrowRight") goLightbox(1);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, goLightbox]);

  /** RSVP */
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    guests: 1,
    kids: false,
    kids_count: 0,
  });

  const [sending, setSending] = useState(false);
  const [confetti, setConfetti] = useState(false);

  const submitRSVP = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: RSVPInsert = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      phone: form.phone.trim(),
      guests_count: Number(form.guests) || 1,
      kids: Boolean(form.kids),
      kids_count: form.kids ? Number(form.kids_count) || 0 : 0,
    };

    if (!payload.first_name || !payload.last_name || !payload.phone) {
      showToast("err", "Completa nombre, apellido y teléfono.");
      return;
    }

    setSending(true);
    const { error } = await supabase.from("rsvps").insert(payload);
    setSending(false);

    if (error) {
      showToast("err", "No se pudo enviar. Intenta de nuevo.");
      return;
    }

    showToast("ok", "¡Confirmación enviada! Gracias");
    setConfetti(true);
    window.setTimeout(() => setConfetti(false), 900);

    setForm({
      first_name: "",
      last_name: "",
      phone: "",
      guests: 1,
      kids: false,
      kids_count: 0,
    });
  };

  const copyBank = async () => {
    try {
      await navigator.clipboard.writeText(WEDDING.bank.account);
      showToast("ok", "Cuenta copiada.");
    } catch {
      showToast("err", "No se pudo copiar.");
    }
  };

  return (
    <LazyMotion features={domAnimation}>
      <style>{styles}</style>

      {/* Audio */}
      <audio ref={audioRef} src={WEDDING.musicSrc} preload="auto" crossOrigin="anonymous" />

      {/* Background */}
      <div className="bg" />
      <RippleCanvas enabled={musicOn} />
      <div className="rippleWall" aria-hidden="true" />
      <div className="paperTex" />
      <div className="grain" aria-hidden="true" />
      <div className="audioDebug" aria-hidden="true">
      </div>
      <div className="page">
        {/* Confetti */}
        <ConfettiBurst show={confetti} />

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              className={`toast ${toast.type}`}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
            >
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right-side scroll indicator + dots */}
        <div className="rail" aria-hidden="true">
          <motion.div className="railFill" style={{ scaleY: prog }} />
        </div>

        {/* Floating nav dots */}
        <nav className="navDots" aria-label="Secciones">
          {SECTION_IDS.map((id) => (
            <button
              key={id}
              className={`navDot ${active === id ? "on" : ""}`}
              onClick={() => scrollToId(id)}
              type="button"
              aria-label={`Ir a ${id}`}
            />
          ))}
        </nav>

        {/* Floating chips */}
        <div className={`floating ${floatingMode === "dark" ? "floatingDark" : "floatingLight"}`}>
          <button className="chip" onClick={toggleMusic} type="button" title="Música">
            <span className="chipDot" data-on={musicOn ? "1" : "0"} />
            {musicOn ? "Música" : "Sonido"}
          </button>

          <button className="chip" onClick={() => scrollToId("nuestra-boda")} type="button" title="Ver invitación">
            Ver invitación ↓
          </button>

          <button className="chip" onClick={addToCalendarICS} type="button" title="Agregar al calendario">
            Agregar al calendario
          </button>
        </div>

        {/* =======================
            HERO (NO TOCAR)
            ======================= */}
        <section className={`hero ${heroBlurOn ? "heroBlurOn" : ""}`} ref={heroRef}>
          <motion.div className="heroPhoto" style={{ scale: heroImgScale }}>
            <motion.img
              src={WEDDING.heroPhoto}
              alt="Junior y Glenny"
              initial={false}
              animate={{
                filter: heroBlurOn ? "blur(8px) saturate(1.05)" : "blur(0px) saturate(1)",
                transform: heroBlurOn ? "scale(1.04)" : "scale(1.0)",
              }}
              transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
            />
            <motion.div className="heroShade" style={{ opacity: heroShadeO }} />
            <div className="heroGlow" aria-hidden="true" />
          </motion.div>

          <motion.div className="heroCenter" style={{ y: badgeY, opacity: badgeO }}>
            <div className="heroBadge">
              <div className="heroNames">
                <TypeReveal text={WEDDING.couple} delay={0.05} />
              </div>

              <div className="heroLine">
                <TypeReveal text="DESPUÉS DE TANTOS AÑOS JUNTOS LO HEMOS DECIDIDO…" delay={0.12} stagger={0.012} />
              </div>

              <div className="heroBig">
                <TypeReveal text="¡Nos casamos!" delay={0.18} />
              </div>

              <div className="heroMeta">
                <span className="pill">{formatDateDMY(WEDDING.dateISO)}</span>
                <span className="pill">{WEDDING.city}</span>
              </div>

              <motion.button
                className="heroBtn"
                onClick={() => scrollToId("nuestra-boda")}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                type="button"
              >
                Desliza para ver más ↓
              </motion.button>

              {!musicReady && (<div className="heroLoading"></div>
              )}
            </div>
          </motion.div>
        </section>

        {/* =======================
            CONTENT (REDISEÑADO)
            ======================= */}
        <main className="content">
          {/* 1) Nuestra boda (REDISEÑO) */}
          <SheetSection id="nuestra-boda" bgImage={WEDDING.sectionBg1} watermark={WEDDING.initials}>
            <HeaderScript title="Nuestra Boda" subtitle="Guarda la fecha y acompáñanos en este día tan especial." />
            <div className="subcaps">{formatDateDMY(WEDDING.dateISO)}</div>

            <div className="layoutSplit">
              {/* Left: calendario */}
              <div className="cardSoft calCard">
                <div className="calHeader">
                  <div className="calHeaderLeft">
                    <div className="kicker">Calendario</div>
                    <div className="calMonth">{WEDDING.monthTitle}</div>
                  </div>
                  <div className="calHeaderRight">
                    <span className="badgeMini">Evento</span>
                    <span className="badgeMini strong">{WEDDING.time}</span>
                  </div>
                </div>

                <div className="calGrid">
                  {calCells.map((c, idx) => (
                    <div
                      key={idx}
                      className={[
                        c.dow ? "calDow" : "calDay",
                        c.muted ? "calMuted" : "",
                        c.hit ? "calHit" : "",
                      ].join(" ")}
                    >
                      {c.label}
                    </div>
                  ))}
                </div>

                <div className="btnRow" style={{ marginTop: 14 }}>
                  <button className="pillBtn" onClick={addToGoogleCalendar} type="button">
                    Google Calendar
                  </button>
                  <button className="pillBtn solid" onClick={addToCalendarICS} type="button">
                    Descargar .ics
                  </button>
                </div>
              </div>

              {/* Right: info + countdown */}
              <div className="stack">
                <div className="cardSoft detailsCard">
                  <div className="kicker">Detalles</div>
                  <div className="detailsTitle">{WEDDING.venue}</div>
                  <div className="detailsMeta">
                    <span className="tagPill">{WEDDING.city}</span>
                    <span className="tagPill">{WEDDING.time}</span>
                    <span className="tagPill">{formatDateDMY(WEDDING.dateISO)}</span>
                  </div>
                  <p className="detailsText">{WEDDING.addressLine}</p>
                </div>

                <div className="cardSoft countdownCard">
                  <div className="kicker">Cuenta regresiva</div>
                  <CountdownBig d={count.d} h={count.h} m={count.m} s={count.s} />
                </div>
              </div>
            </div>
          </SheetSection>

          <SectionDivider />

          {/* 2) Momentos (mantengo tu carousel, solo el estilo cambia) */}
          <SheetSection id="momentos" bgImage={WEDDING.sectionBg2} watermark="LOVE">
            <HeaderScript title="Momentos" subtitle="Un vistazo a nuestros recuerdos antes del gran día." />
            <CoverflowCarousel images={WEDDING.carousel} onOpen={(src, i) => setLightbox({ src, i })} />
          </SheetSection>

          <SectionDivider />

          {/* 3) Ceremonia (REDISEÑO) */}
          <SheetSection id="ceremonia" bgImage={WEDDING.sectionBg3} watermark="RSVP">
            <HeaderScript title="Ceremonia" subtitle="Todo lo que necesitas saber para llegar a tiempo y disfrutar." />

            <div className="layoutSplit">
              {/* Left: timeline */}
              <div className="cardSoft timelineCard">
                <div className="kicker">Agenda</div>

                <div className="timeline">
                  <div className="tlItem">
                    <div className="tlDot" />
                    <div className="tlBody">
                      <div className="tlTitle">Llegada</div>
                      <div className="tlText">Te recomendamos llegar con tiempo para ubicarte y tomarte fotos.</div>
                    </div>
                    <div className="tlTime">4:30 PM</div>
                  </div>

                  <div className="tlItem">
                    <div className="tlDot" />
                    <div className="tlBody">
                      <div className="tlTitle">Ceremonia</div>
                      <div className="tlText">{WEDDING.venue}</div>
                    </div>
                    <div className="tlTime">{WEDDING.time}</div>
                  </div>

                  <div className="tlItem">
                    <div className="tlDot" />
                    <div className="tlBody">
                      <div className="tlTitle">Brindis & celebración</div>
                      <div className="tlText">Acompáñanos a celebrar este momento con alegría.</div>
                    </div>
                    <div className="tlTime">6:30 PM</div>
                  </div>
                </div>

                <div className="detailsMeta" style={{ marginTop: 12 }}>
                  <span className="tagPill">{WEDDING.city}</span>
                  <span className="tagPill">{formatDateDMY(WEDDING.dateISO)}</span>
                </div>

                <div className="btnRow" style={{ justifyContent: "flex-start", marginTop: 14 }}>
                  <button className="pillBtn" onClick={addToGoogleCalendar} type="button">
                    Agregar al calendario
                  </button>
                  <button className="pillBtn" onClick={openMaps} type="button">
                    Abrir ubicación
                  </button>
                </div>
              </div>

              {/* Right: map */}
              <div className="cardSoft mapCard">
                <div className="kicker">Ubicación</div>
                <div className="mapFrame">
                  <iframe
                    title="Mapa"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps?q=${encodeURIComponent(WEDDING.mapsQuery)}&output=embed`}
                  />
                </div>
              </div>
            </div>
          </SheetSection>

          <SectionDivider />

          {/* 4) Vestimenta (REDISEÑO) */}
          <SheetSection id="vestimenta" watermark="DRESS">
            <HeaderScript title="Código de vestimenta" subtitle="Formal-elegante. Tonos suaves, evitando blanco por favor." />

            <div className="layoutSplit">
              <div className="cardSoft dressTextCard">
                <div className="kicker">Sugerencia</div>
                <p className="textBody">
                  Queremos que seas parte de nuestra historia luciendo espectacular con un look{" "}
                  <span className="capsStrong">Formal-elegante</span> y con estilo. En tonos suaves evitando por favor utilizar el color blanco
                </p>

                <div className="paletteRow" aria-label="Paleta sugerida">
                  <div className="palSwatch s1" />
                  <div className="palSwatch s2" />
                  <div className="palSwatch s3" />
                  <div className="palSwatch s4" />
                  <div className="palSwatch s5" />
                </div>

                <div className="btnRow" style={{ justifyContent: "flex-start" }}>
                  <button className="pillBtn" onClick={() => window.open(WEDDING.pinterestUrl, "_blank")} type="button">
                    Ver ideas
                  </button>
                </div>
              </div>

              <div className="cardSoft dressCard">
                <div className="kicker">Ejemplo</div>
                <div className="dressPhoto">
                  <img src={WEDDING.dressExample} alt="Ejemplo vestimenta formal elegante" loading="lazy" />
                </div>
              </div>
            </div>
          </SheetSection>

          <SectionDivider />

          {/* 5) Regalos (REDISEÑO) */}
          <SheetSection id="regalos" watermark={WEDDING.initials}>
            <HeaderScript
              title="Detalle"
              subtitle="Tu presencia es lo más importante. Si deseas colaborar con nuestra luna de miel (opcional), aquí está la información."
            />

            <div className="giftGrid">
              <div className="cardSoft bankCard">
                <div className="bankTop">
                  <div className="bankBadge">BHD</div>
                  <div>
                    <div className="bankName">{WEDDING.bank.bank}</div>
                    <div className="bankType">{WEDDING.bank.type}</div>
                  </div>
                </div>

                <div className="bankGrid">
                  <div className="bankItem">
                    <div className="bankLbl">Cuenta</div>
                    <div className="bankVal">{WEDDING.bank.account}</div>
                  </div>
                  <div className="bankItem">
                    <div className="bankLbl">Nombre</div>
                    <div className="bankVal">{WEDDING.bank.name}</div>
                  </div>
                  <div className="bankItem">
                    <div className="bankLbl">Cédula</div>
                    <div className="bankVal">{WEDDING.bank.cedula}</div>
                  </div>
                  <div className="bankItem">
                    <div className="bankLbl">Banco</div>
                    <div className="bankVal">{WEDDING.bank.bank}</div>
                  </div>
                </div>

                <div className="btnRow" style={{ justifyContent: "flex-start" }}>
                  <button className="pillBtn solid" onClick={copyBank} type="button">
                    Copiar cuenta
                  </button>
                </div>
              </div>
            </div>
          </SheetSection>

          <SectionDivider />

          {/* 6) RSVP (REDISEÑO) */}
          <SheetSection id="rsvp" watermark={WEDDING.initials}>
            <HeaderScript title="Confirmación de asistencia" subtitle="Por favor confirma tu asistencia llenando este formulario." />

            <div className="rsvpShell">
              <form className="form" onSubmit={submitRSVP}>
                <div className="grid2">
                  <Field label="Nombre">
                    <input
                      className="input"
                      value={form.first_name}
                      onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                      placeholder="Tu nombre"
                      autoComplete="given-name"
                    />
                  </Field>

                  <Field label="Apellido">
                    <input
                      className="input"
                      value={form.last_name}
                      onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                      placeholder="Tu apellido"
                      autoComplete="family-name"
                    />
                  </Field>
                </div>

                <div className="grid2">
                  <Field label="Teléfono">
                    <input
                      className="input"
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="Ej: 8091234567"
                      autoComplete="tel"
                      inputMode="tel"
                    />
                  </Field>

                  <Field label="¿Cuántas personas van contigo?">
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={20}
                      value={form.guests}
                      onChange={(e) => setForm((p) => ({ ...p, guests: Number(e.target.value) }))}
                    />
                    <div className="hint">Incluyéndote (1 si vas solo/a)</div>
                  </Field>
                </div>

                <div className="grid2">
                  <Field label="¿Asistirán niños?">
                    <select
                      className="input"
                      value={form.kids ? "si" : "no"}
                      onChange={(e) => setForm((p) => ({ ...p, kids: e.target.value === "si" }))}
                    >
                      <option value="no">No</option>
                      <option value="si">Sí</option>
                    </select>
                  </Field>

                  <Field label="Cantidad de niños">
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={20}
                      value={form.kids ? form.kids_count : 0}
                      onChange={(e) => setForm((p) => ({ ...p, kids_count: Number(e.target.value) }))}
                      disabled={!form.kids}
                    />
                  </Field>
                </div>

                <div className="btnRow" style={{ justifyContent: "flex-start" }}>
                  <button className="pillBtn solid" disabled={sending} type="submit">
                    {sending ? "Enviando..." : "Confirmar"}
                  </button>
                </div>
              </form>

              <footer className="footer">
                <div className="mono">{WEDDING.initials}</div>
                <div className="footerLine">Con amor, {WEDDING.couple}</div>
                <div className="footerSmall">© {new Date().getFullYear()}</div>
              </footer>
            </div>
          </SheetSection>

          <div style={{ height: 22 }} />
        </main>

        {/* Lightbox */}
        <AnimatePresence>
          {lightbox && (
            <motion.div
              className="lightbox"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLightbox(null)}
            >
              <motion.div
                className="lightboxInner"
                initial={{ y: 12, scale: 0.98, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                exit={{ y: 10, scale: 0.985, opacity: 0 }}
                transition={{ duration: 0.25 }}
                onClick={(e) => e.stopPropagation()}
              >
                <img src={lightbox.src} alt="Foto" />

                <div className="lightboxRow">
                  <div className="btnRow" style={{ marginTop: 0 }}>
                    <button className="pillBtn" onClick={() => goLightbox(-1)} type="button">
                      ‹ Anterior
                    </button>
                    <button className="pillBtn solid" onClick={() => setLightbox(null)} type="button">
                      Cerrar
                    </button>
                    <button className="pillBtn" onClick={() => goLightbox(1)} type="button">
                      Siguiente ›
                    </button>
                  </div>

                  <div className="lightboxIndex">
                    {lightbox.i + 1} / {WEDDING.carousel.length}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LazyMotion>
  );
}

/** =======================
 *  UI bits
 *  ======================= */
function HeaderScript({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="head">
      <div className="title">
        <TypeReveal text={title} delay={0.05} />
      </div>
      <div className="divider" />
      {subtitle ? <p className="textMuted">{subtitle}</p> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <div className="label">{label}</div>
      {children}
    </div>
  );
}

function CountdownBig({ d, h, m, s }: { d: number; h: number; m: number; s: number }) {
  return (
    <div className="countdown">
      <div className="countDigits">
        <DigitBlock value={pad2(d)} label="days" />
        <div className="colon">:</div>
        <DigitBlock value={pad2(h)} label="hours" />
        <div className="colon">:</div>
        <DigitBlock value={pad2(m)} label="minutes" />
        <div className="colon">:</div>
        <DigitBlock value={pad2(s)} label="seconds" />
      </div>
    </div>
  );
}

function DigitBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="digitBlock">
      <div className="digit">{value}</div>
      <div className="digitLbl">{label}</div>
    </div>
  );
}

/** =======================
 *  Styles (REDISEÑO BLANCO/AZUL)
 *  ======================= */
const styles = `
:root{
  /* White/Blue palette */
  --bg0: #f7fbff;
  --bg1: #ffffff;
  --ink: #0b1630;
  --muted: rgba(11,22,48,.72);

  --blue900: #0b1b3a;
  --blue800: #0d2a57;
  --blue700: #123a77;
  --blue600: #1f4fa3;
  --blue500: #2f67d3;
  --blue400: #4b86ff;
  --blue300: #8cb2ff;
  --blue200: #cfe0ff;

  --line: rgba(31,79,163,.18);
  --line2: rgba(31,79,163,.10);

  --shadow1: 0 18px 60px rgba(10,33,74,.10);
  --shadow2: 0 10px 26px rgba(10,33,74,.08);

  /* Audio-reactive vars (0..1) */
  --pulse: 0;
  --bass: 0;
  --mid: 0;
  --treble: 0;
}

*{ box-sizing:border-box; }
html{ scroll-behavior:smooth; background: var(--bg0); }
body{
  margin:0;
  background: transparent;
  color: var(--ink);
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}

/* =======================
   Background (white/blue, reacts subtly)
   ======================= */
.bg{
  position:fixed; inset:0; z-index:0;
  z-index: 0;
  /* Más contraste + más “vida” con el audio */
  background:
    radial-gradient(900px 520px at 12% 10%,
      rgba(82,113,161, calc(.10 + var(--pulse)*.55)) 0%, transparent 72%),
    radial-gradient(900px 520px at 88% 12%,
      rgba(13,21,70, calc(.12 + var(--mid)*.45)) 0%, transparent 72%),
    radial-gradient(900px 520px at 50% 110%,
      rgba(2,2,11, calc(.12 + var(--bass)*.25)) 0%, transparent 72%),
    linear-gradient(180deg, rgba(2,2,11,.92), rgba(13,21,70,.14));

  filter:
    saturate(calc(1.08 + var(--treble)*.55))
    brightness(calc(.96 + var(--pulse)*.14))
    contrast(calc(1.02 + var(--bass)*.10));

  transition: filter .18s ease;
}

.bg::before{
  content:"";
  position:absolute;
  inset:-12%;
  pointer-events:none;

  /* Aura grande que “respira” */
  background:
    radial-gradient(640px 420px at 50% 58%,
      rgba(82,113,161, calc(.10 + var(--bass)*.70)) 0%, transparent 70%),
    radial-gradient(760px 460px at 20% 28%,
      rgba(13,21,70, calc(.08 + var(--mid)*.60)) 0%, transparent 72%),
    radial-gradient(760px 460px at 80% 30%,
      rgba(82,113,161, calc(.06 + var(--treble)*.55)) 0%, transparent 72%);

  filter: blur(18px);
  opacity: calc(.55 + var(--pulse)*.35);
  mix-blend-mode: screen;
  transform: translate3d(0,0,0);
}

.bg::after{
  content:"";
  position:absolute;
  inset:-18%;
  pointer-events:none;

  background:
    conic-gradient(
      from 180deg at 50% 50%,
      rgba(82,113,161, calc(.10 + var(--treble)*.25)),
      rgba(13,21,70, calc(.10 + var(--mid)*.25)),
      rgba(2,2,11, .10),
      rgba(82,113,161, calc(.10 + var(--treble)*.25))
    );

  opacity: calc(.30 + var(--pulse)*.45);
  filter: blur(22px);
  mix-blend-mode: screen;
  animation: bgFloat 9s ease-in-out infinite;
}

/* =======================
   RIPPLE WALL (ondas de agua)
   - Concentric rings like your image
   - Origin at bottom, rise upward
   - Driven by --pulse/--bass/--mid/--treble
   ======================= */
.rippleWall{
  position: fixed;
  inset: 0;
  z-index: 1;           /* bg=0, ripple=1, paperTex=2, grain=3 */
  pointer-events: none;

  /* para que el efecto “nazca” abajo y se desvanezca arriba */
  -webkit-mask-image: linear-gradient(to top,
    rgba(0,0,0,1) 0%,
    rgba(0,0,0,1) 42%,
    rgba(0,0,0,.0) 78%);
          mask-image: linear-gradient(to top,
    rgba(0,0,0,1) 0%,
    rgba(0,0,0,1) 42%,
    rgba(0,0,0,.0) 78%);

  opacity: 1;
}

/* Capa principal: anillos concéntricos (tipo la imagen) */
.rippleWall::before{
  content:"";
  position:absolute;
  inset:-22% -12%;
  transform: translate3d(0,0,0);

  /* 🔥 MULTI-CENTROS DE ONDA (varios puntos en la “pared”) */
  background:
    /* centro 1 */
    repeating-radial-gradient(
      circle at 22% 116%,
      rgba(82,113,161, calc(.06 + var(--pulse)*.28)) 0 2px,
      rgba(82,113,161, calc(.02 + var(--pulse)*.10)) 2px 6px,
      transparent 6px 18px
    ),
    /* centro 2 */
    repeating-radial-gradient(
      circle at 52% 118%,
      rgba(255,255,255, calc(.03 + var(--treble)*.12)) 0 2px,
      rgba(82,113,161, calc(.02 + var(--pulse)*.12)) 2px 7px,
      transparent 7px 20px
    ),
    /* centro 3 */
    repeating-radial-gradient(
      circle at 82% 116%,
      rgba(13,21,70, calc(.06 + var(--mid)*.22)) 0 2px,
      rgba(82,113,161, calc(.02 + var(--pulse)*.12)) 2px 6px,
      transparent 6px 18px
    );

  /* “Golpe” desde abajo hacia arriba:
     - translateY baja/sube con el audio
     - scale da sensación de expansión */
  transform:
    translateY(calc( 220px - (var(--bass) * 520px) ))
    scale(calc(1.02 + var(--pulse)*.06));

  /* hace los anillos más suaves y acuosos */
  filter:
    blur(calc(10px - var(--pulse)*3px))
    saturate(calc(1.05 + var(--treble)*.55))
    contrast(calc(1.05 + var(--bass)*.20));

  opacity: calc(.20 + var(--pulse)*.70);
  mix-blend-mode: screen;

  animation: rippleDrift 3.2s ease-in-out infinite;
}

/* Glow acuoso que acompaña a los anillos (para que se sienta “agua” y no “gráfico”) */
.rippleWall::after{
  content:"";
  position:absolute;
  inset:-18% -10%;
  transform: translate3d(0,0,0);

  background:
    radial-gradient(900px 520px at 50% 112%,
      rgba(82,113,161, calc(.10 + var(--bass)*.40)) 0%,
      transparent 70%),
    radial-gradient(720px 420px at 20% 112%,
      rgba(13,21,70, calc(.08 + var(--mid)*.35)) 0%,
      transparent 72%),
    radial-gradient(720px 420px at 80% 112%,
      rgba(82,113,161, calc(.06 + var(--treble)*.30)) 0%,
      transparent 72%);

  transform:
    translateY(calc( 260px - (var(--pulse) * 420px) ))
    scale(calc(1.00 + var(--pulse)*.03));

  filter:
    blur(18px)
    hue-rotate(calc(-6deg + var(--treble)*18deg))
    brightness(calc(.98 + var(--pulse)*.12));

  opacity: calc(.18 + var(--pulse)*.55);
  mix-blend-mode: screen;

  animation: rippleSweep 4.0s ease-in-out infinite;
}

@keyframes rippleDrift{
  0%   { background-position: 0% 0%, 0% 0%, 0% 0%; }
  50%  { background-position: 10% 0%, -8% 0%, 6% 0%; }
  100% { background-position: 0% 0%, 0% 0%, 0% 0%; }
}

@keyframes rippleSweep{
  0%   { background-position: 0% 0%, 0% 0%, 0% 0%; }
  50%  { background-position: 6% 0%, -6% 0%, 4% 0%; }
  100% { background-position: 0% 0%, 0% 0%, 0% 0%; }
}


.paperTex{
  position:fixed; inset:0; z-index:2;
  opacity:.10;
  background-image: radial-gradient(circle at 1px 1px, rgba(31,79,163,.18) 1px, transparent 0);
  background-size: 18px 18px;
  mix-blend-mode:multiply;
  pointer-events:none;
}
.grain{
  position:fixed; inset:0; z-index:3; pointer-events:none;
  opacity:.06;
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='260' height='260' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E");
  background-size: 240px 240px;
  mix-blend-mode:multiply;
}

.page{
  position: relative;
  z-index: 10;
  min-height: 100svh;
}

/* Toast */
.toast{
  position:fixed;
  left:50%;
  transform:translateX(-50%);
  bottom: 20px;
  z-index: 5000;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 12px;
  box-shadow: var(--shadow1);
  border: 1px solid var(--line);
  background: rgba(255,255,255,.88);
  color: rgba(11,22,48,.90);
  backdrop-filter: blur(12px);
}
.toast.ok{ border-color: rgba(47,103,211,.28); }
.toast.err{ border-color: rgba(255,120,120,.28); }

/* Confetti */
.confetti{
  position:fixed;
  inset:0;
  pointer-events:none;
  z-index: 4500;
  display:grid;
  place-items:center;
}
.confettiPiece{
  position:absolute;
  width: 10px;
  height: 6px;
  border-radius: 999px;
  border: 1px solid rgba(47,103,211,.20);
  background: rgba(47,103,211,.35);
  box-shadow: var(--shadow2);
}

/* Floating */
.floating{
  position:fixed;
  top: 14px;
  right: 14px;
  z-index: 3000;
  display:flex;
  flex-direction:column;
  gap: 10px;
}
.chip{
  border-radius: 999px;
  cursor:pointer;
  padding: 10px 12px;
  display:flex;
  align-items:center;
  gap: 10px;
  font-family: Cinzel, serif;
  letter-spacing: .14em;
  text-transform: uppercase;
  font-size: 10px;
  box-shadow: var(--shadow2);
  transition: background .2s ease, border-color .2s ease, color .2s ease, transform .15s ease;
}
.chip:active{ transform: scale(.99); }

.floatingLight .chip{
  border: 1px solid rgba(255,255,255,.40);
  background: rgba(255,255,255,.12);
  color: rgba(255,255,255,.92);
  backdrop-filter: blur(14px);
}
.floatingDark .chip{
  border: 1px solid var(--line);
  background: rgba(255,255,255,.86);
  color: rgba(11,22,48,.90);
  backdrop-filter: blur(12px);
}

.chipDot{
  width: 8px; height: 8px; border-radius: 999px;
  background: rgba(255,255,255,.60);
  box-shadow: 0 0 0 6px rgba(255,255,255,.10);
}
.chipDot[data-on="1"]{
  background: rgba(47,103,211,.95) !important;
  box-shadow: 0 0 0 6px rgba(47,103,211,.16) !important;
}

/* Right rail progress */
.rail{
  position:fixed;
  top: 90px;
  right: 10px;
  width: 3px;
  height: 180px;
  border-radius: 999px;
  background: rgba(11,22,48,.10);
  border: 1px solid rgba(11,22,48,.08);
  z-index: 2800;
  overflow:hidden;
}
.railFill{
  transform-origin: top;
  width: 100%;
  height: 100%;
  background: rgba(47,103,211,.85);
  border-radius: 999px;
}

/* Dots nav */
.navDots{
  position:fixed;
  top: 290px;
  right: 8px;
  z-index: 2800;
  display:flex;
  flex-direction:column;
  gap: 10px;
}
.navDot{
  width: 10px; height: 10px;
  border-radius: 999px;
  border: 1px solid rgba(11,22,48,.14);
  background: rgba(255,255,255,.72);
  cursor:pointer;
}
.navDot.on{
  background: rgba(47,103,211,.95);
  border-color: rgba(47,103,211,.70);
}

/* =======================
   HERO (NO TOCAR)
   ======================= */
.hero{
  position:relative;
  min-height: 100vh;
  width: 100%;
  overflow:hidden;
}
.heroPhoto{
  position:absolute;
  inset:0;
  will-change: transform;
}
.heroPhoto img{
  width:100%;
  height:100%;
  object-fit: cover;
  display:block;
}
.heroShade{
  position:absolute;
  inset:0;
  background:
    radial-gradient(900px 520px at 50% 55%, rgba(0,0,0,.12) 0%, rgba(0,0,0,.50) 70%),
    linear-gradient(180deg, rgba(0,0,0,.62), rgba(0,0,0,.40));
}
.heroGlow{
  position:absolute;
  inset:0;
  pointer-events:none;
  background:
    radial-gradient(700px 420px at 50% 52%, rgba(82,113,161, calc(.08 + var(--pulse)*.16)) 0%, transparent 65%),
    radial-gradient(900px 520px at 20% 20%, rgba(13,21,70, calc(.08 + var(--mid)*.14)) 0%, transparent 60%);
  mix-blend-mode: screen;
  filter: blur(10px);
  opacity: calc(.55 + var(--pulse)*.12);
}
.heroCenter{
  position:relative;
  z-index: 20;
  min-height: 100vh;
  display:grid;
  place-items:center;
  padding: 18px 14px;
}
.heroBadge{
  width: min(860px, 92vw);
  text-align:center;
  border-radius: 28px;
  padding: 18px 16px;
  border: 1px solid rgba(255,255,255,.18);
  transition: box-shadow 1s ease, border-color 1s ease, background 1s ease;
}
.hero.heroBlurOn .heroBadge{
  border-color: rgba(82,113,161,.28);
  background: rgba(2,2,11,.40);
  box-shadow:
    0 30px 100px rgba(2,2,11,.55),
    0 0 0 1px rgba(82,113,161,.10) inset;
}
.heroNames{
  font-family: "Great Vibes", cursive;
  font-size: clamp(44px, 8vw, 78px);
  line-height: 1;
  color: rgba(255,255,255,.96);
  text-shadow: 0 18px 40px rgba(2,2,11,.45);
}
.heroLine{
  margin-top: 10px;
  font-family: Cinzel, serif;
  font-size: 11px;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: rgba(255,255,255,.86);
  text-shadow: 0 18px 40px rgba(2,2,11,.45);
}
.heroBig{
  margin-top: 10px;
  font-family: "Great Vibes", cursive;
  font-size: clamp(34px, 6vw, 56px);
  color: rgba(255,255,255,.94);
  text-shadow: 0 18px 40px rgba(2,2,11,.45);
}
.heroMeta{
  margin-top: 14px;
  display:flex;
  justify-content:center;
  gap: 10px;
  flex-wrap: wrap;
}
.pill{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding: 10px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.20);
  background: rgba(255,255,255,.10);
  color: rgba(255,255,255,.92);
  font-family: Cinzel, serif;
  letter-spacing: .12em;
  text-transform: uppercase;
  font-size: 10px;
  backdrop-filter: blur(12px);
}
.heroBtn{
  margin-top: 14px;
  border: 1px solid rgba(255,255,255,.24);
  background: rgba(255,255,255,.10);
  color: rgba(255,255,255,.92);
  font-family: Cinzel, serif;
  letter-spacing: .14em;
  text-transform: uppercase;
  font-size: 10px;
  padding: 10px 12px;
  border-radius: 999px;
  cursor:pointer;
  backdrop-filter: blur(12px);
  box-shadow: 0 16px 44px rgba(2,2,11,.22);
}
/* Canvas overlay (ondas visibles) */
.rippleCanvas{
  position: fixed;
  inset: 0;
  z-index: 9;            /* 🔥 importante: encima del fondo y secciones */
  pointer-events: none;

  /* se ve “agua” y no mancha el texto */
  mix-blend-mode: screen;
  opacity: .92;

  /* empieza desde abajo y se desvanece hacia arriba */
  -webkit-mask-image: linear-gradient(to top,
    rgba(0,0,0,1) 0%,
    rgba(0,0,0,1) 46%,
    rgba(0,0,0,.0) 78%);
          mask-image: linear-gradient(to top,
    rgba(0,0,0,1) 0%,
    rgba(0,0,0,1) 46%,
    rgba(0,0,0,.0) 78%);

  filter: blur(6px) saturate(1.12) contrast(1.05);
}

/* Opcional: cuando música está OFF, casi invisible */
.rippleCanvas:not(.on){
  opacity: .12;
}
.heroTip{
  margin-top: 10px;
  font-size: 11px;
  color: rgba(255,255,255,.82);
  text-shadow: 0 12px 30px rgba(2,2,11,.45);
}

/* =======================
   CONTENT
   ======================= */
.content{
  padding: 34px 14px 70px;
  display:flex;
  flex-direction:column;
  gap: 18px;
}

/* Divider line */
.sectionSepWrap{
  width: min(980px, 100%);
  margin: 0 auto;
  padding: 4px 0;
  display:flex;
  justify-content:center;
}
.sectionSep{
  width: min(860px, 94%);
  height: 1px;
  transform-origin: center;
  background: linear-gradient(90deg, transparent, rgba(47,103,211,.32), transparent);
  opacity: .9;
}

/* =======================
   SECTIONS (sin marcos)
   ======================= */
.sec{
  width: min(980px, 100%);
  margin: 0 auto;
  position:relative;
  border-radius: 30px;
  padding: 10px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.86), rgba(255,255,255,.78));
  box-shadow: var(--shadow1);
  overflow:hidden;
}
.sec[data-hasbg="1"]::before{
  content:"";
  position:absolute;
  inset:-30px;
  background-image: var(--secBg);
  background-size: cover;
  background-position: center;
  filter: blur(26px) saturate(1.05);
  opacity: .10;
  transform: scale(1.08);
}
.sec::after{
  content:"";
  position:absolute;
  inset:0;
  background:
    radial-gradient(900px 520px at 12% 18%, rgba(207,224,255,.62) 0%, transparent 60%),
    radial-gradient(900px 520px at 88% 8%, rgba(140,178,255,.40) 0%, transparent 60%);
  opacity: calc(.55 + var(--pulse)*.08);
  pointer-events:none;
}
.secInner{
  position:relative;
  z-index: 2;
  padding: 22px 18px 18px;
}
.watermark{
  position:absolute;
  inset:auto 0 10px 0;
  text-align:center;
  font-family: "Playfair Display", serif;
  font-size: clamp(74px, 15vw, 160px);
  letter-spacing: .08em;
  color: rgba(11,22,48,.06);
  pointer-events:none;
  user-select:none;
}

/* Head */
.head{ text-align:center; }
.title{
  font-family: "Great Vibes", cursive;
  font-size: 46px;
  line-height: 1;
  color: rgba(11,22,48,.95);
}
.divider{
  width: 82px;
  height: 2px;
  margin: 12px auto 0;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(47,103,211,.0), rgba(47,103,211,.48), rgba(47,103,211,.0));
}
.subcaps{
  margin-top: 10px;
  text-align:center;
  font-family: Cinzel, serif;
  font-size: 12px;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: rgba(11,22,48,.72);
}
.textMuted{
  margin: 10px auto 0;
  font-size: 12px;
  line-height: 1.7;
  color: rgba(11,22,48,.70);
  text-align:center;
  max-width: 760px;
}
.capsStrong{
  font-family: Cinzel, serif;
  letter-spacing: .10em;
  font-size: 11px;
  text-transform: uppercase;
  font-weight: 600;
  color: rgba(11,22,48,.86);
}

/* Layout helpers */
.layoutSplit{
  margin-top: 18px;
  display:grid;
  grid-template-columns: 1.05fr .95fr;
  gap: 14px;
  align-items:start;
}
.stack{
  display:flex;
  flex-direction:column;
  gap: 14px;
}
.kicker{
  font-family: Cinzel, serif;
  font-size: 10px;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: rgba(11,22,48,.72);
}
.cardSoft{
  border-radius: 22px;
  background: rgba(255,255,255,.78);
  box-shadow: var(--shadow2);
  padding: 16px 14px;
  border: 1px solid var(--line2);
  backdrop-filter: blur(10px);
}
.badgeMini{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding: 8px 10px;
  border-radius: 999px;
  font-family: Cinzel, serif;
  font-size: 10px;
  letter-spacing: .14em;
  text-transform: uppercase;
  border: 1px solid var(--line);
  background: rgba(255,255,255,.70);
  color: rgba(11,22,48,.78);
}
.badgeMini.strong{
  border-color: rgba(47,103,211,.26);
  color: rgba(11,22,48,.90);
}
.tagPill{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding: 9px 12px;
  border-radius: 999px;
  font-family: Cinzel, serif;
  font-size: 10px;
  letter-spacing: .12em;
  text-transform: uppercase;
  border: 1px solid var(--line);
  background: rgba(255,255,255,.70);
  color: rgba(11,22,48,.78);
}
.tinyHint{
  margin-top: 10px;
  font-size: 11px;
  color: rgba(11,22,48,.62);
}

/* Nuestra boda details */
.detailsTitle{
  margin-top: 8px;
  font-family: "Playfair Display", serif;
  font-size: 20px;
  color: rgba(11,22,48,.94);
}
.detailsMeta{
  margin-top: 12px;
  display:flex;
  flex-wrap: wrap;
  gap: 8px;
}
.detailsText{
  margin-top: 12px;
  font-size: 12px;
  line-height: 1.7;
  color: rgba(11,22,48,.72);
}

/* Countdown new */
.countdown{
  margin-top: 12px;
}
.countDigits{
  display:flex;
  align-items:flex-end;
  justify-content:flex-start;
  gap: 10px;
  flex-wrap: wrap;
}
.colon{
  font-family: "Playfair Display", serif;
  font-size: 26px;
  color: rgba(11,22,48,.45);
  margin-bottom: 10px;
}
.digitBlock{
  min-width: 86px;
  border-radius: 16px;
  border: 1px solid var(--line2);
  background: rgba(255,255,255,.72);
  padding: 10px 10px;
  text-align:center;
}
.digit{
  font-family: "Playfair Display", serif;
  font-size: 28px;
  letter-spacing: .06em;
  color: rgba(11,22,48,.92);
}
.digitLbl{
  margin-top: 6px;
  font-family: Cinzel, serif;
  font-size: 10px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(11,22,48,.60);
}

/* Calendar (flat + clean) */
.calHeader{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.calMonth{
  margin-top: 6px;
  font-family: "Playfair Display", serif;
  font-size: 18px;
  color: rgba(11,22,48,.92);
}
.calGrid{
  display:grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  margin-top: 12px;
}
.calDow{
  font-family: Cinzel, serif;
  font-size: 10px;
  text-align:center;
  color: rgba(11,22,48,.65);
}
.calDay{
  font-family: system-ui, sans-serif;
  font-size: 11px;
  text-align:center;
  padding: 7px 0;
  border-radius: 12px;
  color: rgba(11,22,48,.78);
  background: rgba(255,255,255,.66);
  border: 1px solid rgba(31,79,163,.08);
}
.calMuted{ opacity:.28; background: transparent; border-color: transparent; }
.calHit{
  position:relative;
  font-weight: 800;
  color: rgba(11,22,48,.92);
  background: rgba(207,224,255,.65);
  border-color: rgba(47,103,211,.22);
}
.calHit::after{
  content:"";
  position:absolute;
  inset:-2px;
  border-radius: 999px;
  border: 2px solid rgba(47,103,211,.48);
}

/* Buttons */
.btnRow{ display:flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
.pillBtn{
  border: 1px solid rgba(31,79,163,.22);
  background: rgba(255,255,255,.70);
  color: rgba(11,22,48,.90);
  font-family: Cinzel, serif;
  letter-spacing: .14em;
  text-transform: uppercase;
  font-size: 10px;
  padding: 10px 12px;
  border-radius: 999px;
  cursor:pointer;
  box-shadow: var(--shadow2);
  transition: transform .15s ease, background .2s ease, border-color .2s ease;
}
.pillBtn:hover{ background: rgba(207,224,255,.55); border-color: rgba(47,103,211,.28); }
.pillBtn:active{ transform: scale(.99); }
.pillBtn:disabled{ opacity:.6; cursor:not-allowed; }
.pillBtn.solid{
  background: rgba(47,103,211,.92);
  color: rgba(255,255,255,.96);
  border-color: rgba(47,103,211,.30);
}
.pillBtn.solid:hover{ background: rgba(47,103,211,.84); }


/* Timeline */
.timeline{
  margin-top: 12px;
  display:flex;
  flex-direction:column;
  gap: 10px;
}
.tlItem{
  display:grid;
  grid-template-columns: 12px 1fr auto;
  gap: 10px;
  align-items:flex-start;
  padding: 10px 10px;
  border-radius: 16px;
  border: 1px solid var(--line2);
  background: rgba(255,255,255,.70);
}
.tlDot{
  width: 10px; height: 10px;
  margin-top: 6px;
  border-radius: 999px;
  background: rgba(47,103,211,.88);
  box-shadow: 0 0 0 6px rgba(47,103,211,.12);
}
.tlTitle{
  font-family: "Playfair Display", serif;
  font-weight: 600;
  color: rgba(11,22,48,.92);
}
.tlText{
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(11,22,48,.70);
}
.tlTime{
  font-family: Cinzel, serif;
  font-size: 10px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(11,22,48,.70);
  padding-top: 2px;
}

/* Map */
.mapFrame{
  margin-top: 10px;
  border-radius: 16px;
  overflow:hidden;
  border: 1px solid var(--line2);
  height: 320px;
  background: rgba(255,255,255,.75);
}
.mapFrame iframe{ width:100%; height:100%; border:0; }

/* Text body */
.textBody{
  margin-top: 12px;
  font-size: 12px;
  line-height: 1.75;
  color: rgba(11,22,48,.74);
}

/* Palette row */
.paletteRow{
  margin-top: 14px;
  display:flex;
  gap: 10px;
  flex-wrap: wrap;
}
.palSwatch{
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: 1px solid rgba(31,79,163,.14);
  box-shadow: var(--shadow2);
}
.palSwatch.s1{ background: #ffffff; }
.palSwatch.s2{ background: #f0f6ff; }
.palSwatch.s3{ background: #cfe0ff; }
.palSwatch.s4{ background: #8cb2ff; }
.palSwatch.s5{ background: #2f67d3; }

/* Dress photo */
.dressPhoto{
  margin-top: 10px;
  border-radius: 16px;
  overflow:hidden;
  border: 1px solid var(--line2);
  aspect-ratio: 3 / 4;
  background: rgba(255,255,255,.78);
}
.dressPhoto img{
  width:100%;
  height:100%;
  object-fit: contain;
  display:block;
}

/* Gifts */
.giftGrid{
  margin-top: 18px;
  display:grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 14px;
}
.noteTitle{
  margin-top: 10px;
  font-family: "Playfair Display", serif;
  font-size: 18px;
  color: rgba(11,22,48,.92);
}

/* Bank */
.bankTop{ display:flex; align-items:center; gap: 10px; margin-top: 10px; }
.bankBadge{
  width: 52px; height: 52px;
  border-radius: 18px;
  display:grid; place-items:center;
  font-family: "Playfair Display", serif;
  font-weight: 700;
  color: rgba(255,255,255,.96);
  background: rgba(47,103,211,.92);
  border: 1px solid rgba(47,103,211,.20);
  box-shadow: var(--shadow2);
}
.bankName{
  font-family: "Playfair Display", serif;
  font-weight: 600;
  letter-spacing: .02em;
  color: rgba(11,22,48,.92);
}
.bankType{
  margin-top: 6px;
  font-family: Cinzel, serif;
  letter-spacing: .14em;
  text-transform: uppercase;
  font-size: 10px;
  color: rgba(11,22,48,.65);
}
.bankGrid{
  margin-top: 12px;
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.bankItem{
  border-radius: 14px;
  border: 1px solid var(--line2);
  background: rgba(255,255,255,.70);
  padding: 10px 10px;
}
.bankLbl{
  font-family: Cinzel, serif;
  letter-spacing: .14em;
  text-transform: uppercase;
  font-size: 10px;
  color: rgba(11,22,48,.62);
}
.bankVal{
  margin-top: 8px;
  font-size: 13px;
  color: rgba(11,22,48,.92);
  font-weight: 700;
  word-break: break-word;
}

/* Carousel (light theme) */
.cfw{ margin-top: 14px; }
.cfwTopRow{
  margin-top: 10px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 0 2px;
}
.cfwTitle{
  font-family: "Playfair Display", serif;
  font-weight: 600;
  letter-spacing: .02em;
  color: rgba(11,22,48,.92);
}
.cfwCount{
  font-family: Cinzel, serif;
  font-size: 10px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(11,22,48,.62);
}
.cfwCount strong{ color: rgba(11,22,48,.92); }

.cfwShell{
  position:relative;
  margin-top: 10px;
  border-radius: 22px;
  border: 1px solid var(--line2);
  background: rgba(255,255,255,.75);
  box-shadow: var(--shadow2);
  padding: 14px 8px;
  overflow:hidden;
}
.cfwTrack{
  display:flex;
  gap: 14px;
  overflow-x:auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding: 4px 52px 14px;
}
.cfwTrack::-webkit-scrollbar{ height: 8px; }
.cfwTrack::-webkit-scrollbar-thumb{ background: rgba(11,22,48,.14); border-radius: 999px; }

.cfwSlide{
  scroll-snap-align: center;
  flex: 0 0 min(62%, 360px);
  transition: transform .25s ease, opacity .25s ease;
  opacity: .70;
  transform: scale(.90);
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}
.cfwSlide.isActive{ opacity: 1; transform: scale(1); }
.cfwCard{
  position:relative;
  border-radius: 22px;
  overflow:hidden;
  border: 1px solid var(--line2);
  box-shadow: var(--shadow2);
  background: rgba(255,255,255,.78);
  aspect-ratio: 4 / 3;
}
.cfwCard img{
  width:100%;
  height:100%;
  object-fit: cover;
  display:block;
  transform: scale(1.02);
  transition: transform .35s ease;
}
.cfwSlide.isActive .cfwCard img{ transform: scale(1.06); }
.cfwGlass{
  position:absolute; inset:0;
  background: radial-gradient(700px 360px at 50% 0%, rgba(255,255,255,.22), transparent 60%);
  pointer-events:none;
}
.cfwArrow{
  position:absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 1px solid rgba(31,79,163,.18);
  background: rgba(255,255,255,.82);
  cursor:pointer;
  display:grid;
  place-items:center;
  box-shadow: var(--shadow2);
  z-index: 5;
  font-size: 22px;
  color: rgba(11,22,48,.86);
}
.cfwArrow.left{ left: 10px; }
.cfwArrow.right{ right: 10px; }

.cfwThumbs{
  margin-top: 10px;
  display:flex;
  justify-content:center;
  gap: 10px;
  flex-wrap: wrap;
}
.cfwThumb{
  width: 46px;
  height: 46px;
  border-radius: 14px;
  border: 1px solid rgba(31,79,163,.14);
  background: rgba(255,255,255,.78);
  padding: 0;
  overflow:hidden;
  cursor:pointer;
  box-shadow: var(--shadow2);
  opacity: .80;
  transform: scale(.98);
  transition: transform .15s ease, opacity .15s ease, border-color .15s ease;
}
.cfwThumb img{
  width:100%;
  height:100%;
  object-fit: cover;
  display:block;
}
.cfwThumb.on{
  opacity: 1;
  transform: scale(1);
  border-color: rgba(47,103,211,.35);
}
.cfwHint{
  margin-top: 10px;
  text-align:center;
  font-size: 11px;
  color: rgba(11,22,48,.62);
}

/* RSVP shell */
.rsvpShell{
  margin-top: 18px;
  border-radius: 22px;
  background: rgba(255,255,255,.74);
  border: 1px solid var(--line2);
  padding: 16px 14px 12px;
  box-shadow: var(--shadow2);
}

/* Form */
.form{ margin-top: 8px; }
.grid2{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.field{ display:flex; flex-direction:column; gap: 6px; }
.label{
  font-family: Cinzel, serif;
  font-size: 10px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(11,22,48,.78);
}
.input, .textarea, select.input{
  width: 100%;
  border-radius: 14px;
  border: 1px solid rgba(31,79,163,.18);
  background: rgba(255,255,255,.88);
  padding: 10px 12px;
  outline:none;
  font-size: 13px;
  color: rgba(11,22,48,.92);
  box-shadow: 0 10px 20px rgba(10,33,74,.06);
}
.input::placeholder, .textarea::placeholder{ color: rgba(11,22,48,.45); }
.input:focus, .textarea:focus{
  border-color: rgba(47,103,211,.38);
  box-shadow: 0 14px 34px rgba(47,103,211,.12);
}
.textarea{ min-height: 86px; resize: vertical; }
.hint{ font-size: 11px; color: rgba(11,22,48,.55); margin-top: -2px; }

/* Footer */
.footer{ padding: 16px 0 6px; text-align:center; }
.mono{
  font-family: Cinzel, serif;
  letter-spacing: .28em;
  font-weight: 600;
  color: rgba(11,22,48,.86);
}
.footerLine{
  margin-top: 10px;
  font-family: Cinzel, serif;
  font-size: 10px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(11,22,48,.65);
}
.footerSmall{
  margin-top: 10px;
  font-size: 10px;
  color: rgba(11,22,48,.55);
}

/* Lightbox */
.lightbox{
  position:fixed;
  inset:0;
  background: rgba(11,22,48,.55);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 6000;
  display:grid;
  place-items:center;
  padding: 18px 14px;
}
.lightboxInner{
  width: min(980px, 96vw);
  border-radius: 22px;
  background: rgba(255,255,255,.88);
  border: 1px solid rgba(31,79,163,.14);
  box-shadow: 0 24px 90px rgba(0,0,0,.20);
  overflow:hidden;
}
.lightboxInner img{
  width:100%;
  height:auto;
  display:block;
  max-height: 74vh;
  object-fit: contain;
  background: rgba(11,22,48,.08);
}
.lightboxRow{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap: 10px;
  padding: 12px;
  flex-wrap: wrap;
}
.lightboxIndex{
  font-family: Cinzel, serif;
  letter-spacing: .14em;
  text-transform: uppercase;
  font-size: 10px;
  color: rgba(11,22,48,.70);
}

/* Responsive */
@media (max-width: 880px){
  .layoutSplit{ grid-template-columns: 1fr; }
  .giftGrid{ grid-template-columns: 1fr; }
}
@media (max-width: 520px){
  .grid2{ grid-template-columns: 1fr; }
  .bankGrid{ grid-template-columns: 1fr; }
  .rail, .navDots{ display:none; }
}

/* Reduce motion */
@media (prefers-reduced-motion: reduce){
  *{ scroll-behavior:auto !important; animation: none !important; transition: none !important; }
}
`;