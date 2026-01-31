// src/pages/Admin.tsx
import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";

/**
 * ✅ Admin.tsx
 * - Ver lista de RSVPs (quienes confirmaron)
 * - Totales (personas, niños)
 * - Filtro simple por nombre/teléfono
 *
 * NOTA: Esto asume que tu tabla se llama "rsvps"
 * y tiene columnas: first_name, last_name, phone, guests, kids, kids_count, notes, created_at
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type RSVPRow = {
  id?: string;
  first_name: string;
  last_name: string;
  phone: string;
  guests: number;
  kids: boolean;
  kids_count: number;
  notes: string | null;
  created_at?: string;
};

export default function Admin() {
  const [rows, setRows] = useState<RSVPRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const totals = useMemo(() => {
    const totalGuests = rows.reduce((a, r) => a + (Number(r.guests) || 0), 0);
    const totalKids = rows.reduce((a, r) => a + (Number(r.kids_count) || 0), 0);
    const totalConfirmed = rows.length;
    return { totalGuests, totalKids, totalConfirmed };
  }, [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      `${r.first_name} ${r.last_name} ${r.phone}`.toLowerCase().includes(s)
    );
  }, [q, rows]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("rsvps")
        .select("id,first_name,last_name,phone,guests,kids,kids_count,notes,created_at")
        .order("created_at", { ascending: false });

      if (!alive) return;
      setLoading(false);

      if (error) {
        console.error(error);
        return;
      }
      setRows((data as RSVPRow[]) || []);
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=Great+Vibes&display=swap');
      `}</style>

      <div style={pageBg} />

      <div style={wrap}>
        <header style={header}>
          <div>
            <div style={title}>Admin RSVP</div>
            <div style={sub}>Junior & Glenny</div>
          </div>

          <div style={statsRow}>
            <Stat label="Confirmaciones" value={totals.totalConfirmed} />
            <Stat label="Personas" value={totals.totalGuests} />
            <Stat label="Niños" value={totals.totalKids} />
          </div>
        </header>

        <div style={toolbar}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o teléfono..."
            style={search}
          />
          <button
            onClick={async () => {
              setLoading(true);
              const { data, error } = await supabase
                .from("rsvps")
                .select("id,first_name,last_name,phone,guests,kids,kids_count,notes,created_at")
                .order("created_at", { ascending: false });
              setLoading(false);
              if (error) return console.error(error);
              setRows((data as RSVPRow[]) || []);
            }}
            style={btn}
          >
            Actualizar
          </button>
        </div>

        <AnimatePresence>
          {loading ? (
            <motion.div
              style={card}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              Cargando...
            </motion.div>
          ) : (
            <motion.div
              style={list}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {filtered.length === 0 ? (
                <div style={card}>No hay confirmaciones todavía.</div>
              ) : (
                filtered.map((r, i) => (
                  <motion.div
                    key={(r.id || "") + i}
                    style={card}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.2) }}
                  >
                    <div style={rowTop}>
                      <div style={name}>
                        {r.first_name} {r.last_name}
                      </div>
                      <div style={meta}>
                        {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
                      </div>
                    </div>

                    <div style={grid}>
                      <Info label="Teléfono" value={r.phone} />
                      <Info label="Personas" value={String(r.guests)} />
                      <Info label="Niños" value={String(r.kids_count || 0)} />
                      <Info label="Kids?" value={r.kids ? "Sí" : "No"} />
                    </div>

                    {r.notes ? <div style={notes}>Nota: {r.notes}</div> : null}
                  </motion.div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={stat}>
      <div style={statVal}>{value}</div>
      <div style={statLbl}>{label}</div>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={info}>
      <div style={infoLbl}>{label}</div>
      <div style={infoVal}>{value}</div>
    </div>
  );
}

const pageBg: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: -1,
  background:
    "radial-gradient(900px 520px at 12% 8%, rgba(119,154,191,.18) 0%, transparent 70%)," +
    "radial-gradient(900px 520px at 88% 12%, rgba(82,113,161,.18) 0%, transparent 70%)," +
    "linear-gradient(180deg, rgba(255,255,255,.92), rgba(246,247,251,.92))",
};

const wrap: React.CSSProperties = {
  width: "min(980px, 92vw)",
  margin: "22px auto 28px",
  fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  color: "rgba(13,21,70,.88)",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-end",
  flexWrap: "wrap",
};

const title: React.CSSProperties = {
  fontFamily: "Cinzel, serif",
  letterSpacing: ".18em",
  textTransform: "uppercase",
  fontWeight: 600,
  fontSize: 14,
};

const sub: React.CSSProperties = {
  marginTop: 8,
  fontFamily: "Great Vibes, cursive",
  fontSize: 36,
  color: "rgba(13,21,70,.78)",
};

const statsRow: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const stat: React.CSSProperties = {
  border: "1px solid rgba(13,21,70,.12)",
  background: "rgba(255,255,255,.78)",
  boxShadow: "0 14px 40px rgba(2,2,11,.10)",
  borderRadius: 18,
  padding: "12px 14px",
  minWidth: 140,
  textAlign: "center",
};

const statVal: React.CSSProperties = {
  fontFamily: "Cinzel, serif",
  fontWeight: 600,
  letterSpacing: ".06em",
  fontSize: 22,
};

const statLbl: React.CSSProperties = {
  marginTop: 6,
  fontFamily: "Cinzel, serif",
  fontSize: 10,
  letterSpacing: ".14em",
  textTransform: "uppercase",
  opacity: 0.75,
};

const toolbar: React.CSSProperties = {
  marginTop: 16,
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const search: React.CSSProperties = {
  flex: 1,
  minWidth: 240,
  borderRadius: 14,
  border: "1px solid rgba(13,21,70,.12)",
  padding: "12px 12px",
  background: "rgba(255,255,255,.85)",
  outline: "none",
  boxShadow: "0 10px 26px rgba(2,2,11,.06)",
};

const btn: React.CSSProperties = {
  borderRadius: 999,
  border: "1px solid rgba(214,179,122,.55)",
  background: "rgba(255,255,255,.78)",
  padding: "12px 14px",
  cursor: "pointer",
  fontFamily: "Cinzel, serif",
  letterSpacing: ".14em",
  textTransform: "uppercase",
  fontSize: 10,
  color: "rgba(13,21,70,.85)",
};

const list: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gap: 12,
};

const card: React.CSSProperties = {
  border: "1px solid rgba(13,21,70,.12)",
  background: "rgba(255,255,255,.82)",
  boxShadow: "0 14px 40px rgba(2,2,11,.10)",
  borderRadius: 22,
  padding: "14px 14px",
};

const rowTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "baseline",
  flexWrap: "wrap",
};

const name: React.CSSProperties = {
  fontFamily: "Cinzel, serif",
  letterSpacing: ".10em",
  textTransform: "uppercase",
  fontWeight: 600,
  fontSize: 12,
};

const meta: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
};

const grid: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(140px, 1fr))",
  gap: 10,
};

const info: React.CSSProperties = {
  border: "1px solid rgba(13,21,70,.10)",
  borderRadius: 16,
  padding: "10px 10px",
  background: "rgba(255,255,255,.70)",
};

const infoLbl: React.CSSProperties = {
  fontFamily: "Cinzel, serif",
  letterSpacing: ".14em",
  textTransform: "uppercase",
  fontSize: 10,
  opacity: 0.75,
};

const infoVal: React.CSSProperties = {
  marginTop: 8,
  fontWeight: 600,
};

const notes: React.CSSProperties = {
  marginTop: 10,
  fontSize: 12,
  opacity: 0.85,
};