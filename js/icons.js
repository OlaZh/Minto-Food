// icons.js — єдине джерело всіх SVG іконок
// Стиль: stroke-width=1.6, round caps/joins, viewBox 0 0 24 24

const A = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const svg = (body, extra = '') => `<svg ${A}${extra}>${body}</svg>`;

// ── Navigation ────────────────────────────────────────────────
export const iconChevronDown  = svg('<path d="M6 9l6 6 6-6"/>');
export const iconChevronUp    = svg('<path d="M18 15l-6-6-6 6"/>');
export const iconChevronLeft  = svg('<path d="M15 18l-6-6 6-6"/>');
export const iconChevronRight = svg('<path d="M9 18l6-6-6-6"/>');

// ── Actions ───────────────────────────────────────────────────
export const iconClose  = svg('<path d="M18 6L6 18M6 6l12 12"/>');
export const iconPlus   = svg('<path d="M12 5v14M5 12h14"/>');
export const iconSearch = svg('<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>');
export const iconGlobe  = svg('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20"/>');
export const iconCheck  = svg('<polyline points="20 6 9 17 4 12"/>');
export const iconCopy   = svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>');
export const iconTrash  = svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>');
export const iconEdit   = svg('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>');
export const iconEye    = svg('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>');
export const iconCamera = svg('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>');
export const iconLink   = svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>');

// ── Three dots (menu) ─────────────────────────────────────────
export const iconMoreVertical   = svg('<circle cx="12" cy="5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>');
export const iconMoreHorizontal = svg('<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>');

// ── Favorites / Rating ────────────────────────────────────────
export const iconHeart       = svg('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>');
export const iconHeartFilled = svg('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="currentColor"/>');
export const iconStar        = svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>');
export const iconStarFilled  = svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor"/>');

// ── Utilities ─────────────────────────────────────────────────
export const iconDroplet  = svg('<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>');
export const iconShare    = svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>');
export const iconPin      = svg('<line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/>');
export const iconLock     = svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>');
export const iconUnlock   = svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>');
export const iconBell     = svg('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>');
export const iconInfo     = svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>');
export const iconAlert    = svg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>');
export const iconBroom    = svg('<path d="M9 3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2H9V3z"/><path d="M4 5h16M9 5v11l3 5 3-5V5"/>');

// ── Status (замість ✅ ❌ ⚠️) ──────────────────────────────────
export const iconCheckCircle = svg('<circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>');
export const iconXCircle     = svg('<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>');
export const iconAlertCircle = svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>');

// ── Time of day (замість 🌅 ☀️ 🌙) ────────────────────────────
export const iconSunrise = svg('<path d="M5.5 12a6.5 6.5 0 0 1 13 0"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="4.22" y1="5.22" x2="5.64" y2="6.64"/><line x1="19.78" y1="5.22" x2="18.36" y2="6.64"/><line x1="2" y1="9" x2="4" y2="9"/><line x1="22" y1="9" x2="20" y2="9"/>');
export const iconSun     = svg('<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>');
export const iconMoon    = svg('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>');

// ── Stats / Goals (замість 📊 🎯 ⚖️ 🔥 🏆) ──────────────────
export const iconBarChart = svg('<rect x="3" y="13" width="4" height="8" rx="0.5"/><rect x="10" y="8" width="4" height="13" rx="0.5"/><rect x="17" y="4" width="4" height="17" rx="0.5"/><line x1="3" y1="21" x2="21" y2="21"/>');
export const iconTarget   = svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>');
export const iconScale    = svg('<rect x="3" y="8" width="18" height="12" rx="2.5"/><path d="M8.5 4.5a3.5 3.5 0 0 1 7 0"/><circle cx="12" cy="14" r="2.5"/>');
export const iconFlame    = svg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3C8.93 6.86 9.78 4.95 12 3c.5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>');
export const iconTrophy   = svg('<path d="M7 21h10M12 17v4"/><path d="M17 4H7v7a5 5 0 0 0 10 0V4Z"/><path d="M7 8H4a2 2 0 0 0 0 4c0 2 1.5 3 3 3M17 8h3a2 2 0 0 1 0 4c0 2-1.5 3-3 3"/>');
export const iconInbox    = svg('<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>');

