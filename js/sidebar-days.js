document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('.sidebar__day-btn');
  const dateEl = document.getElementById('dayDate');
  const weekLabel = document.getElementById('weekLabel');
  const prevWeekBtn = document.getElementById('prevWeekBtn');
  const nextWeekBtn = document.getElementById('nextWeekBtn');

  const daysUA = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота'];
  const monthsUA = [
    'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
    'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
  ];

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
    const startMonth = monthsUA[monday.getMonth()];
    const endMonth = monthsUA[sunday.getMonth()];

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
      const numSpan = btn.querySelector('[data-day-num]');
      if (!numSpan) return;
      const dayIndex = dayMapping[btn.dataset.day];
      const info = getWeekDayDate(dayIndex);
      numSpan.textContent = info.dayNumber;
    });
  }

  function getWeekDayDate(dayIndex) {
    const monday = getMondayOfWeek(weekOffset);
    const targetDate = new Date(monday);
    targetDate.setDate(monday.getDate() + dayIndex);

    return {
      label: daysUA[targetDate.getDay()],
      dayNumber: targetDate.getDate(),
      month: monthsUA[targetDate.getMonth()],
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
  }
});