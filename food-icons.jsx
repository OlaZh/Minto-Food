// MintoFood — line icons, 24×24, stroke-based, inherit currentColor.
// Same family as the app's existing icon set (sw 1.6, round caps/joins).

const FIcon = ({ size = 22, sw = 1.6, children, className, style }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden="true"
  >
    {children}
  </svg>
);

/* ─── Швидкі фільтри ─────────────────────────────────────────────── */

// Швидке — lightning bolt
const IconBolt = (p) => (
  <FIcon {...p}>
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
  </FIcon>
);

// Для дітей — child silhouette with bangs
const IconKid = (p) => (
  <FIcon {...p}>
    <circle cx="12" cy="7.5" r="3.5" />
    <path d="M8.6 6.8c.4-1.5 1.9-2.6 3.4-2.6s3 1.1 3.4 2.6" />
    <path d="M5 21v-1.5a7 7 0 0 1 14 0V21" />
  </FIcon>
);

// Бюджетне — wallet with coin
const IconWallet = (p) => (
  <FIcon {...p}>
    <rect x="3" y="6" width="18" height="13" rx="2.2" />
    <path d="M3 10h18" />
    <circle cx="17" cy="14.5" r="1.1" fill="currentColor" stroke="none" />
  </FIcon>
);

// Без готування — pot crossed out
const IconNoCook = (p) => (
  <FIcon {...p}>
    <path d="M4 11h16l-1.5 7.5a2 2 0 0 1-2 1.5h-9a2 2 0 0 1-2-1.5L4 11Z" />
    <path d="M8 8.5c0-1.5 1-2 1-3M12 8.5c0-1.5 1-2 1-3" />
    <line x1="3.5" y1="21" x2="20.5" y2="4" />
  </FIcon>
);

// Мілпреп — bento / divided container
const IconBento = (p) => (
  <FIcon {...p}>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <line x1="12" y1="6" x2="12" y2="19" />
    <line x1="3" y1="12.5" x2="12" y2="12.5" />
  </FIcon>
);

// Без світла — candle with flame
const IconCandle = (p) => (
  <FIcon {...p}>
    <path d="M12 2.5c1 1.5 2 2.5 2 4a2 2 0 1 1-4 0c0-1.5 1-2.5 2-4Z" />
    <rect x="8.5" y="10" width="7" height="11" rx="1" />
    <path d="M8.5 14h7" />
  </FIcon>
);

/* ─── Категорія ──────────────────────────────────────────────────── */

// Сніданок — fried egg
const IconEgg = (p) => (
  <FIcon {...p}>
    <path d="M12 3c-3 0-6 4-6 9s3 8 6 8 6-3 6-8-3-9-6-9Z" />
    <circle cx="12" cy="11" r="2.5" />
  </FIcon>
);

// Обід — plate (double circle)
const IconPlate = (p) => (
  <FIcon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="5.5" />
  </FIcon>
);

// Вечеря — dinner bowl with rim
const IconDinner = (p) => (
  <FIcon {...p}>
    <path d="M3 11h18a9 9 0 0 1-18 0Z" />
    <path d="M2 11h20" />
    <path d="M9 6c0 1 1 1.5 1 2.5M13 5c0 1 1 1.5 1 2.5" />
  </FIcon>
);

// Перекус — apple with leaf
const IconApple = (p) => (
  <FIcon {...p}>
    <path d="M12 7c-1.5-1.5-4-2-6 0s-1 8 1 10 4 2 5 1 1-1 2-1 1 1 2 1 3 0 5-2 3-8 1-10-4.5-1.5-6 0Z" />
    <path d="M12 7V5" />
    <path d="M12 5c1-1.5 2.5-2 4-1.5-.5 1.5-2 2.5-4 1.5Z" />
  </FIcon>
);

// Десерт — cake slice w/ cherry
const IconCake = (p) => (
  <FIcon {...p}>
    <path d="M4 20 12 5l8 15Z" />
    <path d="M7 14h10" />
    <circle cx="12" cy="5" r="1.4" />
  </FIcon>
);

// Напої — mug with handle
const IconMug = (p) => (
  <FIcon {...p}>
    <path d="M5 6h12v10a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V6Z" />
    <path d="M17 9h2a2.5 2.5 0 0 1 0 5h-2" />
    <path d="M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3" />
  </FIcon>
);

// Випічка — bread loaf with scoring
const IconBread = (p) => (
  <FIcon {...p}>
    <path d="M4 11a6 6 0 0 1 16 0v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6Z" />
    <path d="M9 9c.5 2 .5 4 0 6M13 9c.5 2 .5 4 0 6" />
  </FIcon>
);

