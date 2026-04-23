import { useState, useEffect, useCallback } from "react";
import { db } from './firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const THEMES = ["Keselamatan","Kasih","Penyembahan","Pengampunan","Syukur","Iman","Harapan","Altar Call","Pujian","Kuasa Tuhan","Roh Kudus","Pemulihan","Kemenangan","Doa","Kebesaran Tuhan"];
const NADA_LIST = ["C","C#/Db","D","D#/Eb","E","F","F#/Gb","G","G#/Ab","A","A#/Bb","B"];
const DEFAULT_PIN = "1234";
const WORSHIP_ROLES = [{ key:"SL", label:"Song Leader", badge:"SL" },{ key:"BV", label:"Backing Vocal", badge:"BV" }];
const MUSIC_ROLES = ["Gitar","Keyboard","Bass","Drum","Saxo"];
const ALL_SLOT_KEYS = ["SL","BV","Gitar","Keyboard","Bass","Drum","Saxo"];
const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const IBADAH_TYPES = [
  { key:"raya",  label:"Ibadah Raya",  emoji:"⛪", color:"#c9a84c", bg:"rgba(201,168,76,.12)", border:"rgba(201,168,76,.35)" },
  { key:"youth", label:"Ibadah Youth", emoji:"⚡", color:"#7c6ff7", bg:"rgba(124,111,247,.12)", border:"rgba(124,111,247,.35)" },
];
const ALUR_OPTIONS = ["Pembukaan","Pujian","Penyembahan","Persembahan","Altar Call","Penutup","Transisi","Interlude"];

function getYtId(url) {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : (url.length === 11 ? url : null);
}
function getSundays(y,m){const s=[],d=new Date(y,m,1);while(d.getDay()!==0)d.setDate(d.getDate()+1);while(d.getMonth()===m){s.push(new Date(d));d.setDate(d.getDate()+7);}return s;}
const fmtD = d => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const fmtShort = d => new Date(d).toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

const SAMPLE_SONGS = [
  { id:"s1", title:"Bapa Engkau Sungguh Baik", artist:"True Worshippers", nada:"G", themes:["Syukur","Pujian","Kasih"], youtube:"https://www.youtube.com/watch?v=cBBuMRe2ND4", lyrics:"Bapa Engkau sungguh baik\nKasih-Mu tiada tara\nKemurahan-Mu menyertaiku\nSeumur hidupku\n\n[Chorus]\nHooo... Engkau baik\nBaik Engkau selamanya" },
  { id:"s2", title:"Kau Begitu Sempurna", artist:"Hillsong Indonesia", nada:"A", themes:["Penyembahan","Kebesaran Tuhan","Altar Call"], youtube:"https://www.youtube.com/watch?v=W0tDOEHi9H4", lyrics:"Kau begitu sempurna\nDi dalam seluruh jalan-Mu\n\n[Chorus]\nSangat ku cinta-Mu Tuhan\nKau sungguh mulia" },
  { id:"s3", title:"Datang Padamu", artist:"Sidney Mohede", nada:"G", themes:["Altar Call","Keselamatan","Doa"], youtube:"https://www.youtube.com/watch?v=Uo9rlUZadag", lyrics:"Aku datang pada-Mu Tuhan\nDengan hati yang remuk dan sesal\n\n[Chorus]\nDatanglah padaku Tuhan\nPulihkan hatiku" },
  { id:"s4", title:"Roh Kudus Hadirlah", artist:"True Worshippers", nada:"G", themes:["Roh Kudus","Penyembahan","Doa"], youtube:"https://www.youtube.com/watch?v=M4mhKMGKUkk", lyrics:"Roh Kudus hadirlah\nDi tempat ini kami rindu\n\n[Chorus]\nKami haus akan hadirat-Mu\nCurahkan roh-Mu atas kami" },
  { id:"s5", title:"Amazing Grace (Kasih Yang Ajaib)", artist:"Traditional", nada:"G", themes:["Pengampunan","Keselamatan","Iman"], youtube:"https://www.youtube.com/watch?v=CDdvReNKKuk", lyrics:"Kasih yang ajaib suara merdu\nYang selamatkan orang berdosa sepertiku" },
];

// ─── FIREBASE FIRESTORE STORAGE ──────────────────────────────────────────────
async function storageGet(key) {
  try {
    const docRef = doc(db, 'worship_data', key);
    const snap = await getDoc(docRef);
    if (snap.exists()) return JSON.parse(snap.data().value);
    return null;
  } catch (e) {
    console.error('storageGet error:', e);
    return null;
  }
}
async function storageSet(key, value) {
  try {
    const docRef = doc(db, 'worship_data', key);
    await setDoc(docRef, { value: JSON.stringify(value) });
    return true;
  } catch (e) {
    console.error('storageSet error:', e);
    return false;
  }
}

// ─── PDF via HTML PRINT ───────────────────────────────────────────────────────
function openPrintWindow(htmlContent, filename) {
  const win = window.open("", "_blank");
  if (!win) { alert("Popup diblokir browser. Izinkan popup untuk halaman ini."); return; }
  win.document.write(htmlContent);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 800);
}