// ── Activity (замість 🚶 🏃 🚴 🏊 тощо) ──────────────────────
export const iconWalk       = svg('<circle cx="12" cy="4.5" r="2"/><path d="M8 9.5h8M12 9.5v5M9 20l3-5 3 5"/><path d="M7.5 12.5l-1.5 3M16.5 12.5l1.5 3"/>');
export const iconRun        = svg('<circle cx="14" cy="4" r="2"/><path d="M6 21l3.5-6.5L8 11l3.5-1.5L14 12l2.5 4"/><path d="M6 8.5l3 2.5M16 6l3.5-1"/>');
export const iconBike       = svg('<circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M18 15l-4-8h-4M6 15l4-8M9 7h4l2 4"/>');
export const iconSwim       = svg('<path d="M2 11c1-2 3-3 5-3s4 2 6 2 4-1 5-2"/><path d="M2 16c1-2 3-3 5-3s4 2 6 2 4-1 5-2"/><circle cx="19" cy="5.5" r="2.5"/><path d="M14 8l5-2.5"/>');
export const iconYoga       = svg('<circle cx="12" cy="4" r="2"/><path d="M6 21c0-4 2.5-7 6-7s6 3 6 7"/><path d="M4 14c2-1.5 4.5-2 8-2s6 .5 8 2"/>');
export const iconGym        = svg('<rect x="2" y="10.5" width="20" height="3" rx="1"/><rect x="0" y="8" width="4" height="8" rx="1"/><rect x="20" y="8" width="4" height="8" rx="1"/>');
export const iconDance      = svg('<circle cx="13" cy="4" r="2"/><path d="M8 22l2.5-5L9 13l3-1 2.5 4 3 4"/><path d="M9 13l-3-2M14.5 9l3-1"/>');
export const iconHike       = svg('<path d="M3 20l5-10 4 5 3-4 5 9M12 3v2M9 4.5l1.5 1M15 4.5l-1.5 1"/>');
export const iconTennis     = svg('<circle cx="14" cy="10" r="6"/><path d="M8.5 15.5l-6 6"/><path d="M11 7c.5 2 1.5 3 3 3M17 7c-.5 2-1.5 3-3 3"/>');
export const iconBall       = svg('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 9 9M3 12a9 9 0 0 0 9 9M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>');
export const iconStretch    = svg('<circle cx="12" cy="4" r="2"/><path d="M12 6v7M8 21l4-8 4 8M4 13h16"/>');
export const iconGarden     = svg('<path d="M12 22V12"/><path d="M12 14c-2-1-5 0-6-2 1-2 5-2 6 1"/><path d="M12 12c2-1 5 0 6-2-1-2-5-2-6 1"/><path d="M5 22h14"/>');
export const iconElliptical = svg('<circle cx="7" cy="17" r="3"/><circle cx="17" cy="7" r="3"/><path d="M10 17h7a3 3 0 0 0 0-6h-7M7 14V7a3 3 0 0 1 6 0"/>');

// ── Mobile Tab Bar ────────────────────────────────────────────
export const iconCalendar   = svg('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>');
export const iconGrid       = svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>');
export const iconUtensils   = svg('<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>');
export const iconListChecks = svg('<line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><polyline points="3 6 4 7 6 5"/><polyline points="3 12 4 13 6 11"/><polyline points="3 18 4 19 6 17"/>');

// ── Bottom sheet links ────────────────────────────────────────
export const iconBookOpen = svg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>');
export const iconLeaf     = svg('<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>');
export const iconUser     = svg('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>');
export const iconShield   = svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>');
export const iconSettings = svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>');
export const iconLogOut   = svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>');
export const iconBookmark = svg('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>');
export const iconFlag     = svg('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>');

// ── Sparkles / Scan ───────────────────────────────────────────
export const iconSparkles = svg('<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>');
export const iconScan     = svg('<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="7" y2="12"/><line x1="17" y1="12" x2="17" y2="12"/><line x1="12" y1="7" x2="12" y2="17"/>');

// ── Quick meal filters (замість ⚡ тощо) ──────────────────────
export const iconBolt    = svg('<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>');
export const iconKid     = svg('<circle cx="12" cy="7.5" r="3.5"/><path d="M8.6 6.8c.4-1.5 1.9-2.6 3.4-2.6s3 1.1 3.4 2.6"/><path d="M5 21v-1.5a7 7 0 0 1 14 0V21"/>');
export const iconWallet  = svg('<rect x="3" y="6" width="18" height="13" rx="2.2"/><path d="M3 10h18"/><circle cx="17" cy="14.5" r="1.1" fill="currentColor" stroke="none"/>');
export const iconNoCook  = svg('<path d="M4 11h16l-1.5 7.5a2 2 0 0 1-2 1.5h-9a2 2 0 0 1-2-1.5L4 11Z"/><path d="M8 8.5c0-1.5 1-2 1-3M12 8.5c0-1.5 1-2 1-3"/><line x1="3.5" y1="21" x2="20.5" y2="4"/>');
export const iconBento   = svg('<rect x="3" y="6" width="18" height="13" rx="2"/><line x1="12" y1="6" x2="12" y2="19"/><line x1="3" y1="12.5" x2="12" y2="12.5"/>');
export const iconCandle  = svg('<path d="M12 2.5c1 1.5 2 2.5 2 4a2 2 0 1 1-4 0c0-1.5 1-2.5 2-4Z"/><rect x="8.5" y="10" width="7" height="11" rx="1"/><path d="M8.5 14h7"/>');

