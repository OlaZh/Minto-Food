import { getLang } from './storage.js';

document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('.sidebar__day-btn');
  const dateEl = document.getElementById('dayDate');
  const weekLabel = document.getElementById('weekLabel');
  const prevWeekBtn = document.getElementById('prevWeekBtn');
  const nextWeekBtn = document.getElementById('nextWeekBtn');

  // Локаль для Intl за поточною мовою (той самий патерн, що у week-menu.js).
  const lang = getLang();
  const locale = lang === 'ua' ? 'uk-UA' : lang === 'pl' ? 'pl-PL' : 'en-US';
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: 'long' });
  const weekdayShortFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const monthFmt = new Intl.DateTimeFormat(locale, { month: 'long' });

  let weekOffset = 0;

  function getMondayOfWeek(offset = 0) {
    const today = new Date();
    const currentDay = today.getDay();
    const dayToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + dayToMonday + offset * 7);
    return monday;
  }

  function formatWeekRange(monday) {
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startDay = monday.getDate();
    const endDay = sunday.getDate();
    const startMonth = monthFmt.format(monday);
    const endMonth = monthFmt.format(sunday);

    if (monday.getMonth() === sunday.getMonth()) {
      return `${startDay}–${endDay} ${endMonth}`;
    }
    return `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
  }

  function updateWeekLabel() {
    if (weekLabel) {
      const monday = getMondayOfWeek(weekOffset);
      weekLabel.textContent = formatWeekRange(monday);
    }
  }

  function updatePillDates() {
    buttons.forEach((btn) => {
      const dayIndex = dayMapping[btn.dataset.day];
      const info = getWeekDayDate(dayIndex);
      const numSpan = btn.querySelector('[data-day-num]');
      if (numSpan) numSpan.textContent = info.dayNumber;
      // Коротка назва дня поточною мовою (Пн / Mon / pon.)
      const abbrSpan = btn.querySelector('.day-week-nav__pill-abbr');
      if (abbrSpan) {
        const abbr = weekdayShortFmt.format(info.fullDate).replace(/\.$/, '');
        abbrSpan.textContent = abbr.charAt(0).toUpperCase() + abbr.slice(1);
      }
    });
  }

  function getWeekDayDate(dayIndex) {
    const monday = getMondayOfWeek(weekOffset);
    const targetDate = new Date(monday);
    targetDate.setDate(monday.getDate() + dayIndex);

    const weekday = weekdayFmt.format(targetDate);
    return {
      // Назва дня з великої літери (Intl у деяких локалях дає малу).
      label: weekday.charAt(0).toUpperCase() + weekday.slice(1),
      dayNumber: targetDate.getDate(),
      month: monthFmt.format(targetDate),
      fullDate: targetDate,
    };
  }

  function formatDateForDB(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function selectDay(btn, dayIndex) {
    const info = getWeekDayDate(dayIndex);

    if (dateEl) {
      dateEl.textContent = `${info.label}, ${info.dayNumber} ${info.month}`;
    }

    buttons.forEach((b) => b.removeAttribute('aria-current'));
    btn.setAttribute('aria-current', 'true');

    // Завантажити дані через глобальний API
    const dateString = formatDateForDB(info.fullDate);
    if (window.mealsAPI?.loadMealsForDate) {
      window.mealsAPI.loadMealsForDate(dateString);
    }
  }

  const dayMapping = {
    monday: 0,
    tuesday: 1,
    wednesday: 2,
    thursday: 3,
    friday: 4,
    saturday: 5,
    sunday: 6,
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectDay(btn, dayMapping[btn.dataset.day]);
    });
  });

  if (prevWeekBtn) {
    prevWeekBtn.addEventListener('click', () => {
      weekOffset--;
      updateWeekLabel();
      updatePillDates();

      const activeBtn = document.querySelector('.sidebar__day-btn[aria-current="true"]');
      if (activeBtn) {
        selectDay(activeBtn, dayMapping[activeBtn.dataset.day]);
      }
    });
  }

  if (nextWeekBtn) {
    nextWeekBtn.addEventListener('click', () => {
      weekOffset++;
      updateWeekLabel();
      updatePillDates();

      const activeBtn = document.querySelector('.sidebar__day-btn[aria-current="true"]');
      if (activeBtn) {
        selectDay(activeBtn, dayMapping[activeBtn.dataset.day]);
      }
    });
  }

  // Свайп для зміни тижня (мобільний)
  const pillsEl = document.querySelector('.day-week-nav__pills');
  if (pillsEl) {
    let swipeStartX = 0;
    let swipeStartY = 0;
    pillsEl.addEventListener('touchstart', e => {
      swipeStartX = e.touches[0].clientX;
      swipeStartY = e.touches[0].clientY;
    }, { passive: true });
    pillsEl.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - swipeStartX;
      const dy = e.changedTouches[0].clientY - swipeStartY;
      if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx)) return;
      weekOffset += dx < 0 ? 1 : -1;
      updateWeekLabel();
      updatePillDates();
      const activeBtn = document.querySelector('.sidebar__day-btn[aria-current="true"]');
      if (activeBtn) selectDay(activeBtn, dayMapping[activeBtn.dataset.day]);
    }, { passive: true });
  }

  // Ініціалізація
  updateWeekLabel();
  updatePillDates();

  const today = new Date();
  const currentDay = today.getDay();
  const todayInternal = currentDay === 0 ? 6 : currentDay - 1;

  const activeBtn = Array.from(buttons).find(
    (btn) => dayMapping[btn.dataset.day] === todayInternal
  );

  if (activeBtn) {
    // Тільки оновлюємо UI, НЕ завантажуємо дані (meals.js сам завантажить)
    if (dateEl) {
      const info = getWeekDayDate(todayInternal);
      dateEl.textContent = `${info.label}, ${info.dayNumber} ${info.month}`;
    }
    buttons.forEach((b) => b.removeAttribute('aria-current'));
    activeBtn.setAttribute('aria-current', 'true');

    activeBtn.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });
  }
});