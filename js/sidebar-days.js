document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('.sidebar__day-btn');
  const dateEl = document.getElementById('dayDate');

  const daysUA = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота'];
  const monthsUA = [
    'січня',
    'лютого',
    'березня',
    'квітня',
    'травня',
    'червня',
    'липня',
    'серпня',
    'вересня',
    'жовтня',
    'листопада',
    'грудня',
  ];

  function getWeekDayDate(dayIndex) {
    const today = new Date();
    const currentDay = today.getDay(); // 0 (Нд) - 6 (Сб)

    // Знаходимо різницю до понеділка цього тижня
    // Якщо сьогодні неділя (0), вважаємо її кінцем тижня (-6 днів до понеділка)
    const dayToMonday = currentDay === 0 ? -6 : 1 - currentDay;

    // Дата понеділка
    const mondayDate = new Date(today);
    mondayDate.setDate(today.getDate() + dayToMonday);

    // Тепер від понеділка рахуємо потрібний день
    // dayIndex: monday=0, tuesday=1 ... sunday=6
    const targetDate = new Date(mondayDate);
    targetDate.setDate(mondayDate.getDate() + dayIndex);

    return {
      label: daysUA[targetDate.getDay()],
      dayNumber: targetDate.getDate(),
      month: monthsUA[targetDate.getMonth()],
    };
  }

  function updateDisplay(btn, internalIndex) {
    const info = getWeekDayDate(internalIndex);
    if (dateEl) {
      dateEl.textContent = `${info.label}, ${info.dayNumber} ${info.month}`;
    }
    buttons.forEach((b) => b.removeAttribute('aria-current'));
    btn.setAttribute('aria-current', 'true');
  }

  // Мапінг: тепер просто рахуємо відступ від понеділка (0 до 6)
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
      updateDisplay(btn, dayMapping[btn.dataset.day]);
    });
  });

  // Авто-вибір сьогоднішнього дня при старті
  const today = new Date();
  const currentDay = today.getDay();
  // Перетворюємо неділю з 0 на 6, а інші дні зміщуємо на -1 (Пн став 0)
  const todayInternal = currentDay === 0 ? 6 : currentDay - 1;

  const activeBtn = Array.from(buttons).find(
    (btn) => dayMapping[btn.dataset.day] === todayInternal,
  );
  if (activeBtn) updateDisplay(activeBtn, todayInternal);
});