// ── Meal categories (замість 🌅 🍎 🍰 🥤 🥐 тощо) ────────────
export const iconEggFried = svg('<path d="M12 3c-3 0-6 4-6 9s3 8 6 8 6-3 6-8-3-9-6-9Z"/><circle cx="12" cy="11" r="2.5"/>');
export const iconPlate    = svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.5"/>');
export const iconDinnerBowl = svg('<path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M2 11h20"/><path d="M9 6c0 1 1 1.5 1 2.5M13 5c0 1 1 1.5 1 2.5"/>');
export const iconApple    = svg('<path d="M12 7c-1.5-1.5-4-2-6 0s-1 8 1 10 4 2 5 1 1-1 2-1 1 1 2 1 3 0 5-2 3-8 1-10-4.5-1.5-6 0Z"/><path d="M12 7V5"/><path d="M12 5c1-1.5 2.5-2 4-1.5-.5 1.5-2 2.5-4 1.5Z"/>');
export const iconCakeSlice = svg('<path d="M4 20 12 5l8 15Z"/><path d="M7 14h10"/><circle cx="12" cy="5" r="1.4"/>');
export const iconMug      = svg('<path d="M5 6h12v10a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V6Z"/><path d="M17 9h2a2.5 2.5 0 0 1 0 5h-2"/><path d="M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3"/>');
export const iconBread    = svg('<path d="M4 11a6 6 0 0 1 16 0v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6Z"/><path d="M9 9c.5 2 .5 4 0 6M13 9c.5 2 .5 4 0 6"/>');

// ── Dish types ────────────────────────────────────────────────
export const iconPorridge  = svg('<path d="M3 12h18a9 9 0 0 1-18 0Z"/><path d="M5 12c1.5-1 3 1 5 0s3.5-1 5 0 3-1 4 0"/>');
export const iconSoup      = svg('<path d="M3 13h18a9 9 0 0 1-18 0Z"/><path d="M17 13 21 5"/><path d="M8 6c0 1.2-1 1.8-1 3s1 1.8 1 3"/><path d="M12 6c0 1.2-1 1.8-1 3s1 1.8 1 3"/>');
export const iconSalad     = svg('<path d="M3 13h18a9 9 0 0 1-18 0Z"/><path d="M7 13c-1-3 1-5 4-5M12 13c0-3 2-5 5-4"/><path d="M14 9c.7-.5 1.5-.5 2.5 0"/>');
export const iconSideDish  = svg('<path d="M4 14h16a8 8 0 0 1-16 0Z"/><circle cx="9" cy="11" r="0.6" fill="currentColor" stroke="none"/><circle cx="12" cy="10" r="0.6" fill="currentColor" stroke="none"/><circle cx="15" cy="11" r="0.6" fill="currentColor" stroke="none"/><circle cx="10.5" cy="8.5" r="0.6" fill="currentColor" stroke="none"/><circle cx="13.5" cy="8.5" r="0.6" fill="currentColor" stroke="none"/>');
export const iconMainCourse = svg('<path d="M6 3v8a2 2 0 0 0 2 2v8"/><path d="M6 3v4M9 3v4"/><path d="M16 3c-1.5 0-2 1.5-2 4s2 4 2 4v10"/>');
export const iconPasta     = svg('<ellipse cx="12" cy="16" rx="9" ry="3"/><path d="M5 14c2-6 5-9 7-9s5 3 7 9"/><path d="M9 14c1-3 2-5 3-5s2 2 3 5"/>');
export const iconSauce     = svg('<path d="M3 10h15l-2 8a2 2 0 0 1-2 1.5H7a2 2 0 0 1-2-1.5L3 10Z"/><path d="M18 11c2 0 3 1.5 3 3s-1 3-3 3"/><path d="M8 7c1-1 2-1 3 0s2 1 3 0"/>');
export const iconSandwich  = svg('<path d="M3 7c0-1.5 1-2.5 2.5-2.5h13C20 4.5 21 5.5 21 7v1H3V7Z"/><path d="M3 8h18l-1 3H4l-1-3Z"/><path d="M4 11h16l-1 3H5l-1-3Z"/><path d="M3 14h18v2c0 1.5-1 2.5-2.5 2.5h-13C4 18.5 3 17.5 3 16v-2Z"/>');
export const iconCasserole = svg('<path d="M2 11h20l-1 6a2 2 0 0 1-2 1.5H5a2 2 0 0 1-2-1.5L2 11Z"/><path d="M2 13H1M22 13h1"/><path d="M7 8c.5-1.5 1.5-2 1.5-3M12 8c.5-1.5 1.5-2 1.5-3M17 8c.5-1.5 1.5-2 1.5-3"/>');
export const iconPancakes  = svg('<ellipse cx="12" cy="8" rx="8" ry="2.2"/><path d="M4 8v2c0 1.2 3.6 2.2 8 2.2s8-1 8-2.2V8"/><path d="M4 12v2c0 1.2 3.6 2.2 8 2.2s8-1 8-2.2v-2"/><path d="M4 16v2c0 1.2 3.6 2.2 8 2.2s8-1 8-2.2v-2"/>');
export const iconOmelet    = svg('<circle cx="10" cy="13" r="7"/><line x1="16.5" y1="9.5" x2="22" y2="6"/><circle cx="10" cy="13" r="2.2"/>');
export const iconSmoothie  = svg('<path d="M6 4h12l-1.5 16a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5L6 4Z"/><path d="M6.5 8h11"/><path d="M13 4v17"/>');

