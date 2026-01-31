import React, { useEffect, useMemo, useRef, useState } from "react";
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
  //notes?: string | null;
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
    const els = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];
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
  // YYYYMMDDTHHMMSSZ
  const iso = d.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
  const y = iso.slice(0, 4);
  const m = iso.slice(5, 7);
  const day = iso.slice(8, 10);
  const hh = iso.slice(11, 13);
  const mm = iso.slice(14, 16);
  const ss = iso.slice(17, 19);
  return `${y}${m}${day}T${hh}${mm}${ss}Z`;
}
function icsEscape(s: string) {
  // Escape \ , ; and newlines per iCalendar
  return s
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\r?\n/g, "\\n");
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

  // Google expects YYYYMMDDTHHMMSSZ/YYYYMMDDTHHMMSSZ
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
 *  Section: reveal + soft parallax
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

  const y = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 26, 0]);
  const opacity = useTransform(scrollYProgress, [0, 1], [reduce ? 1 : 0, 1]);
  const scale = useTransform(scrollYProgress, [0, 1], [reduce ? 1 : 0.985, 1]);

  const yS = useSpring(y, { stiffness: 140, damping: 22, mass: 0.9 });
  const oS = useSpring(opacity, { stiffness: 120, damping: 20 });
  const sS = useSpring(scale, { stiffness: 140, damping: 22 });

  return (
    <motion.section
      id={id}
      ref={ref as any}
      className="sheet"
      style={{
        y: yS,
        opacity: oS,
        scale: sS,
        ["--sheetBg" as any]: bgImage ? `url(${bgImage})` : "none",
      }}
      data-hasbg={bgImage ? "1" : "0"}
    >
      <div className="sheetInner">
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

  return (
    <div className="cfw">
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

      <div className="cfwDots" aria-label="Indicador de carrusel">
        {images.map((_, i) => (
          <span key={i} className={`dot2 ${i === active ? "on" : ""}`} />
        ))}
      </div>

      <div className="cfwHint">Toca una foto para verla en pantalla completa</div>
    </div>
  );
}

/** =======================
 *  Confetti (soft + elegant)
 *  ======================= */