function exportSchedulePDF(year, month, data) {
  const sundays = getSundays(year, month);
  const rows = sundays.map((sun, i) => {
    const k = sun.toISOString().slice(0,10);
    const e = data[k] || {};
    const worship = WORSHIP_ROLES.map(({ key, label, badge }) => `
      <tr>
        <td class="role-label"><span class="badge">${badge}</span>${label}</td>
        <td class="role-value">${e[key] || '<span class="empty">—</span>'}</td>
      </tr>`).join("");
    const musicians = MUSIC_ROLES.map(role => `
      <tr>
        <td class="role-label"><span class="role-dot"></span>${role}</td>
        <td class="role-value">${e[role] || '<span class="empty">—</span>'}</td>
      </tr>`).join("");
    return `
      <div class="week-block">
        <div class="week-header">
          <div class="week-left">
            <span class="week-num">Minggu ${i+1}</span>
            <span class="week-date">${fmtD(sun)}</span>
          </div>
          ${e.title ? `<span class="week-tema">${e.title}</span>` : ""}
        </div>
        ${e.rehearsal ? `<div class="rehearsal">🕐 Latihan: ${e.rehearsal}</div>` : ""}
        <table class="role-table">
          <thead><tr><th colspan="2" class="section-head">🎤 WORSHIP</th></tr></thead>
          <tbody>${worship}</tbody>
          <thead><tr><th colspan="2" class="section-head" style="padding-top:8px">🎸 PEMUSIK</th></tr></thead>
          <tbody>${musicians}</tbody>
        </table>
        ${e.notes ? `<div class="notes">📝 ${e.notes}</div>` : ""}
      </div>`;
  }).join("");

  const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
<title>Jadwal Pelayanan - ${MONTHS[month]} ${year}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=DM+Sans:wght@300;400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',sans-serif;background:#fff;color:#1a2535;padding:20px;max-width:800px;margin:0 auto}
  .header{background:linear-gradient(135deg,#0f1923,#1e2d3f);color:#fff;padding:24px 28px;border-radius:12px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center}
  .header-left h1{font-family:'Playfair Display',serif;font-size:24px;color:#c9a84c;margin-bottom:4px}
  .header-left p{font-size:13px;color:#8a9ab0;text-transform:uppercase;letter-spacing:.1em}
  .header-right{text-align:right;font-size:11px;color:#8a9ab0}
  .week-block{border:1px solid #dce3ec;border-radius:10px;margin-bottom:16px;overflow:hidden;break-inside:avoid}
  .week-header{background:#f0f4f8;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #dce3ec}
  .week-left{display:flex;align-items:center;gap:10px}
  .week-num{background:#c9a84c;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;text-transform:uppercase;letter-spacing:.05em}
  .week-date{font-family:'Playfair Display',serif;font-size:15px;color:#1a2535;font-weight:600}
  .week-tema{font-size:11px;color:#6b7a8d;font-style:italic}
  .rehearsal{background:#fff8e6;border-left:3px solid #c9a84c;padding:7px 14px;font-size:12px;color:#7a6020;font-weight:500}
  .role-table{width:100%;border-collapse:collapse;padding:8px 14px}
  .section-head{text-align:left;padding:8px 14px 4px;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#8a9ab0;font-weight:700;background:#fff;border:none}
  .role-label{padding:5px 14px;font-size:12px;color:#6b7a8d;width:160px;display:flex;align-items:center;gap:8px;vertical-align:middle}
  .role-value{padding:5px 14px;font-size:13px;color:#1a2535;font-weight:500;vertical-align:middle}
  .badge{background:#c9a84c;color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;margin-right:4px}
  .role-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#dce3ec;margin-right:4px}
  .empty{color:#bbb;font-style:italic}
  .notes{background:#f8f9fa;padding:8px 14px;font-size:12px;color:#6b7a8d;font-style:italic;border-top:1px solid #eee}
  .footer{margin-top:24px;text-align:center;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:12px}
  @media print{body{padding:10px}.no-print{display:none}@page{margin:15mm}}
</style></head><body>
<div class="header">
  <div class="header-left">
    <h1>Jadwal Pelayanan</h1>
    <p>${MONTHS[month]} ${year} · ${sundays.length} Minggu</p>
  </div>
  <div class="header-right">Worship App<br>${new Date().toLocaleDateString("id-ID")}</div>
</div>
${rows || '<p style="text-align:center;color:#aaa;padding:40px">Belum ada data jadwal untuk bulan ini.</p>'}
<div class="footer">Worship App · Jadwal Pelayanan ${MONTHS[month]} ${year}</div>
</body></html>`;

  openPrintWindow(html);
}

function exportSetlistPDF(setlist) {
  const typeInfo = IBADAH_TYPES.find(t => t.key === setlist.type);
  const accent = setlist.type === "raya" ? "#c9a84c" : "#7c6ff7";
  const accentBg = setlist.type === "raya" ? "#fff8e6" : "#f0eeff";
  const accentBorder = setlist.type === "raya" ? "#e8c96a" : "#9c8ff7";

  const songRows = (setlist.songs || []).map((item, i) => `
    <div class="song-card">
      <div class="song-header">
        <div class="song-num" style="background:${accent}">${i+1}</div>
        <div class="song-info">
          <div class="song-title">${item.title || ""}</div>
          <div class="song-artist">${item.artist || ""}</div>
        </div>
        <div class="song-meta">
          ${item.nada ? `<span class="nada-badge" style="border-color:${accent};color:${accent}">Do = ${item.nada}</span>` : ""}
          ${item.alur ? `<span class="alur-badge" style="background:${accentBg};border-color:${accentBorder};color:${accent}">${item.alur}</span>` : ""}
        </div>
      </div>
      ${item.catatan ? `<div class="song-note"><span style="color:${accent};font-weight:600">Catatan: </span>${item.catatan}</div>` : ""}
    </div>`).join("");

  const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
<title>Setlist - ${setlist.title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=DM+Sans:wght@300;400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',sans-serif;background:#fff;color:#1a2535;padding:20px;max-width:800px;margin:0 auto}
  .header{background:linear-gradient(135deg,#0f1923,#1e2d3f);padding:24px 28px;border-radius:12px;margin-bottom:20px;border-left:6px solid ${accent}}
  .type-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:${accent};margin-bottom:6px}
  .header h1{font-family:'Playfair Display',serif;font-size:24px;color:#fff;margin-bottom:6px}
  .header-meta{font-size:12px;color:#8a9ab0}
  .general-note{background:${accentBg};border:1px solid ${accentBorder};border-left:4px solid ${accent};border-radius:8px;padding:12px 16px;margin-bottom:16px}
  .general-note-label{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:${accent};font-weight:700;margin-bottom:5px}
  .general-note-text{font-size:13px;color:#2a3545;line-height:1.7;white-space:pre-wrap}
  .section-title{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#8a9ab0;font-weight:700;margin-bottom:10px}
  .song-card{border:1px solid #dce3ec;border-radius:10px;margin-bottom:10px;overflow:hidden;break-inside:avoid;border-left:4px solid ${accent}}
  .song-header{display:flex;align-items:center;gap:12px;padding:12px 14px}
  .song-num{width:28px;height:28px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;font-family:'Playfair Display',serif;flex-shrink:0}
  .song-info{flex:1}
  .song-title{font-family:'Playfair Display',serif;font-size:15px;color:#1a2535;margin-bottom:2px}
  .song-artist{font-size:11px;color:#8a9ab0}
  .song-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
  .nada-badge{padding:3px 10px;border-radius:6px;border:1.5px solid;font-size:12px;font-weight:700;font-family:'Playfair Display',serif}
  .alur-badge{padding:3px 10px;border-radius:999px;border:1px solid;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
  .song-note{padding:8px 14px 10px 54px;font-size:12px;color:#4a5568;line-height:1.7;background:#f8f9fa;border-top:1px solid #eee;white-space:pre-wrap}
  .footer{margin-top:24px;text-align:center;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:12px}
  @media print{body{padding:10px}@page{margin:15mm}}
</style></head><body>
<div class="header">
  <div class="type-label">${typeInfo.emoji} ${typeInfo.label} · Setlist</div>
  <h1>${setlist.title || "Setlist"}</h1>
  <div class="header-meta">
    ${setlist.date ? fmtShort(setlist.date) : ""}
    ${setlist.tema ? ` &nbsp;·&nbsp; 📖 Tema: <strong style="color:#fff">${setlist.tema}</strong>` : ""}
  </div>
</div>
${setlist.catatan ? `
<div class="general-note">
  <div class="general-note-label">📋 Catatan Umum untuk Tim</div>
  <div class="general-note-text">${setlist.catatan}</div>
</div>` : ""}
<div class="section-title">${typeInfo.emoji} Susunan Lagu (${(setlist.songs||[]).length} lagu)</div>
${songRows || '<p style="text-align:center;color:#aaa;padding:30px">Belum ada lagu dalam setlist ini.</p>'}
<div class="footer">Worship App · ${typeInfo.label} · ${setlist.title}</div>
</body></html>`;

  openPrintWindow(html);
}

// ─── ICONS ───────────────────────────────────────────────────────────────────
const Ic = ({ d, size=20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
);
const SearchIcon  = () => <Ic d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>;
const MusicIcon   = () => <Ic d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>;
const CalIcon     = () => <Ic d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>;
const ListIcon    = () => <Ic d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h4"/>;
const PlusIcon    = () => <Ic d="M12 5v14M5 12h14"/>;
const EditIcon    = () => <Ic d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={16}/>;
const TrashIcon   = () => <Ic d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" size={16}/>;
const LockIcon    = () => <Ic d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4"/>;
const UnlockIcon  = () => <Ic d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 9.9-1"/>;
const BackIcon    = () => <Ic d="M19 12H5M12 19l-7-7 7-7"/>;
const XIcon       = () => <Ic d="M18 6L6 18M6 6l12 12"/>;
const SparkIcon   = () => <Ic d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>;
const ChevL       = () => <Ic d="M15 18l-6-6 6-6" size={18}/>;
const ChevR       = () => <Ic d="M9 18l6-6-6-6" size={18}/>;
const UpIcon      = () => <Ic d="M12 19V5M5 12l7-7 7 7" size={16}/>;
const DownIcon    = () => <Ic d="M12 5v14M5 12l7 7 7-7" size={16}/>;
const PdfIcon     = () => <Ic d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6M9 15h6" size={17}/>;
const YtIcon      = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2s-.3-1.9-1.1-2.7c-1-.9-2.2-1-2.7-1C16.7 2.3 12 2.3 12 2.3s-4.7 0-7.7.2c-.5.1-1.7.1-2.7 1C.8 4.3.5 6.2.5 6.2S.2 8.4.2 10.6v2.1c0 2.2.3 4.4.3 4.4s.3 1.9 1.1 2.7c1 .9 2.4.9 3 1 2.2.2 9.4.2 9.4.2s4.7 0 7.7-.2c.5-.1 1.7-.1 2.7-1 .8-.8 1.1-2.7 1.1-2.7s.3-2.2.3-4.4v-2.1c0-2.2-.3-4.4-.3-4.4zM9.7 15.5V8.4l7.3 3.6-7.3 3.5z"/></svg>;

// ─── NADA BADGE ───────────────────────────────────────────────────────────────
function NadaBadge({ nada, size="md" }) {
  if (!nada) return null;
  const big = size === "lg";
  return (
    <div style={{ display:"inline-flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      background:"linear-gradient(135deg,#2a1f00,#3d2e00)", border:"1.5px solid var(--gold)",
      borderRadius:big?12:8, padding:big?"6px 14px":"3px 9px", flexShrink:0, minWidth:big?56:40 }}>
      <span style={{fontSize:big?9:8,color:"var(--gold)",opacity:.8,textTransform:"uppercase",letterSpacing:".1em",lineHeight:1.2}}>Do =</span>
      <span style={{fontSize:big?22:14,fontFamily:"'Playfair Display',serif",color:"var(--gold)",fontWeight:700,lineHeight:1.1}}>{nada}</span>
    </div>
  );
}

// ─── PDF EXPORT BUTTON ────────────────────────────────────────────────────────
function PdfButton({ onClick, loading, label="Export PDF" }) {
  return (
    <button onClick={onClick} disabled={loading}
      style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px",
        background: loading ? "var(--sf2)" : "rgba(220,50,50,.15)",
        border:"1px solid rgba(220,50,50,.4)", borderRadius:8,
        color: loading ? "var(--mu)" : "#ff7070", fontSize:12, fontWeight:600,
        cursor: loading ? "not-allowed" : "pointer", fontFamily:"'DM Sans',sans-serif",
        transition:"all .2s" }}>
      <PdfIcon/>
      {loading ? "Memproses..." : label}
    </button>
  );
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=DM+Sans:wght@300;400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
:root{--bg:#0f1923;--sf:#162030;--sf2:#1e2d3f;--bd:#2a3d52;--gold:#c9a84c;--glight:#e8c96a;--tx:#e8e0d0;--mu:#8a9ab0;--ok:#4caf7d;--danger:#e05c5c;--youth:#7c6ff7;--r:14px}
body{background:var(--bg);color:var(--tx);font-family:'DM Sans',sans-serif;min-height:100vh}
.app{max-width:430px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;background:var(--bg)}
.nav{display:flex;justify-content:space-around;padding:8px 0 env(safe-area-inset-bottom,8px);background:var(--sf);border-top:1px solid var(--bd);position:sticky;bottom:0;z-index:100}
.nb{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 12px;border:none;background:none;color:var(--mu);cursor:pointer;font-family:'DM Sans',sans-serif;font-size:9px;font-weight:500;letter-spacing:.05em;text-transform:uppercase;transition:color .2s}
.nb.on{color:var(--gold)}
.hdr{padding:16px 20px 12px;background:var(--sf);border-bottom:1px solid var(--bd);display:flex;justify-content:space-between;align-items:center}
.htitle{font-family:'Playfair Display',serif;font-size:21px;color:var(--gold)}
.hsub{font-size:11px;color:var(--mu);margin-top:2px;text-transform:uppercase;letter-spacing:.1em}
.rbadge{display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:var(--sf2);border:1px solid var(--bd);font-size:11px;color:var(--mu);cursor:pointer;transition:all .2s}
.rbadge.coord{color:var(--gold);border-color:var(--gold)}
.content{flex:1;overflow-y:auto;padding-bottom:20px}
.sw{padding:14px 16px 8px}
.sbox{display:flex;align-items:center;gap:10px;background:var(--sf2);border:1px solid var(--bd);border-radius:var(--r);padding:10px 14px;transition:border-color .2s}
.sbox:focus-within{border-color:var(--gold)}
.sbox input{flex:1;background:none;border:none;outline:none;color:var(--tx);font-family:'DM Sans',sans-serif;font-size:15px}
.sbox input::placeholder{color:var(--mu)}
.tscr{display:flex;gap:8px;padding:0 16px 12px;overflow-x:auto;scrollbar-width:none}
.tscr::-webkit-scrollbar{display:none}
.chip{flex-shrink:0;padding:5px 12px;border-radius:999px;background:var(--sf2);border:1px solid var(--bd);font-size:12px;color:var(--mu);cursor:pointer;transition:all .2s;white-space:nowrap}
.chip.on{background:var(--gold);border-color:var(--gold);color:#0f1923;font-weight:600}
.slist{padding:0 16px;display:flex;flex-direction:column;gap:10px}
.scard{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);padding:14px 16px;cursor:pointer;transition:all .2s;display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.scard:hover{border-color:var(--gold);transform:translateY(-1px)}
.stitle{font-family:'Playfair Display',serif;font-size:16px;color:var(--tx);margin-bottom:3px}
.sartist{font-size:12px;color:var(--mu);margin-bottom:8px;display:flex;align-items:center;gap:6px}
.ytbadge{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;background:rgba(255,80,80,.15);border:1px solid rgba(255,80,80,.3);border-radius:999px;font-size:10px;color:#ff7070;font-weight:600}
.stags{display:flex;flex-wrap:wrap;gap:4px}
.ttag{padding:2px 8px;border-radius:999px;background:var(--sf2);border:1px solid var(--bd);font-size:10px;color:var(--gold);font-weight:500;text-transform:uppercase;letter-spacing:.05em}
.sact{display:flex;gap:6px}
.ib{padding:6px;border:none;background:var(--sf2);color:var(--mu);border-radius:8px;cursor:pointer;transition:all .2s;display:flex;align-items:center}
.ib:hover{color:var(--tx);background:var(--bd)}
.ib.del:hover{color:var(--danger)}
.lv{position:fixed;inset:0;background:var(--bg);z-index:200;display:flex;flex-direction:column;max-width:430px;margin:0 auto}
.lhdr{padding:14px 16px;background:var(--sf);border-bottom:1px solid var(--bd);display:flex;gap:12px;align-items:center}
.lbody{flex:1;overflow-y:auto;padding:20px}
.ltxt{font-size:15px;line-height:2.1;color:var(--tx);white-space:pre-wrap;font-weight:300}
.ltags{display:flex;flex-wrap:wrap;gap:6px;padding:14px 16px;border-top:1px solid var(--bd)}
.nada-banner{display:flex;align-items:center;gap:14px;margin:0 16px 14px;padding:14px 18px;background:linear-gradient(135deg,rgba(42,31,0,.9),rgba(61,46,0,.7));border:1px solid rgba(201,168,76,.4);border-radius:14px}
.nada-banner-label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--gold);opacity:.8;margin-bottom:2px}
.nada-banner-val{font-family:'Playfair Display',serif;font-size:26px;color:var(--gold);font-weight:700;line-height:1}
.nada-banner-sub{font-size:11px;color:var(--mu);margin-top:3px}
.nada-grid{display:flex;flex-wrap:wrap;gap:6px}
.nada-chip{padding:7px 14px;border-radius:8px;background:var(--sf2);border:1.5px solid var(--bd);font-size:14px;font-weight:600;color:var(--mu);cursor:pointer;transition:all .2s;font-family:'Playfair Display',serif;min-width:52px;text-align:center}
.nada-chip.on{background:linear-gradient(135deg,#2a1f00,#3d2e00);border-color:var(--gold);color:var(--gold)}
.nada-chip:hover{border-color:var(--gold);color:var(--gold)}
.yt-wrap{margin:0 16px 14px;border-radius:14px;overflow:hidden;border:1px solid var(--bd);background:var(--sf2)}
.yt-thumb-area{position:relative;height:110px;background:#000;overflow:hidden}
.yt-thumb{width:100%;height:100%;object-fit:cover;opacity:.6;display:block}
.yt-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.yt-open-btn{display:inline-flex;align-items:center;gap:10px;padding:11px 24px;background:rgba(200,0,0,.92);color:#fff;border-radius:999px;text-decoration:none;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:700;transition:all .2s;box-shadow:0 4px 20px rgba(0,0,0,.5)}
.yt-open-btn:hover{background:rgb(200,0,0);transform:scale(1.04)}
.yt-footer{display:flex;align-items:center;gap:8px;padding:8px 14px;font-size:12px;color:var(--mu);border-top:1px solid var(--bd)}
.fab-grp{position:fixed;bottom:80px;right:16px;display:flex;flex-direction:column;gap:10px;z-index:50}
.fab{width:52px;height:52px;border-radius:999px;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .2s}
.fab.add{background:var(--gold);color:#0f1923;box-shadow:0 4px 20px rgba(201,168,76,.4)}
.fab.ai{background:#1e1540;color:#b89dff;border:1px solid #4a3a8a;box-shadow:0 4px 20px rgba(74,58,138,.45)}
.fab:hover{transform:scale(1.07)}
.mo{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:300;display:flex;align-items:flex-end;justify-content:center}
.md{background:var(--sf);border-radius:20px 20px 0 0;width:100%;max-width:430px;padding:24px 20px 40px;max-height:92vh;overflow-y:auto}
.mt{font-family:'Playfair Display',serif;font-size:20px;color:var(--gold);margin-bottom:18px}
.fg{margin-bottom:13px}
.fl{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--mu);margin-bottom:6px;display:block}
.fi{width:100%;background:var(--sf2);border:1px solid var(--bd);border-radius:10px;padding:10px 14px;color:var(--tx);font-family:'DM Sans',sans-serif;font-size:15px;outline:none;transition:border-color .2s}
.fi:focus{border-color:var(--gold)}
.fta{resize:vertical;min-height:80px;line-height:1.6}
.tgrid{display:flex;flex-wrap:wrap;gap:6px}
.btn{padding:11px 20px;border-radius:10px;border:none;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s}
.btn-p{background:var(--gold);color:#0f1923}.btn-p:hover{background:var(--glight)}
.btn-g{background:var(--sf2);color:var(--mu);border:1px solid var(--bd)}.btn-g:hover{color:var(--tx)}
.btn-ai{background:#1e1540;color:#b89dff;border:1px solid #4a3a8a}.btn-ai:hover{background:#2a1f58}
.brow{display:flex;gap:10px;margin-top:18px}.brow .btn{flex:1}
.ai-res{display:flex;flex-direction:column;gap:8px;margin-top:14px}
.ai-card{background:var(--sf2);border:1px solid var(--bd);border-radius:12px;padding:13px 14px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.ai-ttl{font-family:'Playfair Display',serif;font-size:14px;color:var(--tx);margin-bottom:2px}
.ai-art{font-size:12px;color:var(--mu);margin-bottom:6px}
.ai-add{padding:6px 12px;background:var(--gold);color:#0f1923;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .2s;flex-shrink:0}
.ai-add:hover{background:var(--glight)}.ai-add.done{background:var(--ok);color:#fff}
.ai-think{display:flex;align-items:center;gap:12px;padding:22px 0;color:var(--mu);font-size:14px}
.dots span{animation:blink 1.4s infinite both}
.dots span:nth-child(2){animation-delay:.2s}.dots span:nth-child(3){animation-delay:.4s}
@keyframes blink{0%,80%,100%{opacity:0}40%{opacity:1}}
.schw{padding:0 16px}
.mnav{display:flex;justify-content:space-between;align-items:center;padding:14px 4px 10px}
.mname{font-family:'Playfair Display',serif;font-size:20px;color:var(--gold)}
.myear{font-size:12px;color:var(--mu);text-align:center;margin-top:2px}
.nc{width:36px;height:36px;border-radius:50%;background:var(--sf2);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--mu);transition:all .2s}
.nc:hover{color:var(--gold);border-color:var(--gold)}
.wcard{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);margin-bottom:10px;overflow:hidden}
.whdr{padding:11px 14px;background:var(--sf2);display:flex;justify-content:space-between;align-items:center}
.wdate{font-family:'Playfair Display',serif;font-size:15px;color:var(--tx)}
.wtype{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--gold);font-weight:600}
.wbody{padding:12px 14px}
.srow{display:flex;align-items:flex-start;gap:10px;margin-bottom:7px}
.slbl{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--mu);width:82px;flex-shrink:0;display:flex;align-items:center;gap:4px;padding-top:1px}
.snames{flex:1;font-size:13px;color:var(--tx);line-height:1.6}
.semp{font-size:12px;color:var(--mu);font-style:italic}
.evbadge{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.3);border-radius:999px;font-size:11px;color:var(--gold);font-weight:500}
.div{height:1px;background:var(--bd);margin:10px 0}
.seclbl{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--gold);font-weight:600;margin-bottom:8px}
.pm{position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:400;display:flex;align-items:center;justify-content:center;padding:20px}
.pc{background:var(--sf);border:1px solid var(--bd);border-radius:20px;padding:30px 26px;width:100%;max-width:320px;text-align:center}
.pinp{width:100%;text-align:center;font-size:28px;letter-spacing:14px;padding:13px;background:var(--sf2);border:1px solid var(--bd);border-radius:12px;color:var(--tx);outline:none;margin-bottom:14px;font-family:'DM Sans',sans-serif}
.pinp:focus{border-color:var(--gold)}
.perr{color:var(--danger);font-size:12px;margin-bottom:10px;height:16px}
.empty{text-align:center;padding:44px 20px;color:var(--mu)}
.spin{width:26px;height:26px;border:2px solid var(--bd);border-top-color:var(--gold);border-radius:50%;animation:sp .8s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
.loading{display:flex;align-items:center;justify-content:center;padding:40px}
.toast{position:fixed;top:18px;left:50%;transform:translateX(-50%);background:var(--ok);color:#fff;padding:9px 20px;border-radius:999px;font-size:13px;font-weight:600;z-index:500;animation:fio 2.6s forwards;white-space:nowrap}
@keyframes fio{0%,100%{opacity:0;transform:translateX(-50%) translateY(-10px)}15%,85%{opacity:1;transform:translateX(-50%) translateY(0)}}
.sl-wrap{padding:0 16px}
.sl-tabs{display:flex;gap:8px;padding:14px 16px 10px}
.sl-tab{flex:1;padding:10px 14px;border-radius:12px;border:1.5px solid var(--bd);background:var(--sf2);cursor:pointer;transition:all .2s;text-align:center}
.sl-tab.raya.on{background:rgba(201,168,76,.15);border-color:var(--gold)}
.sl-tab.youth.on{background:rgba(124,111,247,.15);border-color:var(--youth)}
.sl-tab-emoji{font-size:22px;margin-bottom:3px}
.sl-tab-label{font-size:12px;font-weight:600;color:var(--tx)}
.sl-tab-count{font-size:10px;color:var(--mu);margin-top:1px}
.sl-card{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);margin-bottom:10px;overflow:hidden;cursor:pointer;transition:all .2s}
.sl-card:hover{transform:translateY(-1px)}
.sl-card.raya{border-left:4px solid var(--gold)}
.sl-card.youth{border-left:4px solid var(--youth)}
.sl-card-hdr{padding:12px 14px;display:flex;justify-content:space-between;align-items:flex-start}
.sl-card-title{font-family:'Playfair Display',serif;font-size:16px;color:var(--tx)}
.sl-card-date{font-size:11px;color:var(--mu);margin-top:2px}
.sl-type-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600}
.sl-type-badge.raya{background:rgba(201,168,76,.15);color:var(--gold);border:1px solid rgba(201,168,76,.3)}
.sl-type-badge.youth{background:rgba(124,111,247,.15);color:var(--youth);border:1px solid rgba(124,111,247,.3)}
.sl-songs-preview{padding:0 14px 12px;display:flex;flex-direction:column;gap:4px}
.sl-preview-item{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--mu)}
.sl-num{width:18px;height:18px;border-radius:50%;background:var(--sf2);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--mu);flex-shrink:0}
.slv{position:fixed;inset:0;background:var(--bg);z-index:200;display:flex;flex-direction:column;max-width:430px;margin:0 auto}
.slv-hdr{padding:14px 16px;background:var(--sf);border-bottom:1px solid var(--bd)}
.slv-hdr-top{display:flex;gap:10px;align-items:center;margin-bottom:8px}
.slv-title{font-family:'Playfair Display',serif;font-size:19px;color:var(--tx);flex:1}
.slv-body{flex:1;overflow-y:auto;padding:16px}
.ssl-item{background:var(--sf);border:1px solid var(--bd);border-radius:12px;margin-bottom:10px;overflow:hidden}
.ssl-item-hdr{padding:12px 14px;display:flex;align-items:flex-start;gap:10px}
.ssl-num{width:28px;height:28px;border-radius:50%;background:var(--sf2);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--gold);flex-shrink:0;font-family:'Playfair Display',serif}
.ssl-info{flex:1}
.ssl-title{font-family:'Playfair Display',serif;font-size:15px;color:var(--tx);margin-bottom:2px}
.ssl-artist{font-size:11px;color:var(--mu);margin-bottom:5px}
.ssl-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.ssl-alur{padding:2px 9px;border-radius:999px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
.ssl-body{padding:0 14px 12px;border-top:1px solid var(--bd);margin-top:4px}
.ssl-note{font-size:13px;color:var(--tx);line-height:1.7;white-space:pre-wrap;padding-top:10px}
.spicker{background:var(--sf2);border:1px solid var(--bd);border-radius:10px;max-height:220px;overflow-y:auto;margin-top:8px}
.spicker-item{padding:10px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;transition:background .15s;border-bottom:1px solid var(--bd)}
.spicker-item:last-child{border-bottom:none}
.spicker-item:hover{background:var(--bd)}
.spicker-title{font-size:14px;color:var(--tx);font-family:'Playfair Display',serif}
.spicker-artist{font-size:11px;color:var(--mu)}
`;

// ─── YOUTUBE PLAYER ───────────────────────────────────────────────────────────
function YTPlayer({ url }) {
  const vid = getYtId(url);
  if (!vid) return null;
  const watchUrl = `https://www.youtube.com/watch?v=${vid}`;
  const thumbUrl = `https://img.youtube.com/vi/${vid}/mqdefault.jpg`;
  return (
    <div className="yt-wrap">
      <div className="yt-thumb-area">
        <img src={thumbUrl} alt="thumb" className="yt-thumb" onError={e=>{e.target.style.display="none";}}/>
        <div className="yt-overlay">
          <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="yt-open-btn">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="white"><path d="M5 3l14 9-14 9V3z"/></svg>
            Putar di YouTube
          </a>
        </div>
      </div>
      <div className="yt-footer"><YtIcon/><strong style={{color:"#ff6060"}}>YouTube</strong>&nbsp;· Tap untuk dengarkan referensi</div>
    </div>
  );
}

// ─── AI RECOMMENDER ───────────────────────────────────────────────────────────
function AIRecommender({ onAddSong, onClose }) {
  const [tema, setTema] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [added, setAdded] = useState({});
  const ask = async () => {
    if (!tema.trim()) return;
    setLoading(true); setResults(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1200,
          messages:[{ role:"user", content:`Kamu adalah asisten musik worship gereja Kristen Indonesia. Berikan 6 rekomendasi lagu worship/pujian yang cocok untuk tema: "${tema}".\n\nBalas HANYA dengan JSON array tanpa teks atau markdown:\n[{"title":"Judul","artist":"Artis","nada":"G","themes":["Tema1","Tema2"],"reason":"Alasan singkat"}]` }]
        })
      });
      const data = await res.json();
      const txt = data.content?.map(c=>c.text||"").join("")||"[]";
      setResults(JSON.parse(txt.replace(/```json|```/g,"").trim()));
    } catch { setResults([]); }
    setLoading(false);
  };
  return (
    <div className="mo" onClick={onClose}>
      <div className="md" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div className="mt" style={{margin:0}}>✨ AI Song Advisor</div>
          <button className="ib" onClick={onClose}><XIcon/></button>
        </div>
        <p style={{fontSize:13,color:"var(--mu)",marginBottom:16,lineHeight:1.7}}>Ketik tema khotbah, AI rekomendasikan lagu beserta nada dasarnya.</p>
        <div className="fg">
          <label className="fl">Tema Khotbah</label>
          <input className="fi" value={tema} onChange={e=>setTema(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ask()} placeholder='cth: "Pengampunan", "Kasih Allah"'/>
        </div>
        <button className="btn btn-ai" style={{width:"100%",opacity:(!tema.trim()||loading)?0.5:1}} onClick={ask} disabled={!tema.trim()||loading}>
          {loading?"Memproses...":"✨ Dapatkan Rekomendasi"}
        </button>
        {loading&&<div className="ai-think"><div className="spin"/><span>AI sedang mencari<span className="dots"><span>.</span><span>.</span><span>.</span></span></span></div>}
        {results&&results.length===0&&<div className="empty">Tidak ada hasil. Coba tema lain.</div>}
        {results&&results.length>0&&(
          <div className="ai-res">
            <div style={{fontSize:12,color:"var(--mu)",marginBottom:4}}>{results.length} rekomendasi · tap <strong style={{color:"var(--gold)"}}>+ Simpan</strong></div>
            {results.map((s,i)=>(
              <div key={i} className="ai-card">
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <div className="ai-ttl" style={{margin:0}}>{s.title}</div>
                    {s.nada&&<NadaBadge nada={s.nada} size="sm"/>}
                  </div>
                  <div className="ai-art">{s.artist}</div>
                  <div className="stags">{(s.themes||[]).map(t=><span key={t} className="ttag">{t}</span>)}</div>
                  {s.reason&&<div style={{fontSize:11,color:"var(--mu)",marginTop:6,fontStyle:"italic"}}>💡 {s.reason}</div>}
                </div>
                <button className={`ai-add${added[i]?" done":""}`}
                  onClick={()=>{ if(!added[i]){ onAddSong({id:"ai"+Date.now()+i,title:s.title,artist:s.artist,nada:s.nada||"",themes:s.themes||[],lyrics:"",youtube:""}); setAdded(a=>({...a,[i]:true})); } }}>
                  {added[i]?"✓ Tersimpan":"+ Simpan"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SONG BANK ────────────────────────────────────────────────────────────────
function SongBank({ isCoord, toast }) {
  const [songs, setSongs] = useState(null);
  const [query, setQuery] = useState("");
  const [activeTheme, setActiveTheme] = useState("");
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editSong, setEditSong] = useState(null);
  const [showAI, setShowAI] = useState(false);
  useEffect(()=>{(async()=>{const d=await storageGet("pw_songs");setSongs(d||SAMPLE_SONGS);})();},[]);
  const save = useCallback(async ns=>{setSongs(ns);await storageSet("pw_songs",ns);},[]);
  const filtered=(songs||[]).filter(s=>{
    const q=query.toLowerCase();
    const mq=!q||s.title.toLowerCase().includes(q)||s.artist.toLowerCase().includes(q)||(s.lyrics||"").toLowerCase().includes(q)||s.themes.some(t=>t.toLowerCase().includes(q))||(s.nada||"").toLowerCase().includes(q);
    return mq&&(!activeTheme||s.themes.includes(activeTheme));
  });
  if (songs===null) return <div className="loading"><div className="spin"/></div>;
  if (selected) return (
    <div className="lv">
      <div className="lhdr">
        <button className="ib" style={{flexShrink:0}} onClick={()=>setSelected(null)}><BackIcon/></button>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:19,color:"var(--gold)"}}>{selected.title}</div>
          <div style={{fontSize:12,color:"var(--mu)",marginTop:2}}>{selected.artist}</div>
        </div>
      </div>
      {selected.nada ? (
        <div className="nada-banner">
          <div>
            <div className="nada-banner-label">Nada Dasar</div>
            <div className="nada-banner-val">Do = {selected.nada}</div>
            <div className="nada-banner-sub">Nada asli lagu ini</div>
          </div>
          <div style={{marginLeft:"auto",width:56,height:56,borderRadius:12,background:"rgba(201,168,76,.15)",border:"2px solid var(--gold)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Playfair Display',serif",fontSize:28,color:"var(--gold)",fontWeight:700}}>{selected.nada}</div>
        </div>
      ) : (
        <div style={{margin:"0 16px 12px",padding:"10px 14px",background:"var(--sf2)",border:"1px dashed var(--bd)",borderRadius:10,fontSize:12,color:"var(--mu)",fontStyle:"italic"}}>ℹ Nada dasar belum diisi{isCoord&&" — edit lagu untuk menambahkan"}</div>
      )}
      {selected.youtube&&<YTPlayer url={selected.youtube}/>}
      <div className="lbody">
        {selected.lyrics?<div className="ltxt">{selected.lyrics}</div>:<div style={{color:"var(--mu)",fontStyle:"italic",fontSize:14,lineHeight:1.8}}>Lirik belum ditambahkan.{isCoord&&" Gunakan menu edit."}</div>}
      </div>
      <div className="ltags">{selected.themes.map(t=><span key={t} className="ttag">{t}</span>)}</div>
    </div>
  );
  return (
    <>
      <div className="sw"><div className="sbox"><SearchIcon/><input placeholder="Cari judul, artis, tema, nada..." value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button className="ib" style={{padding:2}} onClick={()=>setQuery("")}><XIcon/></button>}</div></div>
      <div className="tscr">{["",...THEMES].map(t=><div key={t} className={`chip${activeTheme===t?" on":""}`} onClick={()=>setActiveTheme(t)}>{t||"Semua"}</div>)}</div>
      <div className="slist">
        {filtered.length===0 ? (
          <div className="empty"><div style={{marginBottom:10,opacity:.3}}><MusicIcon/></div><div style={{fontSize:15}}>Lagu tidak ditemukan</div><div style={{fontSize:12,marginTop:4,opacity:.7}}>Coba gunakan ✨ AI Advisor</div></div>
        ) : filtered.map(s=>(
          <div key={s.id} className="scard" onClick={()=>setSelected(s)}>
            <NadaBadge nada={s.nada} size="md"/>
            <div style={{flex:1}}>
              <div className="stitle">{s.title}</div>
              <div className="sartist">{s.artist}{s.youtube&&<span className="ytbadge"><YtIcon/>Audio</span>}</div>
              <div className="stags">{s.themes.map(t=><span key={t} className="ttag">{t}</span>)}</div>
            </div>
            {isCoord&&(
              <div className="sact" onClick={e=>e.stopPropagation()}>
                <button className="ib" onClick={()=>{setEditSong(s);setShowForm(true)}}><EditIcon/></button>
                <button className="ib del" onClick={async()=>{await save(songs.filter(x=>x.id!==s.id));toast("Lagu dihapus")}}><TrashIcon/></button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="fab-grp">
        <button className="fab ai" onClick={()=>setShowAI(true)}><SparkIcon/></button>
        {isCoord&&<button className="fab add" onClick={()=>{setEditSong(null);setShowForm(true)}}><PlusIcon/></button>}
      </div>
      {showForm&&<SongForm song={editSong} onClose={()=>setShowForm(false)} onSave={async d=>{const up=d.id?songs.map(s=>s.id===d.id?d:s):[...songs,{...d,id:"s"+Date.now()}];await save(up);setShowForm(false);toast(d.id?"Lagu diperbarui":"Lagu ditambahkan");}}/>}
      {showAI&&<AIRecommender onClose={()=>setShowAI(false)} onAddSong={async s=>{await save([...(songs||[]),s]);toast(`"${s.title}" disimpan ke Bank Lagu`);}}/>}
    </>
  );
}

function SongForm({ song, onClose, onSave }) {
  const [title,setTitle]=useState(song?.title||"");
  const [artist,setArtist]=useState(song?.artist||"");
  const [nada,setNada]=useState(song?.nada||"");
  const [youtube,setYoutube]=useState(song?.youtube||"");
  const [lyrics,setLyrics]=useState(song?.lyrics||"");
  const [themes,setThemes]=useState(song?.themes||[]);
  const toggleT=t=>setThemes(p=>p.includes(t)?p.filter(x=>x!==t):[...p,t]);
  const valid=title.trim()&&artist.trim()&&themes.length>0;
  const ytId=getYtId(youtube);
  return (
    <div className="mo" onClick={onClose}><div className="md" onClick={e=>e.stopPropagation()}>
      <div className="mt">{song?"Edit Lagu":"Tambah Lagu"}</div>
      <div className="fg"><label className="fl">Judul *</label><input className="fi" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Judul lagu"/></div>
      <div className="fg"><label className="fl">Artis *</label><input className="fi" value={artist} onChange={e=>setArtist(e.target.value)} placeholder="Nama artis"/></div>
      <div className="fg">
        <label className="fl">🎵 Nada Dasar{nada&&<span style={{color:"var(--gold)",fontWeight:700,marginLeft:8}}>→ Do = {nada}</span>}</label>
        <div className="nada-grid">{NADA_LIST.map(n=><div key={n} className={`nada-chip${nada===n?" on":""}`} onClick={()=>setNada(nada===n?"":n)}>{n}</div>)}</div>
      </div>
      <div className="fg">
        <label className="fl" style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:"#ff6060",display:"flex",alignItems:"center",gap:4}}><YtIcon/>Link YouTube</span><span style={{color:"var(--mu)",fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:11}}>(opsional)</span></label>
        <input className="fi" value={youtube} onChange={e=>setYoutube(e.target.value)} placeholder="https://youtube.com/watch?v=..."/>
        {youtube&&!ytId&&<div style={{fontSize:11,color:"var(--danger)",marginTop:4}}>⚠ Link tidak valid</div>}
        {ytId&&<div style={{fontSize:11,color:"var(--ok)",marginTop:4}}>✓ Video ID: {ytId}</div>}
      </div>
      <div className="fg"><label className="fl">Lirik <span style={{color:"var(--mu)",fontWeight:400,textTransform:"none",letterSpacing:0}}>(opsional)</span></label><textarea className="fi fta" style={{minHeight:130}} value={lyrics} onChange={e=>setLyrics(e.target.value)} placeholder="Paste lirik lagu..."/></div>
      <div className="fg"><label className="fl">Tema *</label><div className="tgrid">{THEMES.map(t=><div key={t} className={`chip${themes.includes(t)?" on":""}`} onClick={()=>toggleT(t)}>{t}</div>)}</div></div>
      <div className="brow"><button className="btn btn-g" onClick={onClose}>Batal</button><button className="btn btn-p" style={{opacity:valid?1:.5}} disabled={!valid} onClick={()=>onSave({...song,title,artist,nada,youtube,lyrics,themes})}>{song?"Simpan":"Tambah"}</button></div>
    </div></div>
  );
}

// ─── SETLIST ──────────────────────────────────────────────────────────────────
function SetlistPage({ isCoord, toast, songs }) {
  const [setlists, setSetlists] = useState(null);
  const [activeType, setActiveType] = useState("raya");
  const [detail, setDetail] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editSetlist, setEditSetlist] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(()=>{(async()=>{const d=await storageGet("pw_setlists");setSetlists(d||[]);})();},[]);
  const save=useCallback(async ns=>{setSetlists(ns);await storageSet("pw_setlists",ns);},[]);
  const filtered=(setlists||[]).filter(sl=>sl.type===activeType).sort((a,b)=>new Date(b.date)-new Date(a.date));

  const handleExport = async (sl) => {
    setExporting(true);
    try { exportSetlistPDF(sl); toast("PDF berhasil diunduh!"); }
    catch(e) { toast("Gagal export PDF"); }
    setExporting(false);
  };

  if (setlists===null) return <div className="loading"><div className="spin"/></div>;

  if (detail) {
    const typeInfo = IBADAH_TYPES.find(t=>t.key===detail.type);
    return (
      <div className="slv">
        <div className="slv-hdr">
          <div className="slv-hdr-top">
            <button className="ib" onClick={()=>setDetail(null)}><BackIcon/></button>
            <div style={{flex:1}}>
              <div className="slv-title">{detail.title}</div>
              <div style={{fontSize:11,color:"var(--mu)",marginTop:2}}>{detail.date&&fmtShort(detail.date)}</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {isCoord&&<button className="ib" onClick={()=>{setEditSetlist(detail);setDetail(null);setShowForm(true)}}><EditIcon/></button>}
              {isCoord&&<button className="ib del" onClick={async()=>{await save(setlists.filter(s=>s.id!==detail.id));setDetail(null);toast("Setlist dihapus");}}><TrashIcon/></button>}
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <span className={`sl-type-badge ${detail.type}`}>{typeInfo.emoji} {typeInfo.label}</span>
              {detail.tema&&<span style={{fontSize:12,color:"var(--mu)"}}>📖 <strong style={{color:"var(--tx)"}}>{detail.tema}</strong></span>}
            </div>
            <PdfButton onClick={()=>handleExport(detail)} loading={exporting} label="Export PDF"/>
          </div>
        </div>
        <div className="slv-body">
          {detail.catatan&&(
            <div style={{background:"var(--sf2)",border:"1px solid var(--bd)",borderRadius:12,padding:"12px 14px",marginBottom:14}}>
              <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:".1em",color:"var(--gold)",marginBottom:6,fontWeight:600}}>📋 Catatan Umum</div>
              <div style={{fontSize:13,color:"var(--tx)",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{detail.catatan}</div>
            </div>
          )}
          <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:".1em",color:typeInfo.color,fontWeight:600,marginBottom:10}}>{typeInfo.emoji} Alur Lagu ({detail.songs?.length||0} lagu)</div>
          {(detail.songs||[]).length===0&&<div className="empty"><div style={{fontSize:14}}>Belum ada lagu dalam setlist ini</div></div>}
          {(detail.songs||[]).map((item,i)=>(
            <div key={i} className="ssl-item">
              <div className="ssl-item-hdr">
                <div className="ssl-num">{i+1}</div>
                <div className="ssl-info">
                  <div className="ssl-title">{item.title}</div>
                  <div className="ssl-artist">{item.artist}</div>
                  <div className="ssl-meta">
                    {item.nada&&<NadaBadge nada={item.nada} size="sm"/>}
                    {item.alur&&<span className="ssl-alur" style={{background:typeInfo.bg,color:typeInfo.color,border:`1px solid ${typeInfo.border}`}}>{item.alur}</span>}
                  </div>
                </div>
              </div>
              {item.catatan&&(
                <div className="ssl-body">
                  <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",color:"var(--mu)",marginBottom:4,fontWeight:600}}>Catatan untuk tim</div>
                  <div className="ssl-note">{item.catatan}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{paddingBottom:16}}>
      <div className="sl-tabs">
        {IBADAH_TYPES.map(t=>(
          <div key={t.key} className={`sl-tab ${t.key}${activeType===t.key?" on":""}`} onClick={()=>setActiveType(t.key)}>
            <div className="sl-tab-emoji">{t.emoji}</div>
            <div className="sl-tab-label" style={{color:activeType===t.key?t.color:"var(--tx)"}}>{t.label}</div>
            <div className="sl-tab-count">{(setlists||[]).filter(s=>s.type===t.key).length} setlist</div>
          </div>
        ))}
      </div>
      <div className="sl-wrap">
        {filtered.length===0 ? (
          <div className="empty">
            <div style={{marginBottom:10,opacity:.3}}><ListIcon/></div>
            <div style={{fontSize:15}}>Belum ada setlist {IBADAH_TYPES.find(t=>t.key===activeType)?.label}</div>
            {isCoord&&<div style={{fontSize:12,marginTop:6,opacity:.7}}>Tap + untuk buat setlist baru</div>}
          </div>
        ) : filtered.map(sl=>{
          const typeInfo=IBADAH_TYPES.find(t=>t.key===sl.type);
          return (
            <div key={sl.id} className={`sl-card ${sl.type}`} onClick={()=>setDetail(sl)}>
              <div className="sl-card-hdr">
                <div style={{flex:1}}>
                  <div className="sl-card-title">{sl.title}</div>
                  <div className="sl-card-date">{sl.date&&new Date(sl.date).toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</div>
                  {sl.tema&&<div style={{fontSize:11,color:"var(--mu)",marginTop:2}}>📖 {sl.tema}</div>}
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                  <span className={`sl-type-badge ${sl.type}`}>{typeInfo.emoji} {typeInfo.label}</span>
                  <span style={{fontSize:11,color:"var(--mu)"}}>{sl.songs?.length||0} lagu</span>
                </div>
              </div>
              {(sl.songs||[]).length>0&&(
                <div className="sl-songs-preview">
                  {sl.songs.slice(0,3).map((s,i)=>(
                    <div key={i} className="sl-preview-item">
                      <div className="sl-num">{i+1}</div>
                      <span style={{flex:1}}>{s.title}</span>
                      {s.nada&&<span style={{fontSize:10,color:"var(--gold)",fontFamily:"'Playfair Display',serif",fontWeight:700}}>Do={s.nada}</span>}
                      {s.alur&&<span style={{fontSize:10,color:typeInfo.color,background:typeInfo.bg,padding:"1px 6px",borderRadius:999}}>{s.alur}</span>}
                    </div>
                  ))}
                  {sl.songs.length>3&&<div style={{fontSize:11,color:"var(--mu)",paddingLeft:26}}>+{sl.songs.length-3} lagu lainnya...</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {isCoord&&<button className="fab add" style={{position:"fixed",bottom:80,right:16,zIndex:50}} onClick={()=>{setEditSetlist(null);setShowForm(true)}}><PlusIcon/></button>}
      {showForm&&<SetlistForm setlist={editSetlist} songs={songs||[]} defaultType={activeType} onClose={()=>{setShowForm(false);setEditSetlist(null);}} onSave={async d=>{const up=d.id?setlists.map(s=>s.id===d.id?d:s):[...setlists,{...d,id:"sl"+Date.now()}];await save(up);setShowForm(false);setEditSetlist(null);toast(d.id?"Setlist diperbarui":"Setlist dibuat");}}/>}
    </div>
  );
}

function SetlistForm({ setlist, songs, defaultType, onClose, onSave }) {
  const [title,setTitle]=useState(setlist?.title||"");
  const [type,setType]=useState(setlist?.type||defaultType||"raya");
  const [date,setDate]=useState(setlist?.date||new Date().toISOString().slice(0,10));
  const [tema,setTema]=useState(setlist?.tema||"");
  const [catatan,setCatatan]=useState(setlist?.catatan||"");
  const [items,setItems]=useState(setlist?.songs||[]);
  const [showPicker,setShowPicker]=useState(false);
  const [pickerQuery,setPickerQuery]=useState("");
  const addSong=(song)=>{setItems(prev=>[...prev,{title:song.title,artist:song.artist,nada:song.nada||"",alur:"",catatan:""}]);setShowPicker(false);setPickerQuery("");};
  const removeItem=(i)=>setItems(prev=>prev.filter((_,idx)=>idx!==i));
  const moveUp=(i)=>{if(i===0)return;const a=[...items];[a[i-1],a[i]]=[a[i],a[i-1]];setItems(a);};
  const moveDown=(i)=>{if(i===items.length-1)return;const a=[...items];[a[i],a[i+1]]=[a[i+1],a[i]];setItems(a);};
  const setItemField=(i,k,v)=>setItems(prev=>prev.map((it,idx)=>idx===i?{...it,[k]:v}:it));
  const typeInfo=IBADAH_TYPES.find(t=>t.key===type);
  const filteredSongs=songs.filter(s=>!pickerQuery||s.title.toLowerCase().includes(pickerQuery.toLowerCase())||s.artist.toLowerCase().includes(pickerQuery.toLowerCase()));
  const valid=title.trim();
  return (
    <div className="mo" onClick={onClose}><div className="md" onClick={e=>e.stopPropagation()}>
      <div className="mt">{setlist?"Edit Setlist":"Buat Setlist Baru"}</div>
      <div className="fg">
        <label className="fl">Jenis Ibadah *</label>
        <div style={{display:"flex",gap:8}}>
          {IBADAH_TYPES.map(t=>(
            <div key={t.key} onClick={()=>setType(t.key)} style={{flex:1,padding:"10px 12px",borderRadius:10,border:`2px solid ${type===t.key?t.color:"var(--bd)"}`,background:type===t.key?t.bg:"var(--sf2)",cursor:"pointer",textAlign:"center",transition:"all .2s"}}>
              <div style={{fontSize:20}}>{t.emoji}</div>
              <div style={{fontSize:12,fontWeight:600,color:type===t.key?t.color:"var(--mu)",marginTop:3}}>{t.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="fg"><label className="fl">Judul / Nama Setlist *</label><input className="fi" value={title} onChange={e=>setTitle(e.target.value)} placeholder='cth: "Ibadah Raya Minggu 1 Mei"'/></div>
      <div className="fg"><label className="fl">Tanggal Ibadah</label><input className="fi" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
      <div className="fg"><label className="fl">Tema Khotbah</label><input className="fi" value={tema} onChange={e=>setTema(e.target.value)} placeholder="cth: Kasih Yang Tak Terbatas"/></div>
      <div className="fg"><label className="fl">Catatan Umum untuk Tim</label><textarea className="fi fta" value={catatan} onChange={e=>setCatatan(e.target.value)} placeholder="Catatan khusus, instruksi transisi, tempo ibadah, dll..."/></div>
      <div className="div"/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <label className="fl" style={{margin:0}}>🎵 Susunan Lagu ({items.length})</label>
        <button className="btn btn-p" style={{padding:"6px 14px",fontSize:12}} onClick={()=>setShowPicker(!showPicker)}>+ Tambah Lagu</button>
      </div>
      {showPicker&&(
        <div className="fg">
          <input className="fi" value={pickerQuery} onChange={e=>setPickerQuery(e.target.value)} placeholder="Cari lagu dari Bank Lagu..." autoFocus/>
          <div className="spicker">
            {filteredSongs.length===0&&<div style={{padding:"12px 14px",fontSize:13,color:"var(--mu)"}}>Tidak ada lagu. Tambah dulu di Bank Lagu.</div>}
            {filteredSongs.map(s=>(
              <div key={s.id} className="spicker-item" onClick={()=>addSong(s)}>
                <NadaBadge nada={s.nada} size="sm"/>
                <div><div className="spicker-title">{s.title}</div><div className="spicker-artist">{s.artist}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}
      {items.length===0&&!showPicker&&<div style={{textAlign:"center",padding:"16px 0",color:"var(--mu)",fontSize:13,fontStyle:"italic"}}>Belum ada lagu. Tap "+ Tambah Lagu".</div>}
      {items.map((item,i)=>(
        <div key={i} style={{background:"var(--sf2)",border:"1px solid var(--bd)",borderRadius:12,marginBottom:8,overflow:"hidden"}}>
          <div style={{padding:"10px 12px",display:"flex",alignItems:"center",gap:8,background:"rgba(0,0,0,.15)"}}>
            <div style={{width:24,height:24,borderRadius:"50%",background:typeInfo.bg,border:`1px solid ${typeInfo.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:typeInfo.color,flexShrink:0}}>{i+1}</div>
            <div style={{flex:1}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,color:"var(--tx)"}}>{item.title}</div>
              <div style={{fontSize:11,color:"var(--mu)"}}>{item.artist}</div>
            </div>
            <div style={{display:"flex",gap:4}}>
              <button className="ib" onClick={()=>moveUp(i)} disabled={i===0} style={{opacity:i===0 ? 0.3 : 1}}><UpIcon/></button>
              <button className="ib" onClick={()=>moveDown(i)} disabled={i===items.length-1} style={{opacity:i===items.length-1 ? 0.3 : 1}}><DownIcon/></button>
              <button className="ib del" onClick={()=>removeItem(i)}><TrashIcon/></button>
            </div>
          </div>
          <div style={{padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
            <div>
              <label className="fl" style={{fontSize:10}}>Nada Dasar{item.nada&&<span style={{color:"var(--gold)",marginLeft:6}}>→ Do = {item.nada}</span>}</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {NADA_LIST.map(n=>(
                  <div key={n} onClick={()=>setItemField(i,"nada",item.nada===n?"":n)}
                    style={{padding:"4px 10px",borderRadius:6,background:item.nada===n?"linear-gradient(135deg,#2a1f00,#3d2e00)":"var(--sf)",border:`1.5px solid ${item.nada===n?"var(--gold)":"var(--bd)"}`,fontSize:12,fontWeight:600,color:item.nada===n?"var(--gold)":"var(--mu)",cursor:"pointer",fontFamily:"'Playfair Display',serif"}}>
                    {n}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="fl" style={{fontSize:10}}>Alur / Segmen</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {ALUR_OPTIONS.map(a=>(
                  <div key={a} onClick={()=>setItemField(i,"alur",item.alur===a?"":a)}
                    style={{padding:"4px 10px",borderRadius:999,background:item.alur===a?typeInfo.bg:"var(--sf)",border:`1px solid ${item.alur===a?typeInfo.border:"var(--bd)"}`,fontSize:11,fontWeight:600,color:item.alur===a?typeInfo.color:"var(--mu)",cursor:"pointer"}}>
                    {a}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="fl" style={{fontSize:10}}>Catatan untuk Pemusik & WL</label>
              <textarea className="fi fta" style={{minHeight:60,fontSize:13}} value={item.catatan} onChange={e=>setItemField(i,"catatan",e.target.value)} placeholder="cth: Tempo lambat, fade out di akhir, repeat chorus 2x, key naik ke A..."/>
            </div>
          </div>
        </div>
      ))}
      <div className="brow">
        <button className="btn btn-g" onClick={onClose}>Batal</button>
        <button className="btn btn-p" style={{opacity:valid?1:.5}} disabled={!valid} onClick={()=>onSave({...setlist,title,type,date,tema,catatan,songs:items})}>{setlist?"Simpan":"Buat Setlist"}</button>
      </div>
    </div></div>
  );
}

// ─── SCHEDULE ─────────────────────────────────────────────────────────────────
function Schedule({ isCoord, toast }) {
  const now = new Date();
  const [year,setYear]=useState(now.getFullYear());
  const [month,setMonth]=useState(now.getMonth());
  const [data,setData]=useState(null);
  const [editWeek,setEditWeek]=useState(null);
  const [exporting,setExporting]=useState(false);
  const key=`pw_sched_${year}_${month}`;
  useEffect(()=>{(async()=>{setData(null);const d=await storageGet(key);setData(d||{});})();},[key]);
  const saveData=async nd=>{setData(nd);await storageSet(key,nd);};
  const prevM=()=>{if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1);};
  const nextM=()=>{if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1);};
  const sundays=getSundays(year,month);

  const handleExport = async () => {
    setExporting(true);
    try { exportSchedulePDF(year, month, data); toast("PDF berhasil diunduh!"); }
    catch(e) { toast("Gagal export PDF"); }
    setExporting(false);
  };

  return (
    <div className="schw">
      <div className="mnav">
        <div className="nc" onClick={prevM}><ChevL/></div>
        <div style={{textAlign:"center"}}><div className="mname">{MONTHS[month]}</div><div className="myear">{year}</div></div>
        <div className="nc" onClick={nextM}><ChevR/></div>
      </div>

      {/* PDF Export Bar */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,padding:"10px 14px",background:"var(--sf2)",border:"1px solid var(--bd)",borderRadius:12}}>
        <div>
          <div style={{fontSize:12,fontWeight:600,color:"var(--tx)"}}>📄 Export Jadwal</div>
          <div style={{fontSize:11,color:"var(--mu)",marginTop:2}}>{MONTHS[month]} {year} · {sundays.length} Minggu</div>
        </div>
        <PdfButton onClick={handleExport} loading={exporting}/>
      </div>

      {data===null ? <div className="loading"><div className="spin"/></div> : sundays.map((sun,i)=>{
        const k=sun.toISOString().slice(0,10);const e=data[k]||{};
        return (
          <div key={k} className="wcard">
            <div className="whdr">
              <div><div className="wdate">{fmtD(sun)}</div>{e.title&&<div style={{fontSize:12,color:"var(--mu)",marginTop:2}}>{e.title}</div>}</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span className="wtype">Minggu {i+1}</span>
                {isCoord&&<button className="ib" onClick={()=>setEditWeek({key:k,sun,e})}><EditIcon/></button>}
              </div>
            </div>
            <div className="wbody">
              {e.rehearsal&&<div style={{marginBottom:10}}><span className="evbadge">🕐 Latihan: {e.rehearsal}</span></div>}
              <div className="seclbl">🎤 Worship</div>
              {WORSHIP_ROLES.map(({key:rk,label,badge})=>(
                <div key={rk} className="srow">
                  <div className="slbl"><span style={{background:"var(--gold)",color:"#0f1923",borderRadius:4,padding:"1px 5px",fontSize:9,fontWeight:700,flexShrink:0}}>{badge}</span><span>{label}</span></div>
                  <div className="snames">{e[rk]||<span className="semp">—</span>}</div>
                </div>
              ))}
              <div style={{height:8}}/>
              <div className="seclbl">🎸 Pemusik</div>
              {MUSIC_ROLES.map(role=>(
                <div key={role} className="srow">
                  <div className="slbl">{role}</div>
                  <div className="snames">{e[role]||<span className="semp">—</span>}</div>
                </div>
              ))}
              {e.notes&&<><div className="div"/><div style={{fontSize:12,color:"var(--mu)",fontStyle:"italic"}}>{e.notes}</div></>}
            </div>
          </div>
        );
      })}
      {isCoord&&editWeek&&<WeekForm wd={editWeek} onClose={()=>setEditWeek(null)} onSave={async(k,entry)=>{await saveData({...data,[k]:entry});setEditWeek(null);toast("Jadwal disimpan");}}/>}
    </div>
  );
}

function WeekForm({ wd, onClose, onSave }) {
  const {key,sun,e}=wd;
  const [form,setForm]=useState({title:"",rehearsal:"",notes:"",...ALL_SLOT_KEYS.reduce((a,r)=>({...a,[r]:""}),{}),...e});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  return (
    <div className="mo" onClick={onClose}><div className="md" onClick={ev=>ev.stopPropagation()}>
      <div className="mt">Jadwal {fmtD(sun)}</div>
      <div className="fg"><label className="fl">Tema Ibadah</label><input className="fi" value={form.title} onChange={e=>set("title",e.target.value)} placeholder="cth: Kasih Yang Tak Terbatas"/></div>
      <div className="fg"><label className="fl">Jadwal Latihan</label><input className="fi" value={form.rehearsal} onChange={e=>set("rehearsal",e.target.value)} placeholder="cth: Sabtu 14 Jun · 15.00 WIT"/></div>
      <div className="div"/>
      <div className="seclbl" style={{marginBottom:10}}>🎤 Worship</div>
      {WORSHIP_ROLES.map(({key:rk,label,badge})=>(
        <div key={rk} className="fg">
          <label className="fl"><span style={{background:"var(--gold)",color:"#0f1923",borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700,marginRight:5}}>{badge}</span>{label}</label>
          <input className="fi" value={form[rk]||""} onChange={e=>set(rk,e.target.value)} placeholder={`Nama ${label}`}/>
        </div>
      ))}
      <div className="div"/>
      <div className="seclbl" style={{marginBottom:10}}>🎸 Pemusik</div>
      {MUSIC_ROLES.map(role=>(
        <div key={role} className="fg">
          <label className="fl">{role}</label>
          <input className="fi" value={form[role]||""} onChange={e=>set(role,e.target.value)} placeholder={`Nama pemain ${role.toLowerCase()}`}/>
        </div>
      ))}
      <div className="fg"><label className="fl">Catatan</label><input className="fi" value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Catatan tambahan..."/></div>
      <div className="brow"><button className="btn btn-g" onClick={onClose}>Batal</button><button className="btn btn-p" onClick={()=>onSave(key,form)}>Simpan</button></div>
    </div></div>
  );
}

// ─── PIN ──────────────────────────────────────────────────────────────────────
function PinModal({ onOk, onCancel }) {
  const [pin,setPin]=useState(""); const [err,setErr]=useState("");
  const submit=async()=>{const stored=await storageGet("pw_pin");if(pin===(stored||DEFAULT_PIN))onOk();else{setErr("PIN salah. Coba lagi.");setPin("");}};
  return (
    <div className="pm"><div className="pc">
      <div style={{color:"var(--gold)",display:"flex",justifyContent:"center",marginBottom:12}}><LockIcon/></div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"var(--gold)",marginBottom:6}}>Mode Koordinator</div>
      <div style={{fontSize:13,color:"var(--mu)",marginBottom:22}}>Masukkan PIN untuk akses edit</div>
      <input className="pinp" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e=>{setPin(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="••••" autoFocus/>
      <div className="perr">{err}</div>
      <div className="brow"><button className="btn btn-g" onClick={onCancel}>Batal</button><button className="btn btn-p" onClick={submit}>Masuk</button></div>
      <div style={{marginTop:14,fontSize:11,color:"var(--mu)"}}>PIN default: <strong style={{color:"var(--gold)"}}>1234</strong></div>
    </div></div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,setTab]=useState("songs");
  const [isCoord,setIsCoord]=useState(false);
  const [showPin,setShowPin]=useState(false);
  const [toastMsg,setToastMsg]=useState("");
  const [songs,setSongs]=useState([]);
  const toast=msg=>{setToastMsg(msg);setTimeout(()=>setToastMsg(""),2700);};
  const toggleCoord=()=>{if(isCoord){setIsCoord(false);toast("Keluar mode koordinator");}else setShowPin(true);};
  useEffect(()=>{(async()=>{const d=await storageGet("pw_songs");setSongs(d||SAMPLE_SONGS);})();},[]);
  const TAB_LABELS=[{key:"songs",label:"Bank Lagu",icon:<MusicIcon/>},{key:"setlist",label:"Setlist",icon:<ListIcon/>},{key:"schedule",label:"Jadwal",icon:<CalIcon/>}];
  const PAGE_TITLES={songs:"Bank Lagu",setlist:"Setlist",schedule:"Jadwal Pelayanan"};
  return (
    <>
      <style>{css}</style>
      <div className="app">
        {toastMsg&&<div className="toast">{toastMsg}</div>}
        <div className="hdr">
          <div><div className="htitle">🎵 Worship App</div><div className="hsub">{PAGE_TITLES[tab]}</div></div>
          <div className={`rbadge${isCoord?" coord":""}`} onClick={toggleCoord}>
            {isCoord?<UnlockIcon/>:<LockIcon/>}{isCoord?"Koordinator":"Viewer"}
          </div>
        </div>
        <div className="content">
          {tab==="songs"&&<SongBank isCoord={isCoord} toast={toast}/>}
          {tab==="setlist"&&<SetlistPage isCoord={isCoord} toast={toast} songs={songs}/>}
          {tab==="schedule"&&<Schedule isCoord={isCoord} toast={toast}/>}
        </div>
        <nav className="nav">
          {TAB_LABELS.map(t=><button key={t.key} className={`nb${tab===t.key?" on":""}`} onClick={()=>setTab(t.key)}>{t.icon}{t.label}</button>)}
        </nav>
        {showPin&&<PinModal onOk={()=>{setIsCoord(true);setShowPin(false);toast("Mode koordinator aktif ✓");}} onCancel={()=>setShowPin(false)}/>}
      </div>
    </>
  );
}