// ── Cooking methods ───────────────────────────────────────────
export const iconBoil    = svg('<path d="M3 10h18l-1 9a2 2 0 0 1-2 1.5H6a2 2 0 0 1-2-1.5L3 10Z"/><path d="M2 10h20"/><circle cx="9" cy="6" r="0.9" fill="currentColor" stroke="none"/><circle cx="13" cy="4" r="0.9" fill="currentColor" stroke="none"/><circle cx="16" cy="7" r="0.9" fill="currentColor" stroke="none"/>');
export const iconFry     = svg('<path d="M2 11h14v3a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v-3Z"/><path d="M16 13h6"/><circle cx="7" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="11" cy="15" r="1" fill="currentColor" stroke="none"/>');
export const iconOven    = svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 8h18"/><circle cx="6" cy="5.5" r="0.6" fill="currentColor" stroke="none"/><circle cx="9" cy="5.5" r="0.6" fill="currentColor" stroke="none"/><rect x="6" y="11" width="12" height="7" rx="1"/>');
export const iconSteam   = svg('<path d="M3 14h18a9 9 0 0 1-18 0Z"/><path d="M8 10c-.5-1 .5-2 0-3s.5-2 0-3"/><path d="M12 10c-.5-1 .5-2 0-3s.5-2 0-3"/><path d="M16 10c-.5-1 .5-2 0-3s.5-2 0-3"/>');
export const iconGrill   = svg('<circle cx="12" cy="12" r="9"/><line x1="6" y1="9" x2="18" y2="9"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="6" y1="15" x2="18" y2="15"/>');
export const iconStew    = svg('<path d="M3 11h18l-1 8a2 2 0 0 1-2 1.5H6a2 2 0 0 1-2-1.5L3 11Z"/><path d="M2 11h20"/><path d="M4 8h16"/><line x1="12" y1="5" x2="12" y2="8"/>');
export const iconSoak    = svg('<path d="M3 12h18a9 9 0 0 1-18 0Z"/><path d="M5 15c2 1 4 1 7 0s5-1 7 0"/><path d="M12 3c1 1.5 2 2.5 2 4a2 2 0 1 1-4 0c0-1.5 1-2.5 2-4Z"/>');
export const iconLeafRaw = svg('<path d="M20 4c-2.5 0-8 1-11 4S5 17 5 19c2 0 8-1 11-4s4-8.5 4-11Z"/><path d="M5 19l9-9"/>');