/* ─── Тип страви ─────────────────────────────────────────────────── */

// Каша — bowl with oats (wavy)
const IconPorridge = (p) => (
  <FIcon {...p}>
    <path d="M3 12h18a9 9 0 0 1-18 0Z" />
    <path d="M5 12c1.5-1 3 1 5 0s3.5-1 5 0 3-1 4 0" />
  </FIcon>
);

// Суп — bowl with spoon + steam
const IconSoup = (p) => (
  <FIcon {...p}>
    <path d="M3 13h18a9 9 0 0 1-18 0Z" />
    <path d="M17 13 21 5" />
    <path d="M8 6c0 1.2-1 1.8-1 3s1 1.8 1 3" />
    <path d="M12 6c0 1.2-1 1.8-1 3s1 1.8 1 3" />
  </FIcon>
);

// Салат — bowl with leaves
const IconSalad = (p) => (
  <FIcon {...p}>
    <path d="M3 13h18a9 9 0 0 1-18 0Z" />
    <path d="M7 13c-1-3 1-5 4-5M12 13c0-3 2-5 5-4" />
    <path d="M14 9c.7-.5 1.5-.5 2.5 0" />
  </FIcon>
);

// Гарнір — small bowl with grains
const IconSide = (p) => (
  <FIcon {...p}>
    <path d="M4 14h16a8 8 0 0 1-16 0Z" />
    <circle cx="9" cy="11" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="10" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="15" cy="11" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="10.5" cy="8.5" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="13.5" cy="8.5" r="0.6" fill="currentColor" stroke="none" />
  </FIcon>
);

// Основна страва — plate with fork + knife
const IconMain = (p) => (
  <FIcon {...p}>
    <path d="M6 3v8a2 2 0 0 0 2 2v8" />
    <path d="M6 3v4M9 3v4" />
    <path d="M16 3c-1.5 0-2 1.5-2 4s2 4 2 4v10" />
  </FIcon>
);

// Паста — swirled noodles on plate
const IconPasta = (p) => (
  <FIcon {...p}>
    <ellipse cx="12" cy="16" rx="9" ry="3" />
    <path d="M5 14c2-6 5-9 7-9s5 3 7 9" />
    <path d="M9 14c1-3 2-5 3-5s2 2 3 5" />
  </FIcon>
);

// Соус — gravy boat
const IconSauce = (p) => (
  <FIcon {...p}>
    <path d="M3 10h15l-2 8a2 2 0 0 1-2 1.5H7a2 2 0 0 1-2-1.5L3 10Z" />
    <path d="M18 11c2 0 3 1.5 3 3s-1 3-3 3" />
    <path d="M8 7c1-1 2-1 3 0s2 1 3 0" />
  </FIcon>
);

// Сендвіч — sandwich (stacked)
const IconSandwich = (p) => (
  <FIcon {...p}>
    <path d="M3 7c0-1.5 1-2.5 2.5-2.5h13C20 4.5 21 5.5 21 7v1H3V7Z" />
    <path d="M3 8h18l-1 3H4l-1-3Z" />
    <path d="M4 11h16l-1 3H5l-1-3Z" />
    <path d="M3 14h18v2c0 1.5-1 2.5-2.5 2.5h-13C4 18.5 3 17.5 3 16v-2Z" />
  </FIcon>
);

// Запіканка — casserole dish (rectangular with handles)
const IconCasserole = (p) => (
  <FIcon {...p}>
    <path d="M2 11h20l-1 6a2 2 0 0 1-2 1.5H5a2 2 0 0 1-2-1.5L2 11Z" />
    <path d="M2 13H1M22 13h1" />
    <path d="M7 8c.5-1.5 1.5-2 1.5-3M12 8c.5-1.5 1.5-2 1.5-3M17 8c.5-1.5 1.5-2 1.5-3" />
  </FIcon>
);

// Млинці — stack of pancakes
const IconPancakes = (p) => (
  <FIcon {...p}>
    <ellipse cx="12" cy="8" rx="8" ry="2.2" />
    <path d="M4 8v2c0 1.2 3.6 2.2 8 2.2s8-1 8-2.2V8" />
    <path d="M4 12v2c0 1.2 3.6 2.2 8 2.2s8-1 8-2.2v-2" />
    <path d="M4 16v2c0 1.2 3.6 2.2 8 2.2s8-1 8-2.2v-2" />
  </FIcon>
);

