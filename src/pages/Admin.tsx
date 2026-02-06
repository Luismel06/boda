// src/pages/Admin.tsx
import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "framer-motion";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type RSVPRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  created_at: string;
};

function fmtDate(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function initials(first: string, last: string) {
  const a = (first?.trim()?.[0] || "").toUpperCase();
  const b = (last?.trim()?.[0] || "").toUpperCase();
  return (a + b) || "JG";
}

export default function Admin() {
  // ============== AUTH ==============
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ============== DATA ==============
  const [rows, setRows] = useState<RSVPRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // ============== UI EXTRA ==============
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [selected, setSelected] = useState<RSVPRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ✅ modal confirm bonito
  const [confirming, setConfirming] = useState<RSVPRow | null>(null);

  const showToast = (type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    window.setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    let alive = true;

    async function initAuth() {
      setAuthLoading(true);
      const { data } = await supabase.auth.getSession();
      if (!alive) return;

      setSession(data.session ?? null);
      setAuthLoading(false);

      supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
      });
    }

    initAuth();
    return () => {
      alive = false;
    };
  }, []);

  const totals = useMemo(() => {
    const totalConfirmed = rows.length;
    const totalPeople = rows.length; // ✅ 1 persona por confirmación (sin acompañantes)
    return { totalConfirmed, totalPeople };
  }, [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => `${r.first_name} ${r.last_name} ${r.phone}`.toLowerCase().includes(s));
  }, [q, rows]);

  const load = async () => {
    setErrMsg(null);
    setLoading(true);

    const { data, error } = await supabase
      .from("rsvps")
      .select("id,first_name,last_name,phone,created_at")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      console.error(error);
      setErrMsg(error.message);
      showToast("err", error.message);
      return;
    }

    setRows((data as RSVPRow[]) || []);
  };

  useEffect(() => {
    if (!session) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setErrMsg(error.message);
      showToast("err", error.message);
      return;
    }

    showToast("ok", "Sesión iniciada");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRows([]);
    setSelected(null);
    setConfirming(null);
    showToast("ok", "Sesión cerrada");
  };

  const copy = async (txt: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      showToast("ok", okMsg);
    } catch {
      showToast("err", "No se pudo copiar");
    }
  };

  // =========================
  // DELETE RSVP (REAL)
  // =========================
  const deleteRSVP = async (row: RSVPRow) => {
    if (deletingId) return;

    setErrMsg(null);
    setDeletingId(row.id);

    // optimistic remove
    const prev = rows;
    setRows((p) => p.filter((x) => x.id !== row.id));
    if (selected?.id === row.id) setSelected(null);

    const { error } = await supabase.from("rsvps").delete().eq("id", row.id);

    setDeletingId(null);

    if (error) {
      console.error(error);
      // rollback
      setRows(prev);
      showToast("err", error.message || "No se pudo eliminar (revisa RLS/policies)");
      return;
    }

    showToast("ok", "Confirmación eliminada");
  };

  const askDelete = (row: RSVPRow) => {
    if (deletingId) return;
    setConfirming(row);
  };

  const confirmDelete = async () => {
    if (!confirming) return;
    const row = confirming;
    setConfirming(null);
    await deleteRSVP(row);
  };

  // =========================
  // AUTH LOADING
  // =========================
  if (authLoading) {
    return (
      <>
        <style>{fontsCss}</style>
        <style>{styles}</style>
        <div className="appBg" />
        <div className="appShell">
          <div className="glassCard centerCard">Cargando...</div>
        </div>
      </>
    );
  }

  // =========================
  // LOGIN
  // =========================
  if (!session) {
    return (
      <>
        <style>{fontsCss}</style>
        <style>{styles}</style>

        <div className="appBg" />

        <div className="appShell">
          <div className="heroTop">
            <div className="brand">
              <div className="brandCaps">Admin RSVP</div>
              <div className="brandScript">Junior & Glenny</div>
            </div>
          </div>

          <motion.div
            className="glassCard loginCard"
            initial={{ opacity: 0, y: 18, scale: 0.99, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="cardTitle">Iniciar sesión</div>

            <form onSubmit={signIn} className="form">
              <label className="label">Email</label>
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@correo.com"
                type="email"
                autoComplete="email"
              />

              <label className="label" style={{ marginTop: 12 }}>
                Password
              </label>
              <input
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type="password"
                autoComplete="current-password"
              />

              <button className="btnPrimary" type="submit" style={{ marginTop: 14 }}>
                Entrar
              </button>

              {errMsg ? <div className="errorBox">Error: {errMsg}</div> : null}

              <div className="hint">*Este acceso solo es para los Novios.</div>
            </form>
          </motion.div>
        </div>

        <Toast toast={toast} />
      </>
    );
  }

  // =========================
  // ADMIN UI
  // =========================
  return (
    <>
      <style>{fontsCss}</style>
      <style>{styles}</style>

      <div className="appBg" />

      {/* Header sticky */}
      <div className="topBar">
        <div className="topBarInner">
          <div className="brandMini">
            <div className="brandCaps">Admin RSVP</div>
            <div className="brandScriptSm">Junior & Glenny</div>
          </div>

          <div className="topActions">
            <button className="btnGhost" onClick={() => load()} type="button">
              {loading ? "..." : "Actualizar"}
            </button>
            <button className="btnDanger" onClick={signOut} type="button">
              Salir
            </button>
          </div>
        </div>
      </div>

      <div className="appShell withTopBar">
        {/* Stats cards */}
        <motion.div className="statsGrid" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <StatCard label="Confirmaciones" value={totals.totalConfirmed} />
          <StatCard label="Personas" value={totals.totalPeople} />
        </motion.div>

        {/* Search */}
        <div className="tools">
          <div className="searchWrap">
            <span className="searchIcon">⌕</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o teléfono..."
              className="searchInput"
            />
            {q ? (
              <button className="xBtn" onClick={() => setQ("")} aria-label="Limpiar búsqueda" type="button">
                ✕
              </button>
            ) : null}
          </div>
        </div>

        {errMsg ? <div className="errorBox">Error: {errMsg}</div> : null}

        {/* List */}
        <AnimatePresence>
          {loading ? (
            <motion.div
              className="glassCard centerCard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              Cargando...
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div
              className="glassCard centerCard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              No hay confirmaciones.
            </motion.div>
          ) : (
            <motion.div className="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {filtered.map((r, idx) => (
                <motion.div
                  key={r.id}
                  className="rowCardWrap"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.18) }}
                >
                  <button className="rowCardBtn" onClick={() => setSelected(r)} type="button">
                    <div className="rowTop">
                      <div className="avatar">{initials(r.first_name, r.last_name)}</div>

                      <div className="rowMain">
                        <div className="rowName">
                          {r.first_name} {r.last_name}
                        </div>
                        <div className="rowSub">
                          <span className="mono">{r.phone}</span>
                          <span className="dotSep">•</span>
                          <span className="muted">{fmtDate(r.created_at)}</span>
                        </div>
                      </div>

                      <div className="rowRight">
                        <div className="idPill">#{r.id.slice(0, 6)}</div>
                      </div>
                    </div>
                  </button>

                  <button
                    className="rowDeleteBtn"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      askDelete(r);
                    }}
                    disabled={deletingId === r.id}
                    aria-label="Eliminar confirmación"
                    title="Eliminar"
                  >
                    {deletingId === r.id ? "..." : "Eliminar"}
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom bar (mobile) */}
        <div className="bottomBar">
          <button className="bottomBtn" onClick={() => load()} type="button">
            <span className="bottomIco">↻</span>
            <span className="bottomTxt">{loading ? "..." : "Actualizar"}</span>
          </button>
          <button
            className="bottomBtn"
            onClick={() => copy(String(totals.totalPeople), "Total de personas copiado")}
            type="button"
          >
            <span className="bottomIco">⎘</span>
            <span className="bottomTxt">Copiar total</span>
          </button>
          <button className="bottomBtn danger" onClick={signOut} type="button">
            <span className="bottomIco">⇥</span>
            <span className="bottomTxt">Salir</span>
          </button>
        </div>
      </div>

      {/* Modal detalle */}
      <AnimatePresence>
        {selected ? (
          <motion.div
            className="modalOverlay"
            onClick={() => setSelected(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 18, scale: 0.98, filter: "blur(12px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 18, scale: 0.98, filter: "blur(12px)" }}
              transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <div className="modalHead">
                <div className="modalTitle">
                  <div className="avatar big">{initials(selected.first_name, selected.last_name)}</div>
                  <div>
                    <div className="rowName" style={{ fontSize: 14 }}>
                      {selected.first_name} {selected.last_name}
                    </div>
                    <div className="rowSub">
                      <span className="mono">{selected.phone}</span>
                      <span className="dotSep">•</span>
                      <span className="muted">{fmtDate(selected.created_at)}</span>
                    </div>
                  </div>
                </div>

                <button className="xBtn2" onClick={() => setSelected(null)} aria-label="Cerrar" type="button">
                  ✕
                </button>
              </div>

              <div className="modalGrid">
                <div className="miniCard">
                  <div className="miniLbl">ID</div>
                  <div className="miniVal mono">#{selected.id.slice(0, 8)}</div>
                </div>
                <div className="miniCard">
                  <div className="miniLbl">Teléfono</div>
                  <div className="miniVal mono">{selected.phone}</div>
                </div>
                <div className="miniCard">
                  <div className="miniLbl">Fecha</div>
                  <div className="miniVal">{fmtDate(selected.created_at)}</div>
                </div>
              </div>

              <div className="modalActions">
                <button className="btnGhost" onClick={() => copy(selected.phone, "Teléfono copiado")} type="button">
                  Copiar teléfono
                </button>
                <button className="btnPrimary" onClick={() => copy(selected.id, "ID copiado")} type="button">
                  Copiar ID
                </button>
                <button
                  className="btnDanger"
                  onClick={() => askDelete(selected)}
                  type="button"
                  disabled={deletingId === selected.id}
                >
                  {deletingId === selected.id ? "..." : "Eliminar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ✅ Confirm modal bonito */}
      <AnimatePresence>
        {confirming ? (
          <motion.div
            className="confirmOverlay"
            onClick={() => setConfirming(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="confirmCard"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 16, scale: 0.98, filter: "blur(12px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 16, scale: 0.98, filter: "blur(12px)" }}
              transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <div className="confirmIcon">⚠️</div>
              <div className="confirmTitle">¿Eliminar confirmación?</div>
              <div className="confirmText">
                Vas a eliminar la confirmación de{" "}
                <b>
                  {confirming.first_name} {confirming.last_name}
                </b>
                .
                <div style={{ marginTop: 6, opacity: 0.85 }}>
                  Tel: <span className="mono">{confirming.phone}</span>
                </div>
                <div style={{ marginTop: 8, opacity: 0.8 }}>Esta acción no se puede deshacer.</div>
              </div>

              <div className="confirmActions">
                <button className="btnGhost" onClick={() => setConfirming(null)} type="button">
                  Cancelar
                </button>
                <button className="btnDangerSolid" onClick={confirmDelete} type="button">
                  Sí, eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Toast toast={toast} />
    </>
  );
}

/* ===================== Components ===================== */

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <motion.div
      className="statCard"
      initial={{ opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35 }}
      whileHover={{ y: -2 }}
    >
      <div className="statVal">{value}</div>
      <div className="statLbl">{label}</div>
    </motion.div>
  );
}

function Toast({ toast }: { toast: { type: "ok" | "err"; msg: string } | null }) {
  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          className={`toast ${toast.type}`}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
        >
          {toast.msg}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* ===================== Fonts ===================== */

const fontsCss = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=Great+Vibes&display=swap');
`;

/* ===================== Styles ===================== */

const styles = `
:root{
  --ink:#02020B;
  --navy:#0D1546;
  --fog:#EEF2F8;
  --paper:#FBFBFD;
  --sand:#D6B37A;
  --border: rgba(13,21,70,.14);
  --shadow: 0 18px 60px rgba(2,2,11,.14);
}

*{ box-sizing:border-box; }
html, body{ height:100%; }
body{
  margin:0;
  background:#f6f7fb;
  color: rgba(13,21,70,.92);
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}

/* Background */
.appBg{
  position:fixed; inset:0; z-index:-5;
  background:
    radial-gradient(900px 520px at 12% 8%, rgba(119,154,191,.18) 0%, transparent 70%),
    radial-gradient(900px 520px at 88% 12%, rgba(82,113,161,.18) 0%, transparent 70%),
    radial-gradient(900px 520px at 50% 100%, rgba(45,72,130,.12) 0%, transparent 70%),
    linear-gradient(180deg, rgba(255,255,255,.92), rgba(246,247,251,.92));
}

/* Layout */
.appShell{
  width: min(1020px, 94vw);
  margin: 0 auto;
  padding: 16px 0 96px;
}
.withTopBar{ padding-top: 76px; }

.heroTop{ padding-top: 20px; }
.brandCaps{
  font-family: Cinzel, serif;
  letter-spacing: .18em;
  text-transform: uppercase;
  font-weight: 600;
  font-size: 12px;
}
.brandScript{
  margin-top: 10px;
  font-family: "Great Vibes", cursive;
  font-size: 48px;
  color: rgba(13,21,70,.80);
  line-height: 1;
}
.brandMini .brandScriptSm{
  margin-top: 6px;
  font-family: "Great Vibes", cursive;
  font-size: 26px;
  line-height: 1;
  color: rgba(13,21,70,.78);
}

/* TopBar */
.topBar{
  position: sticky;
  top: 0;
  z-index: 2000;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: rgba(255,255,255,.60);
  border-bottom: 1px solid rgba(13,21,70,.10);
}
.topBarInner{
  width: min(1020px, 94vw);
  margin: 0 auto;
  padding: 12px 0;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 12px;
}

/* Cards */
.glassCard{
  border: 1px solid rgba(13,21,70,.12);
  background: rgba(255,255,255,.82);
  box-shadow: var(--shadow);
  border-radius: 22px;
  padding: 16px;
}
.centerCard{
  display:flex;
  justify-content:center;
  align-items:center;
  text-align:center;
  min-height: 88px;
}
.loginCard{ margin-top: 12px; max-width: 520px; }
.cardTitle{
  font-family: Cinzel, serif;
  letter-spacing: .14em;
  text-transform: uppercase;
  font-size: 11px;
  opacity: .9;
}

/* Form */
.form{ margin-top: 12px; }
.label{
  font-family: Cinzel, serif;
  letter-spacing: .14em;
  text-transform: uppercase;
  font-size: 10px;
  opacity: .75;
}
.input{
  width:100%;
  margin-top: 6px;
  border-radius: 14px;
  border: 1px solid rgba(13,21,70,.12);
  background: rgba(255,255,255,.86);
  padding: 12px 12px;
  outline:none;
  box-shadow: 0 10px 26px rgba(2,2,11,.06);
  font-size: 14px;
}
.hint{ margin-top: 10px; font-size: 12px; opacity: .75; }

/* Tools */
.tools{ margin-top: 14px; display:grid; gap: 10px; }
.searchWrap{
  display:flex;
  align-items:center;
  gap: 10px;
  border-radius: 16px;
  border: 1px solid rgba(13,21,70,.12);
  background: rgba(255,255,255,.82);
  box-shadow: 0 16px 44px rgba(2,2,11,.10);
  padding: 12px 12px;
}
.searchIcon{ opacity:.65; font-size: 14px; }
.searchInput{
  flex:1;
  border:0;
  outline:none;
  background: transparent;
  font-size: 14px;
  color: rgba(13,21,70,.92);
}
.xBtn{
  border: 0;
  background: rgba(13,21,70,.06);
  border-radius: 999px;
  width: 34px;
  height: 34px;
  cursor:pointer;
}
.xBtn2{
  border: 1px solid rgba(13,21,70,.12);
  background: rgba(255,255,255,.76);
  border-radius: 999px;
  width: 40px;
  height: 40px;
  cursor:pointer;
  box-shadow: 0 10px 26px rgba(2,2,11,.08);
}

/* Stats */
.statsGrid{
  margin-top: 10px;
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.statCard{
  border-radius: 20px;
  border: 1px solid rgba(13,21,70,.10);
  background: rgba(255,255,255,.82);
  box-shadow: 0 16px 44px rgba(2,2,11,.10);
  padding: 14px 12px;
}
.statVal{
  font-family: Cinzel, serif;
  font-weight: 600;
  letter-spacing: .06em;
  font-size: 22px;
}
.statLbl{
  margin-top: 8px;
  font-family: Cinzel, serif;
  letter-spacing: .14em;
  text-transform: uppercase;
  font-size: 9px;
  opacity:.75;
}

/* List */
.list{ margin-top: 14px; display:grid; gap: 12px; }

.rowCardWrap{
  position: relative;
  border-radius: 22px;
  box-shadow: 0 18px 56px rgba(2,2,11,.10);
  background: rgba(255,255,255,.84);
  border: 1px solid rgba(13,21,70,.10);
  overflow: hidden;
}
.rowCardBtn{
  text-align:left;
  width:100%;
  border: 0;
  background: transparent;
  padding: 14px;
  padding-right: 92px;  /* deja espacio horizontal para que no estorbe */
  padding-bottom: 52px; /* deja espacio abajo para el botón */
  cursor:pointer;
  display:block;
}

.rowDeleteBtn{
  position: absolute;
  right: 12px;
  bottom: 12px;
  top: auto;

  border-radius: 999px;
  border: 1px solid rgba(220,80,80,.35);
  background: rgba(255,255,255,.86);
  color: rgba(140,20,20,.92);
  font-family: Cinzel, serif;
  letter-spacing: .12em;
  text-transform: uppercase;
  font-size: 9px;
  padding: 10px 12px;
  cursor:pointer;
  box-shadow: 0 12px 28px rgba(2,2,11,.08);
}
.rowDeleteBtn:disabled{
  opacity: .6;
  cursor: not-allowed;
}

/* Row content */
.rowTop{ display:flex; gap: 12px; align-items:center; }
.avatar{
  width: 46px; height: 46px;
  border-radius: 16px;
  display:grid; place-items:center;
  background: rgba(255,255,255,.82);
  border: 1px solid rgba(13,21,70,.10);
  font-family: Cinzel, serif;
  font-weight: 600;
  letter-spacing: .10em;
  box-shadow: 0 14px 36px rgba(2,2,11,.10);
}
.avatar.big{ width: 52px; height: 52px; border-radius: 18px; }
.rowMain{ flex: 1; min-width: 0; }
.rowName{
  font-family: Cinzel, serif;
  letter-spacing: .10em;
  text-transform: uppercase;
  font-weight: 600;
  font-size: 12px;
  line-height: 1.2;
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rowSub{
  margin-top: 6px;
  font-size: 12px;
  opacity: .85;
  display:flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items:center;
}
.dotSep{ opacity:.5; }
.muted{ opacity:.72; }
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
.rowRight{ display:flex; justify-content:flex-end; }
.idPill{
  font-size: 11px;
  border-radius: 999px;
  border: 1px solid rgba(13,21,70,.12);
  padding: 8px 10px;
  background: rgba(255,255,255,.78);
  opacity:.85;
}

/* Buttons */
.topActions{ display:flex; gap: 10px; align-items:center; }
.btnPrimary{
  border: 1px solid rgba(214,179,122,.70);
  background: rgba(255,255,255,.76);
  color: rgba(13,21,70,.88);
  font-family: Cinzel, serif;
  letter-spacing: .12em;
  text-transform: uppercase;
  font-size: 10px;
  padding: 12px 14px;
  border-radius: 999px;
  cursor:pointer;
  box-shadow: 0 16px 44px rgba(2,2,11,.10);
}
.btnGhost{
  border: 1px solid rgba(13,21,70,.12);
  background: rgba(255,255,255,.76);
  color: rgba(13,21,70,.86);
  font-family: Cinzel, serif;
  letter-spacing: .12em;
  text-transform: uppercase;
  font-size: 10px;
  padding: 12px 14px;
  border-radius: 999px;
  cursor:pointer;
}
.btnDanger{
  border: 1px solid rgba(220,80,80,.35);
  background: rgba(255,255,255,.76);
  color: rgba(140,20,20,.92);
  font-family: Cinzel, serif;
  letter-spacing: .12em;
  text-transform: uppercase;
  font-size: 10px;
  padding: 12px 14px;
  border-radius: 999px;
  cursor:pointer;
}
.btnDangerSolid{
  border: 1px solid rgba(220,80,80,.55);
  background: rgba(220,80,80,.14);
  color: rgba(140,20,20,.92);
  font-family: Cinzel, serif;
  letter-spacing: .12em;
  text-transform: uppercase;
  font-size: 10px;
  padding: 12px 14px;
  border-radius: 999px;
  cursor:pointer;
  box-shadow: 0 16px 44px rgba(2,2,11,.10);
}

/* Bottom bar */
.bottomBar{
  position: fixed;
  left: 0; right: 0; bottom: 0;
  z-index: 2200;
  padding: 10px 12px max(10px, env(safe-area-inset-bottom));
  background: rgba(255,255,255,.72);
  border-top: 1px solid rgba(13,21,70,.10);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  display:none;
}
.bottomBtn{
  flex:1;
  border: 1px solid rgba(13,21,70,.10);
  background: rgba(255,255,255,.84);
  border-radius: 16px;
  padding: 10px 10px;
  cursor:pointer;
  display:flex;
  justify-content:center;
  align-items:center;
  gap: 8px;
  box-shadow: 0 14px 36px rgba(2,2,11,.10);
}
.bottomBtn.danger{ border-color: rgba(220,80,80,.28); }
.bottomIco{ font-size: 14px; opacity:.85; }
.bottomTxt{
  font-family: Cinzel, serif;
  letter-spacing: .10em;
  text-transform: uppercase;
  font-size: 9px;
  opacity:.9;
}

/* Modal */
.modalOverlay{
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(2,2,11,.35);
  display:flex;
  justify-content:center;
  align-items:flex-end;
  padding: 14px;
}
.modal{
  width: min(720px, 100%);
  border-radius: 24px;
  border: 1px solid rgba(13,21,70,.12);
  background: rgba(255,255,255,.92);
  box-shadow: 0 22px 70px rgba(2,2,11,.20);
  padding: 14px;
  max-height: 78vh;
  overflow:auto;
}
.modalHead{ display:flex; justify-content:space-between; align-items:center; gap: 10px; }
.modalTitle{ display:flex; gap: 12px; align-items:center; }
.modalGrid{
  margin-top: 12px;
  display:grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.miniCard{
  border-radius: 18px;
  border: 1px solid rgba(13,21,70,.10);
  background: rgba(255,255,255,.84);
  padding: 12px;
}
.miniLbl{
  font-family: Cinzel, serif;
  letter-spacing: .12em;
  text-transform: uppercase;
  font-size: 9px;
  opacity: .75;
}
.miniVal{ margin-top: 8px; font-weight: 700; font-size: 14px; }
.modalActions{
  margin-top: 12px;
  display:flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content:flex-end;
}

/* Confirm modal */
.confirmOverlay{
  position: fixed;
  inset: 0;
  z-index: 3500;
  background: rgba(2,2,11,.40);
  display:flex;
  justify-content:center;
  align-items:center;
  padding: 14px;
}
.confirmCard{
  width: min(520px, 100%);
  border-radius: 24px;
  border: 1px solid rgba(13,21,70,.12);
  background: rgba(255,255,255,.94);
  box-shadow: 0 22px 70px rgba(2,2,11,.22);
  padding: 16px;
}
.confirmIcon{ font-size: 26px; }
.confirmTitle{
  margin-top: 8px;
  font-family: Cinzel, serif;
  letter-spacing: .12em;
  text-transform: uppercase;
  font-size: 11px;
}
.confirmText{
  margin-top: 10px;
  font-size: 13px;
  opacity: .9;
  line-height: 1.4;
}
.confirmActions{
  margin-top: 14px;
  display:flex;
  justify-content:flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

/* Toast */
.toast{
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 86px;
  z-index: 4000;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 12px;
  border: 1px solid rgba(13,21,70,.12);
  background: rgba(255,255,255,.92);
  box-shadow: 0 18px 60px rgba(2,2,11,.18);
}
.toast.ok{ border-color: rgba(214,179,122,.55); }
.toast.err{ border-color: rgba(220,80,80,.35); }

.errorBox{
  margin-top: 12px;
  border-radius: 16px;
  border: 1px solid rgba(220,80,80,.35);
  background: rgba(255,255,255,.85);
  padding: 12px;
  box-shadow: 0 14px 36px rgba(2,2,11,.08);
  font-size: 12px;
}

/* Responsive */
@media (max-width: 980px){
  .statsGrid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px){
  .appShell{ padding-left: 2px; padding-right: 2px; }
  .withTopBar{ padding-top: 74px; }
  .bottomBar{ display:flex; gap: 10px; }
  .topActions{ display:none; }
  .brandScript{ font-size: 44px; }
  .modalOverlay{ align-items:flex-end; }
  .modalGrid{ grid-template-columns: 1fr; }
}
`;