// ── Diet / Restrictions ───────────────────────────────────────
export const iconVeg       = svg('<path d="M19 4c-7 0-14 4-14 11 0 2 1 4 1 4s2 1 4 1c7 0 11-7 11-14 0-1 0-2-2-2Z"/><path d="M5 19c2-4 5-8 10-12"/>');
export const iconSprout    = svg('<path d="M12 21v-9"/><path d="M12 13c-2-1-5 0-6-2 1-2 5-2 6 1"/><path d="M12 11c2-1 5 0 6-2-1-2-5-2-6 1"/>');
export const iconNoGluten  = svg('<path d="M12 20V8"/><path d="M12 11c-2-1-3.5 0-4-2 .5-1.5 2.5-1.5 4 1"/><path d="M12 11c2-1 3.5 0 4-2-.5-1.5-2.5-1.5-4 1"/><path d="M12 15c-2-1-3.5 0-4-2 .5-1.5 2.5-1.5 4 1"/><path d="M12 15c2-1 3.5 0 4-2-.5-1.5-2.5-1.5-4 1"/><line x1="4" y1="21" x2="20" y2="4"/>');
export const iconProtein   = svg('<path d="M14 4c-3 0-6 2-7 5s0 5 1 6 4 2 6-1l5 5"/><path d="M14 4c3 0 5 2 5 5 0 2-1 3-2 4"/><path d="M17 17l3 3"/>');
export const iconAvocado   = svg('<path d="M12 3c-4 0-7 3-7 8s3 10 7 10 7-5 7-10-3-8-7-8Z"/><ellipse cx="12" cy="14" rx="3" ry="4" fill="currentColor" stroke="none"/>');
export const iconLowCarb   = svg('<path d="M4 11a5 5 0 0 1 10 0v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6Z"/><path d="M18 8v10M15 15l3 3 3-3"/>');
export const iconLowCal    = svg('<path d="M10 3c1.5 3 4 4.5 4 8a4 4 0 1 1-8 0c0-1.5.5-2 1.5-3C8 6.5 9 5 10 3Z"/><path d="M18 8v10M15 15l3 3 3-3"/>');
export const iconDiabetic  = svg('<path d="M12 3c2 4 6 7 6 11a6 6 0 0 1-12 0c0-4 4-7 6-11Z"/><path d="M9 14l2 2 4-4"/>');
export const iconLowFat    = svg('<path d="M9 3c1.5 3 4 5 4 9a4 4 0 1 1-8 0c0-4 2.5-6 4-9Z"/><path d="M18 8v10M15 15l3 3 3-3"/>');
export const iconNoLactose = svg('<path d="M8 3h8v3l2 3v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9l2-3V3Z"/><path d="M6 9h12"/><line x1="4" y1="21" x2="20" y2="3"/>');
export const iconHealthy   = svg('<path d="M12 7c-1.5-1.5-4-2-6 0s-1 8 1 10 4 2 5 1 1-1 2-1 1 1 2 1 3 0 5-2 3-8 1-10-4.5-1.5-6 0Z"/><path d="M12 7V5c1-1.5 2.5-2 4-1.5"/><path d="M8.5 13.5l2.5 2.5 4.5-5"/>');

// ── Cookbook covers ───────────────────────────────────────────
export const BOOK_ICONS = {
  book:     svg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
  utensils: svg('<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>'),
  leaf:     svg('<path d="M19 4c-7 0-14 4-14 11 0 2 1 4 1 4s2 1 4 1c7 0 11-7 11-14 0-1 0-2-2-2Z"/><path d="M5 19c2-4 5-8 10-12"/>'),
  flame:    svg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3C8.93 6.86 9.78 4.95 12 3c.5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
  heart:    svg('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'),
  star:     svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
  coffee:   svg('<path d="M5 6h12v10a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V6Z"/><path d="M17 9h2a2.5 2.5 0 0 1 0 5h-2"/><path d="M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3"/>'),
  cake:     svg('<path d="M4 20 12 5l8 15Z"/><path d="M7 14h10"/><circle cx="12" cy="5" r="1.4"/>'),
  pizza:    svg('<path d="M15 11h.01"/><path d="M11 15h.01"/><path d="M16 16h.01"/><path d="m2 16 20 6-6-20A20 20 0 0 0 2 16"/><path d="M5.71 17.11a17.04 17.04 0 0 1 11.4-11.4"/>'),
  soup:     svg('<path d="M3 13h18a9 9 0 0 1-18 0Z"/><path d="M17 13 21 5"/><path d="M8 6c0 1.2-1 1.8-1 3s1 1.8 1 3"/><path d="M12 6c0 1.2-1 1.8-1 3s1 1.8 1 3"/>'),
  apple:    svg('<path d="M12 7c-1.5-1.5-4-2-6 0s-1 8 1 10 4 2 5 1 1-1 2-1 1 1 2 1 3 0 5-2 3-8 1-10-4.5-1.5-6 0Z"/><path d="M12 7V5"/><path d="M12 5c1-1.5 2.5-2 4-1.5-.5 1.5-2 2.5-4 1.5Z"/>'),
  home:     svg('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),
};