// Омлет — frying pan with egg in middle
const IconOmelet = (p) => (
  <FIcon {...p}>
    <circle cx="10" cy="13" r="7" />
    <line x1="16.5" y1="9.5" x2="22" y2="6" />
    <circle cx="10" cy="13" r="2.2" />
  </FIcon>
);

// Смузі — tall glass with straw
const IconSmoothie = (p) => (
  <FIcon {...p}>
    <path d="M6 4h12l-1.5 16a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5L6 4Z" />
    <path d="M6.5 8h11" />
    <path d="M13 4v17" />
  </FIcon>
);

/* ─── Метод приготування ─────────────────────────────────────────── */

// Варіння — pot with bubbles
const IconBoil = (p) => (
  <FIcon {...p}>
    <path d="M3 10h18l-1 9a2 2 0 0 1-2 1.5H6a2 2 0 0 1-2-1.5L3 10Z" />
    <path d="M2 10h20" />
    <circle cx="9" cy="6" r="0.9" />
    <circle cx="13" cy="4" r="0.9" />
    <circle cx="16" cy="7" r="0.9" />
  </FIcon>
);

// Смаження — frying pan side view
const IconFry = (p) => (
  <FIcon {...p}>
    <path d="M2 11h14a0 0 0 0 1 0 0v3a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v-3Z" />
    <path d="M16 13h6" />
    <circle cx="7" cy="14" r="1" />
    <circle cx="11" cy="15" r="1" />
  </FIcon>
);

// Запікання — oven with door + dial
const IconOven = (p) => (
  <FIcon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 8h18" />
    <circle cx="6" cy="5.5" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="9" cy="5.5" r="0.6" fill="currentColor" stroke="none" />
    <rect x="6" y="11" width="12" height="7" rx="1" />
  </FIcon>
);

// На парі — bowl with steam wisps
const IconSteam = (p) => (
  <FIcon {...p}>
    <path d="M3 14h18a9 9 0 0 1-18 0Z" />
    <path d="M8 10c-.5-1 .5-2 0-3s.5-2 0-3" />
    <path d="M12 10c-.5-1 .5-2 0-3s.5-2 0-3" />
    <path d="M16 10c-.5-1 .5-2 0-3s.5-2 0-3" />
  </FIcon>
);

// Гриль — grill grate
const IconGrill = (p) => (
  <FIcon {...p}>
    <circle cx="12" cy="12" r="9" />
    <line x1="6" y1="9" x2="18" y2="9" />
    <line x1="6" y1="12" x2="18" y2="12" />
    <line x1="6" y1="15" x2="18" y2="15" />
  </FIcon>
);

// Тушкування — covered pot
const IconStew = (p) => (
  <FIcon {...p}>
    <path d="M3 11h18l-1 8a2 2 0 0 1-2 1.5H6a2 2 0 0 1-2-1.5L3 11Z" />
    <path d="M2 11h20" />
    <path d="M4 8h16" />
    <line x1="12" y1="5" x2="12" y2="8" />
  </FIcon>
);

// Замочування — bowl with water level + drop
const IconSoak = (p) => (
  <FIcon {...p}>
    <path d="M3 12h18a9 9 0 0 1-18 0Z" />
    <path d="M5 15c2 1 4 1 7 0s5-1 7 0" />
    <path d="M12 3c1 1.5 2 2.5 2 4a2 2 0 1 1-4 0c0-1.5 1-2.5 2-4Z" />
  </FIcon>
);

// Без термообробки — single leaf with vein
const IconLeafRaw = (p) => (
  <FIcon {...p}>
    <path d="M20 4c-2.5 0-8 1-11 4S5 17 5 19c2 0 8-1 11-4s4-8.5 4-11Z" />
    <path d="M5 19l9-9" />
  </FIcon>
);

/* ─── Дієтичні ───────────────────────────────────────────────────── */

// Вегетаріанське — leaf
const IconVeg = (p) => (
  <FIcon {...p}>
    <path d="M19 4c-7 0-14 4-14 11 0 2 1 4 1 4s2 1 4 1c7 0 11-7 11-14 0-1 0-2-2-2Z" />
    <path d="M5 19c2-4 5-8 10-12" />
  </FIcon>
);

// Веганське — sprout with two leaves
const IconSprout = (p) => (
  <FIcon {...p}>
    <path d="M12 21v-9" />
    <path d="M12 13c-2-1-5 0-6-2 1-2 5-2 6 1" />
    <path d="M12 11c2-1 5 0 6-2-1-2-5-2-6 1" />
  </FIcon>
);

