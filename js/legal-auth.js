// Ініціалізує спільний auth UI на статичних legal-сторінках.
// Простого підключення auth.js недостатньо: модуль лише експортує initAuth().
import { initAuth } from './auth.js';

void initAuth();