function ConfettiBurst({ show }: { show: boolean }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(() => {
    const arr = Array.from({ length: 24 }).map((_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 260,
      y: 220 + Math.random() * 180,
      r: (Math.random() - 0.5) * 240,
      s: 0.6 + Math.random() * 0.8,
      d: 0.6 + Math.random() * 0.45,
      o: 0.6 + Math.random() * 0.35,
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
 *  Page
 *  ======================= */
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
      addressLine: "(Dirección exacta aquí)",
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

      pinterestUrl:
        "https://www.pinterest.com/search/pins/?q=outfits%20boda%20formal%20elegante%20hombre%20mujer",

      dressExample:
        "https://uqqrxkeevstxawzycyzc.supabase.co/storage/v1/object/public/fotos/Dress%20code%20formal%20boda%20(1).jpg",

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

  /** Fonts */
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
  const SECTION_IDS = useMemo(
    () => ["nuestra-boda", "momentos", "ceremonia", "vestimenta", "regalos", "rsvp"],
    []
  );
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

  /** ✅ FIX: Floating buttons contrast (light on hero, dark after hero) */
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

  /** ✅ Calendar button actions */
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

  /** RSVP */
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    guests: 1,
    kids: false,
    kids_count: 0,
    //notes: "",
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
  //notes: form.notes.trim() ? form.notes.trim() : null,
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
      //notes: "",
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
      <audio ref={audioRef} src={WEDDING.musicSrc} preload="auto" />

      {/* Background */}
      <div className="bg" />
      <div className="paperTex" />
      <div className="grain" aria-hidden="true" />

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

      {/* ✅ Floating chips with auto-contrast */}
      <div className={`floating ${floatingMode === "dark" ? "floatingDark" : "floatingLight"}`}>
        <button className="chip" onClick={toggleMusic} type="button" title="Música">
          <span className="chipDot" data-on={musicOn ? "1" : "0"} />
          {musicOn ? "Música" : "Sonido"}
        </button>

        <button
          className="chip"
          onClick={() => scrollToId("nuestra-boda")}
          type="button"
          title="Ver invitación"
        >
          Ver invitación ↓
        </button>

        {/* ✅ Add to calendar quick access */}
        <button className="chip" onClick={addToCalendarICS} type="button" title="Agregar al calendario">
          Agregar al calendario
        </button>
      </div>

      {/* HERO */}
      <section className="hero" ref={heroRef}>
        <motion.div className="heroPhoto" style={{ scale: heroImgScale }}>
          <img src={WEDDING.heroPhoto} alt="Junior y Glenny" />
          <motion.div className="heroShade" style={{ opacity: heroShadeO }} />
        </motion.div>

        <motion.div className="heroCenter" style={{ y: badgeY, opacity: badgeO }}>
          <div className="heroBadge">
            <div className="heroNames">
              <TypeReveal text={WEDDING.couple} delay={0.05} />
            </div>

            <div className="heroLine">
              <TypeReveal
                text="DESPUÉS DE TANTOS AÑOS JUNTOS LO HEMOS DECIDIDO…"
                delay={0.12}
                stagger={0.012}
              />
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

            {!musicReady && (
              <div className="heroTip">
                Tip: toca “Sonido” para activar la música (autoplay suele bloquearse).
              </div>
            )}
          </div>
        </motion.div>
      </section>

      {/* CONTENT */}
      <main className="content">
        {/* 1) Nuestra boda */}
        <SheetSection id="nuestra-boda" bgImage={WEDDING.sectionBg1} watermark={WEDDING.initials}>
          <HeaderScript title="Nuestra Boda" />
          <div className="subcaps">{formatDateDMY(WEDDING.dateISO)}</div>

          <div className="countWrap">
            <CountdownBig d={count.d} h={count.h} m={count.m} s={count.s} />
          </div>

          <div className="calendarCard">
            <div className="calTitle">{WEDDING.monthTitle}</div>
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
          </div>

          {/* ✅ Add to calendar inside section too */}
          <div className="btnRow" style={{ marginTop: 14 }}>
            <button className="pillBtn" onClick={addToGoogleCalendar} type="button">
              Google Calendar
            </button>
            <button className="pillBtn solid" onClick={addToCalendarICS} type="button">
              Descargar .ics
            </button>
          </div>
        </SheetSection>

        {/* 2) Momentos */}
        <SheetSection id="momentos" bgImage={WEDDING.sectionBg2} watermark="LOVE">
          <HeaderScript title="Momentos" subtitle="Un vistazo a nuestros recuerdos antes del gran día." />

          <CoverflowCarousel images={WEDDING.carousel} onOpen={(src, i) => setLightbox({ src, i })} />
        </SheetSection>

        {/* 3) Ceremonia */}
        <SheetSection id="ceremonia" bgImage={WEDDING.sectionBg3} watermark="RSVP">
          <HeaderScript title="Ceremonia" />

          <div className="infoBlock">
            <div className="infoLine">{WEDDING.venue}</div>
            <div className="infoLine">{WEDDING.city}</div>
            <div className="infoLine">{WEDDING.time}</div>
            <div className="infoText">{WEDDING.addressLine}</div>

            <div className="mapCard">
              <div className="mapTop">
                <div className="mapTitle">Detalles</div>
                <div className="mapBtns">
                  <button className="pillBtn" onClick={addToGoogleCalendar} type="button">
                    Agregar al calendario
                  </button>
                  <button className="pillBtn" onClick={openMaps} type="button">
                    Abrir ubicación
                  </button>
                </div>
              </div>

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

        {/* 4) Vestimenta */}
        <SheetSection id="vestimenta" watermark="DRESS">
          <HeaderScript title="Código de vestimenta" />

          <p className="textMuted">
            <span className="capsStrong">Formal-elegante.</span> Tonos suaves; por favor evitar el color blanco.
          </p>

          <div className="dressCard">
            <div className="dressPhoto">
              <img src={WEDDING.dressExample} alt="Ejemplo vestimenta formal elegante" loading="lazy" />
              <div className="dressTag">Inspiración</div>
            </div>

            <div className="btnRow">
              <button
                className="pillBtn"
                onClick={() => window.open(WEDDING.pinterestUrl, "_blank")}
                type="button"
              >
                Ver en Pinterest
              </button>
            </div>
          </div>
        </SheetSection>

        {/* 5) Regalos / Banco */}
        <SheetSection id="regalos" watermark={WEDDING.initials}>
          <HeaderScript
            title="Detalle"
            subtitle="Tu presencia es lo mas importante para nosotros, pero si deseas colaborar con nuestra luna de miel, este es nuestro numero de cuenta (opcional)."
          />

          <div className="giftCard">

            <div className="bankCard">
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

              <div className="btnRow">
                <button className="pillBtn" onClick={copyBank} type="button">
                  Copiar cuenta
                </button>
              </div>
            </div>
          </div>
        </SheetSection>

        {/* 6) RSVP */}
        <SheetSection id="rsvp" watermark={WEDDING.initials}>
          <HeaderScript
            title="Confirmación de asistencia"
            subtitle="Por favor confirma tu asistencia llenando este formulario."
          />

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

            <div className="btnRow">
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
                <button className="pillBtn" onClick={() => setLightbox(null)} type="button">
                  Cerrar
                </button>
                <div className="lightboxIndex">
                  {lightbox.i + 1} / {WEDDING.carousel.length}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
      <div className="countTop"></div>

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
 *  Styles
 *  ======================= */
const styles = `
:root{
  --ink:#0b0d16;
  --navy:#0D1546;
  --paper:#FBFBFD;
  --fog:#EEF2F8;
  --sand:#D6B37A;
  --border: rgba(13,21,70,.14);
  --border2: rgba(13,21,70,.10);
  --glass: rgba(255,255,255,.18);

  --shadowSoft: 0 18px 70px rgba(2,2,11,.14);
  --shadowTiny: 0 12px 34px rgba(2,2,11,.10);
}

*{ box-sizing:border-box; }
html{ scroll-behavior:smooth; }
body{
  margin:0;
  background: #f6f7fb;
  color: var(--ink);
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}

/* Background */
.bg{
  position:fixed; inset:0; z-index:-10;
  background:
    radial-gradient(900px 520px at 12% 8%, rgba(119,154,191,.18) 0%, transparent 70%),
    radial-gradient(900px 520px at 88% 12%, rgba(82,113,161,.18) 0%, transparent 70%),
    radial-gradient(900px 520px at 50% 100%, rgba(45,72,130,.14) 0%, transparent 70%),
    linear-gradient(180deg, rgba(255,255,255,.92), rgba(246,247,251,.92));
}
.paperTex{
  position:fixed; inset:0; z-index:-9;
  opacity:.12;
  background-image: radial-gradient(circle at 1px 1px, rgba(13,21,70,.25) 1px, transparent 0);
  background-size: 18px 18px;
  mix-blend-mode:multiply;
  pointer-events:none;
}
.grain{
  position:fixed; inset:0; z-index:-8; pointer-events:none;
  opacity:.09;
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='260' height='260' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E");
  background-size: 240px 240px;
  mix-blend-mode:multiply;
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
  box-shadow: 0 18px 50px rgba(2,2,11,.18);
  border: 1px solid rgba(13,21,70,.12);
  background: rgba(255,255,255,.92);
  color: rgba(13,21,70,.86);
}
.toast.ok{ border-color: rgba(214,179,122,.55); }
.toast.err{ border-color: rgba(220,80,80,.35); }

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
  border: 1px solid rgba(13,21,70,.10);
  background: rgba(214,179,122,.55);
  box-shadow: 0 14px 30px rgba(2,2,11,.12);
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

/* ✅ FIX: two modes */
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
  box-shadow: 0 16px 44px rgba(2,2,11,.16);
  transition: background .2s ease, border-color .2s ease, color .2s ease, transform .15s ease;
}
.chip:active{ transform: scale(.99); }

.floatingLight .chip{
  border: 1px solid rgba(255,255,255,.48);
  background: rgba(255,255,255,.16);
  color: rgba(255,255,255,.92);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.floatingDark .chip{
  border: 1px solid rgba(13,21,70,.16);
  background: rgba(255,255,255,.92);
  color: rgba(13,21,70,.86);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 16px 44px rgba(2,2,11,.10);
}

.chipDot{
  width: 8px; height: 8px; border-radius: 999px;
  background: rgba(255,255,255,.55);
  box-shadow: 0 0 0 6px rgba(255,255,255,.08);
}
.floatingDark .chipDot{
  background: rgba(13,21,70,.28);
  box-shadow: 0 0 0 6px rgba(13,21,70,.06);
}
.chipDot[data-on="1"]{
  background: rgba(214,179,122,.95) !important;
  box-shadow: 0 0 0 6px rgba(214,179,122,.18) !important;
}

/* Right rail progress */
.rail{
  position:fixed;
  top: 90px;
  right: 10px;
  width: 3px;
  height: 180px;
  border-radius: 999px;
  background: rgba(255,255,255,.18);
  border: 1px solid rgba(255,255,255,.18);
  backdrop-filter: blur(10px);
  z-index: 2800;
  overflow:hidden;
}
.railFill{
  transform-origin: top;
  width: 100%;
  height: 100%;
  background: rgba(214,179,122,.85);
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
  border: 1px solid rgba(255,255,255,.46);
  background: rgba(255,255,255,.14);
  backdrop-filter: blur(10px);
  cursor:pointer;
}
.navDot.on{
  background: rgba(214,179,122,.92);
  border-color: rgba(214,179,122,.72);
}

/* HERO */
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
    radial-gradient(900px 520px at 50% 55%, rgba(0,0,0,.10) 0%, rgba(0,0,0,.40) 70%),
    linear-gradient(180deg, rgba(0,0,0,.48), rgba(0,0,0,.35));
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
  border-radius: 26px;
  padding: 18px 16px;
  background: rgba(255,255,255,.14);
  border: 1px solid rgba(255,255,255,.40);
  box-shadow: 0 22px 70px rgba(2,2,11,.30);
  -webkit-backdrop-filter: blur(18px);
}
.heroNames{
  font-family: "Great Vibes", cursive;
  font-size: clamp(44px, 8vw, 78px);
  line-height: 1;
  color: rgba(255,255,255,.96);
  text-shadow: 0 18px 40px rgba(2,2,11,.40);
}
.heroLine{
  margin-top: 10px;
  font-family: Cinzel, serif;
  font-size: 11px;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: rgba(255,255,255,.86);
  text-shadow: 0 18px 40px rgba(2,2,11,.35);
}
.heroBig{
  margin-top: 10px;
  font-family: "Great Vibes", cursive;
  font-size: clamp(34px, 6vw, 56px);
  color: rgba(255,255,255,.94);
  text-shadow: 0 18px 40px rgba(2,2,11,.35);
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
  border: 1px solid rgba(255,255,255,.40);
  background: rgba(255,255,255,.14);
  color: rgba(255,255,255,.92);
  font-family: Cinzel, serif;
  letter-spacing: .12em;
  text-transform: uppercase;
  font-size: 10px;
  backdrop-filter: blur(12px);
}
.heroBtn{
  margin-top: 14px;
  border: 1px solid rgba(255,255,255,.45);
  background: rgba(255,255,255,.14);
  color: rgba(255,255,255,.92);
  font-family: Cinzel, serif;
  letter-spacing: .14em;
  text-transform: uppercase;
  font-size: 10px;
  padding: 10px 12px;
  border-radius: 999px;
  cursor:pointer;
  backdrop-filter: blur(12px);
  box-shadow: 0 16px 44px rgba(2,2,11,.18);
}
.heroTip{
  margin-top: 10px;
  font-size: 11px;
  color: rgba(255,255,255,.82);
  text-shadow: 0 12px 30px rgba(2,2,11,.35);
}

/* CONTENT */
.content{
  padding: 26px 14px 60px;
  display:flex;
  flex-direction:column;
  gap: 18px;
}

/* SHEETS */
.sheet{
  width: min(980px, 100%);
  margin: 0 auto;
  border-radius: 30px;
  border: 1px solid var(--border2);
  background: rgba(255,255,255,.90);
  box-shadow: var(--shadowSoft);
  overflow:hidden;
  position:relative;
}

/* background photo blur behind the white card */
.sheet[data-hasbg="1"]::before{
  content:"";
  position:absolute;
  inset:-20px;
  background-image: var(--sheetBg);
  background-size: cover;
  background-position: center;
  filter: blur(14px) saturate(.95);
  opacity: .18;
  transform: scale(1.06);
}
.sheet[data-hasbg="1"]::after{
  content:"";
  position:absolute;
  inset:0;
  background: linear-gradient(180deg, rgba(255,255,255,.95), rgba(255,255,255,.86));
  opacity: .88;
}
.sheetInner{
  position:relative;
  padding: 18px 16px 18px;
  z-index: 2;
}

/* watermark */
.watermark{
  position:absolute;
  inset:auto 0 6px 0;
  text-align:center;
  font-family: "Playfair Display", serif;
  font-size: clamp(74px, 15vw, 160px);
  letter-spacing: .08em;
  color: rgba(13,21,70,.06);
  pointer-events:none;
  user-select:none;
}

/* Head */
.head{ text-align:center; }
.title{
  font-family: "Great Vibes", cursive;
  font-size: 42px;
  line-height: 1;
  color: rgba(13,21,70,.84);
}
.divider{
  width: 74px;
  height: 1px;
  margin: 10px auto 0;
  background: rgba(13,21,70,.18);
}
.subcaps{
  margin-top: 10px;
  text-align:center;
  font-family: Cinzel, serif;
  font-size: 12px;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: rgba(13,21,70,.70);
}
.textMuted{
  margin: 10px auto 0;
  font-size: 12px;
  line-height: 1.7;
  color: rgba(2,2,11,.62);
  text-align:center;
  max-width: 720px;
}
.capsStrong{
  font-family: Cinzel, serif;
  letter-spacing: .16em;
  text-transform: uppercase;
  font-weight: 600;
  color: rgba(13,21,70,.78);
}

/* Countdown Big */
.countWrap{ margin-top: 14px; display:flex; justify-content:center; }
.countdown{
  width: min(720px, 100%);
  border-radius: 20px;
  border: 1px solid rgba(13,21,70,.10);
  background: rgba(255,255,255,.78);
  box-shadow: 0 14px 36px rgba(2,2,11,.08);
  padding: 14px 12px;
}
.countDigits{
  margin-top: 12px;
  display:flex;
  align-items:flex-end;
  justify-content:center;
  gap: 10px;
  flex-wrap: wrap;
}
.colon{
  font-family: "Playfair Display", serif;
  font-size: 26px;
  color: rgba(13,21,70,.45);
  margin-bottom: 10px;
}
.digitBlock{
  min-width: 86px;
  border-radius: 16px;
  border: 1px solid rgba(13,21,70,.08);
  background: rgba(255,255,255,.78);
  padding: 10px 10px;
  text-align:center;
}
.digit{
  font-family: "Playfair Display", serif;
  font-size: 28px;
  letter-spacing: .06em;
  color: rgba(13,21,70,.86);
}
.digitLbl{
  margin-top: 6px;
  font-family: Cinzel, serif;
  font-size: 10px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(13,21,70,.55);
}

/* Calendar */
.calendarCard{
  margin-top: 14px;
  border-radius: 18px;
  border: 1px solid rgba(13,21,70,.10);
  background: rgba(255,255,255,.78);
  padding: 12px 10px;
  box-shadow: 0 14px 36px rgba(2,2,11,.08);
}
.calTitle{
  text-align:center;
  font-family: Cinzel, serif;
  font-size: 12px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(13,21,70,.70);
}
.calGrid{
  display:grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  margin-top: 10px;
}
.calDow{
  font-family: Cinzel, serif;
  font-size: 10px;
  text-align:center;
  opacity:.75;
  color: rgba(13,21,70,.70);
}
.calDay{
  font-family: system-ui, sans-serif;
  font-size: 11px;
  text-align:center;
  padding: 7px 0;
  border-radius: 12px;
  color: rgba(13,21,70,.76);
}
.calMuted{ opacity:.30; }
.calHit{
  position:relative;
  font-weight: 700;
}
.calHit::after{
  content:"";
  position:absolute;
  inset:-2px;
  border-radius: 999px;
  border: 2px solid rgba(214,179,122,.85);
  box-shadow: 0 10px 22px rgba(214,179,122,.18);
}

/* Info block */
.infoBlock{ margin-top: 10px; }
.infoLine{
  text-align:center;
  font-family: "Playfair Display", serif;
  font-size: 18px;
  color: rgba(13,21,70,.80);
  margin-top: 6px;
}
.infoText{
  margin-top: 10px;
  text-align:center;
  font-size: 12px;
  color: rgba(2,2,11,.60);
  line-height: 1.7;
}

/* Map */
.mapCard{
  margin-top: 14px;
  border-radius: 18px;
  border: 1px solid rgba(13,21,70,.10);
  background: rgba(255,255,255,.72);
  box-shadow: 0 14px 36px rgba(2,2,11,.08);
  padding: 12px;
}
.mapTop{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.mapTitle{
  font-family: "Playfair Display", serif;
  font-weight: 600;
  letter-spacing: .06em;
  color: rgba(13,21,70,.80);
}
.mapBtns{
  display:flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content:flex-end;
}
.mapFrame{
  margin-top: 10px;
  border-radius: 14px;
  overflow:hidden;
  border: 1px solid rgba(13,21,70,.10);
  height: 280px;
}
.mapFrame iframe{ width:100%; height:100%; border:0; }

/* Buttons */
.btnRow{ display:flex; justify-content:center; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
.pillBtn{
  border: 1px solid rgba(13,21,70,.16);
  background: rgba(255,255,255,.78);
  color: rgba(13,21,70,.82);
  font-family: Cinzel, serif;
  letter-spacing: .14em;
  text-transform: uppercase;
  font-size: 10px;
  padding: 10px 12px;
  border-radius: 999px;
  cursor:pointer;
  box-shadow: 0 14px 38px rgba(2,2,11,.10);
  transition: transform .15s ease, background .2s ease;
}
.pillBtn:hover{ background: rgba(230,208,169,.22); }
.pillBtn:active{ transform: scale(.99); }
.pillBtn:disabled{ opacity:.6; cursor:not-allowed; }
.pillBtn.solid{
  background: rgba(13,21,70,.92);
  color: rgba(255,255,255,.92);
  border-color: rgba(13,21,70,.18);
}
.pillBtn.solid:hover{ background: rgba(13,21,70,.88); }

/* Dress */
.dressCard{
  margin-top: 14px;
  border-radius: 18px;
  border: 1px solid rgba(13,21,70,.10);
  background: rgba(255,255,255,.72);
  box-shadow: 0 14px 36px rgba(2,2,11,.08);
  padding: 12px;
}
.dressPhoto{
  position:relative;
  border-radius: 14px;
  overflow:hidden;
  border: 1px solid rgba(13,21,70,.10);
  aspect-ratio: 3 / 4;
  background: rgba(255,255,255,.88);
}
.dressPhoto img{
  width:100%;
  height:100%;
  object-fit: contain;
  display:block;
}
.dressTag{
  position:absolute;
  left: 12px;
  bottom: 12px;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid rgba(13,21,70,.14);
  background: rgba(255,255,255,.86);
  color: rgba(13,21,70,.82);
  font-family: Cinzel, serif;
  letter-spacing: .14em;
  text-transform: uppercase;
  font-size: 10px;
  box-shadow: 0 10px 24px rgba(2,2,11,.10);
}

/* Gift/bank */
.giftCard{ margin-top: 12px; }
.bankCard{
  margin-top: 12px;
  border-radius: 18px;
  border: 1px solid rgba(13,21,70,.10);
  background: rgba(255,255,255,.72);
  box-shadow: 0 14px 36px rgba(2,2,11,.08);
  padding: 14px 12px;
}
.bankTop{ display:flex; align-items:center; gap: 10px; }
.bankBadge{
  width: 52px; height: 52px;
  border-radius: 18px;
  display:grid; place-items:center;
  font-family: "Playfair Display", serif;
  font-weight: 600;
  color: rgba(13,21,70,.82);
  background: rgba(255,255,255,.75);
  border: 1px solid rgba(13,21,70,.12);
  box-shadow: 0 10px 24px rgba(2,2,11,.08);
}
.bankName{
  font-family: "Playfair Display", serif;
  font-weight: 600;
  letter-spacing: .06em;
  color: rgba(13,21,70,.82);
}
.bankType{
  margin-top: 6px;
  font-family: Cinzel, serif;
  letter-spacing: .14em;
  text-transform: uppercase;
  font-size: 10px;
  color: rgba(13,21,70,.60);
}
.bankGrid{
  margin-top: 12px;
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.bankItem{
  border-radius: 14px;
  border: 1px solid rgba(13,21,70,.08);
  background: rgba(255,255,255,.70);
  padding: 10px 10px;
}
.bankLbl{
  font-family: Cinzel, serif;
  letter-spacing: .14em;
  text-transform: uppercase;
  font-size: 10px;
  color: rgba(13,21,70,.58);
}
.bankVal{
  margin-top: 8px;
  font-size: 13px;
  color: rgba(13,21,70,.82);
  font-weight: 600;
  word-break: break-word;
}

/* Carousel */
.cfw{ margin-top: 14px; }
.cfwShell{
  position:relative;
  margin-top: 10px;
  border-radius: 18px;
  border: 1px solid rgba(13,21,70,.10);
  background: rgba(255,255,255,.70);
  box-shadow: 0 14px 36px rgba(2,2,11,.08);
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
.cfwTrack::-webkit-scrollbar-thumb{ background: rgba(13,21,70,.12); border-radius: 999px; }

.cfwSlide{
  scroll-snap-align: center;
  flex: 0 0 min(62%, 360px);
  transition: transform .25s ease, opacity .25s ease;
  opacity: .65;
  transform: scale(.88);
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}
.cfwSlide.isActive{
  opacity: 1;
  transform: scale(1);
}
.cfwCard{
  position:relative;
  border-radius: 18px;
  overflow:hidden;
  border: 1px solid rgba(13,21,70,.10);
  box-shadow: 0 18px 46px rgba(2,2,11,.14);
  background: rgba(255,255,255,.88);
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
  border: 1px solid rgba(13,21,70,.14);
  background: rgba(255,255,255,.88);
  cursor:pointer;
  display:grid;
  place-items:center;
  box-shadow: 0 12px 30px rgba(2,2,11,.12);
  z-index: 5;
  font-size: 22px;
  color: rgba(13,21,70,.72);
}
.cfwArrow.left{ left: 10px; }
.cfwArrow.right{ right: 10px; }
.cfwDots{
  display:flex;
  justify-content:center;
  gap: 8px;
  margin-top: 10px;
}
.dot2{
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: rgba(13,21,70,.20);
}
.dot2.on{ background: rgba(214,179,122,.95); }
.cfwHint{
  margin-top: 10px;
  text-align:center;
  font-size: 11px;
  color: rgba(2,2,11,.52);
}

/* Form */
.form{ margin-top: 14px; }
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
  color: rgba(13,21,70,.70);
}
.input, .textarea{
  width: 100%;
  border-radius: 14px;
  border: 1px solid rgba(13,21,70,.12);
  background: rgba(255,255,255,.86);
  padding: 10px 12px;
  outline:none;
  font-size: 13px;
  color: rgba(2,2,11,.76);
  box-shadow: 0 10px 26px rgba(2,2,11,.06);
}
.input:focus, .textarea:focus{
  border-color: rgba(214,179,122,.55);
  box-shadow: 0 14px 36px rgba(214,179,122,.12);
}
.textarea{ min-height: 86px; resize: vertical; }
.hint{ font-size: 11px; color: rgba(2,2,11,.50); margin-top: -2px; }

/* Footer */
.footer{ padding: 18px 0 6px; text-align:center; }
.mono{
  font-family: Cinzel, serif;
  letter-spacing: .28em;
  font-weight: 600;
  color: rgba(13,21,70,.78);
}
.footerLine{
  margin-top: 10px;
  font-family: Cinzel, serif;
  font-size: 10px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(13,21,70,.58);
}
.footerSmall{
  margin-top: 10px;
  font-size: 10px;
  color: rgba(13,21,70,.50);
}

/* Lightbox */
.lightbox{
  position:fixed;
  inset:0;
  background: rgba(2,2,11,.62);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 6000;
  display:grid;
  place-items:center;
  padding: 18px 14px;
}
.lightboxInner{
  width: min(980px, 96vw);
  border-radius: 22px;
  background: rgba(255,255,255,.92);
  border: 1px solid rgba(255,255,255,.22);
  box-shadow: 0 24px 90px rgba(0,0,0,.35);
  overflow:hidden;
}
.lightboxInner img{
  width:100%;
  height:auto;
  display:block;
  max-height: 74vh;
  object-fit: contain;
  background: rgba(255,255,255,.96);
}
.lightboxRow{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap: 10px;
  padding: 12px;
}
.lightboxIndex{
  font-family: Cinzel, serif;
  letter-spacing: .14em;
  text-transform: uppercase;
  font-size: 10px;
  color: rgba(13,21,70,.62);
}

/* Responsive */
@media (max-width: 520px){
  .grid2{ grid-template-columns: 1fr; }
  .bankGrid{ grid-template-columns: 1fr; }
  .mapTop{ flex-direction:column; align-items:stretch; }
  .mapBtns{ justify-content:flex-start; }
  .rail, .navDots{ display:none; }
}

/* Reduce motion */
@media (prefers-reduced-motion: reduce){
  *{ scroll-behavior:auto !important; animation: none !important; transition: none !important; }
}
`;