// Без глютену — wheat with diagonal slash
const IconNoGluten = (p) => (
  <FIcon {...p}>
    <path d="M12 20V8" />
    <path d="M12 11c-2-1-3.5 0-4-2 .5-1.5 2.5-1.5 4 1" />
    <path d="M12 11c2-1 3.5 0 4-2-.5-1.5-2.5-1.5-4 1" />
    <path d="M12 15c-2-1-3.5 0-4-2 .5-1.5 2.5-1.5 4 1" />
    <path d="M12 15c2-1 3.5 0 4-2-.5-1.5-2.5-1.5-4 1" />
    <line x1="4" y1="21" x2="20" y2="4" />
  </FIcon>
);

// Багато білка — drumstick
const IconProtein = (p) => (
  <FIcon {...p}>
    <path d="M14 4c-3 0-6 2-7 5s0 5 1 6 4 2 6-1l5 5" />
    <path d="M14 4c3 0 5 2 5 5 0 2-1 3-2 4" />
    <path d="M17 17l3 3" />
  </FIcon>
);

// Кето — avocado half with pit
const IconAvocado = (p) => (
  <FIcon {...p}>
    <path d="M12 3c-4 0-7 3-7 8s3 10 7 10 7-5 7-10-3-8-7-8Z" />
    <ellipse cx="12" cy="14" rx="3" ry="4" fill="currentColor" stroke="none" />
  </FIcon>
);

// Мало вуглеводів — bread slice with down arrow
const IconLowCarb = (p) => (
  <FIcon {...p}>
    <path d="M4 11a5 5 0 0 1 10 0v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6Z" />
    <path d="M18 8v10M15 15l3 3 3-3" />
  </FIcon>
);

// Низькокалорійне — flame with down arrow
const IconLowCal = (p) => (
  <FIcon {...p}>
    <path d="M10 3c1.5 3 4 4.5 4 8a4 4 0 1 1-8 0c0-1.5.5-2 1.5-3C8 6.5 9 5 10 3Z" />
    <path d="M18 8v10M15 15l3 3 3-3" />
  </FIcon>
);

// Для діабетиків — drop with check
const IconDiabetic = (p) => (
  <FIcon {...p}>
    <path d="M12 3c2 4 6 7 6 11a6 6 0 0 1-12 0c0-4 4-7 6-11Z" />
    <path d="M9 14l2 2 4-4" />
  </FIcon>
);

// Мало жирів — oil drop with down arrow
const IconLowFat = (p) => (
  <FIcon {...p}>
    <path d="M9 3c1.5 3 4 5 4 9a4 4 0 1 1-8 0c0-4 2.5-6 4-9Z" />
    <path d="M18 8v10M15 15l3 3 3-3" />
  </FIcon>
);

// Без лактози — milk carton with slash
const IconNoLactose = (p) => (
  <FIcon {...p}>
    <path d="M8 3h8v3l2 3v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9l2-3V3Z" />
    <path d="M6 9h12" />
    <line x1="4" y1="21" x2="20" y2="3" />
  </FIcon>
);

// ПП — apple with check
const IconHealthy = (p) => (
  <FIcon {...p}>
    <path d="M12 7c-1.5-1.5-4-2-6 0s-1 8 1 10 4 2 5 1 1-1 2-1 1 1 2 1 3 0 5-2 3-8 1-10-4.5-1.5-6 0Z" />
    <path d="M12 7V5c1-1.5 2.5-2 4-1.5" />
    <path d="M8.5 13.5l2.5 2.5 4.5-5" />
  </FIcon>
);

Object.assign(window, {
  FIcon,
  // Quick filters
  IconBolt, IconKid, IconWallet, IconNoCook, IconBento, IconCandle,
  // Categories
  IconEgg, IconPlate, IconDinner, IconApple, IconCake, IconMug, IconBread,
  // Dish types
  IconPorridge, IconSoup, IconSalad, IconSide, IconMain, IconPasta,
  IconSauce, IconSandwich, IconCasserole, IconPancakes, IconOmelet, IconSmoothie,
  // Cooking methods
  IconBoil, IconFry, IconOven, IconSteam, IconGrill, IconStew, IconSoak, IconLeafRaw,
  // Diet
  IconVeg, IconSprout, IconNoGluten, IconProtein, IconAvocado,
  IconLowCarb, IconLowCal, IconDiabetic, IconLowFat, IconNoLactose, IconHealthy,
});
