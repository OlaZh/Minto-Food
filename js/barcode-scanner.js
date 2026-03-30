/**
 * Barcode Scanner Module
 * Сканер штрих-кодів з інтеграцією Open Food Facts
 */

import { supabase } from './supabaseClient.js';

let html5QrCode = null;
let isScanning = false;
let onProductFound = null;

// ==================== ІНІЦІАЛІЗАЦІЯ ====================

export function initBarcodeScanner(callback) {
  onProductFound = callback;

  const barcodeBtn = document.getElementById('barcodeBtn');
  const scannerModal = document.getElementById('scannerModal');
  const closeScannerBtn = document.getElementById('closeScannerBtn');
  const scannerOverlay = scannerModal?.querySelector('.scanner-modal__overlay');
  const manualBarcodeInput = document.getElementById('manualBarcodeInput');
  const manualBarcodeBtn = document.getElementById('manualBarcodeBtn');

  if (barcodeBtn) {
    barcodeBtn.addEventListener('click', openScanner);
  }

  if (closeScannerBtn) {
    closeScannerBtn.addEventListener('click', closeScanner);
  }

  if (scannerOverlay) {
    scannerOverlay.addEventListener('click', closeScanner);
  }

  // Ручне введення штрих-коду
  if (manualBarcodeBtn && manualBarcodeInput) {
    manualBarcodeBtn.addEventListener('click', () => {
      const barcode = manualBarcodeInput.value.trim();
      if (barcode) {
        handleBarcodeScan(barcode);
      }
    });

    manualBarcodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const barcode = manualBarcodeInput.value.trim();
        if (barcode) {
          handleBarcodeScan(barcode);
        }
      }
    });
  }
}

// ==================== ВІДКРИТТЯ/ЗАКРИТТЯ СКАНЕРА ====================

async function openScanner() {
  const scannerModal = document.getElementById('scannerModal');
  const manualBarcodeInput = document.getElementById('manualBarcodeInput');

  if (!scannerModal) return;

  scannerModal.hidden = false;

  // Очищаємо поле вводу
  if (manualBarcodeInput) {
    manualBarcodeInput.value = '';
  }

  // Завантажуємо бібліотеку динамічно
  await loadHtml5QrCodeLibrary();

  // Запускаємо камеру
  startCamera();
}

export function closeScanner() {
  const scannerModal = document.getElementById('scannerModal');

  if (html5QrCode && isScanning) {
    html5QrCode
      .stop()
      .then(() => {
        isScanning = false;
        html5QrCode.clear();
      })
      .catch((err) => {
        console.warn('Помилка зупинки сканера:', err);
      });
  }

  if (scannerModal) {
    scannerModal.hidden = true;
  }
}

// ==================== ЗАВАНТАЖЕННЯ БІБЛІОТЕКИ ====================

function loadHtml5QrCodeLibrary() {
  return new Promise((resolve, reject) => {
    // Якщо вже завантажена
    if (window.Html5Qrcode) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ==================== РОБОТА З КАМЕРОЮ ====================

async function startCamera() {
  const readerElement = document.getElementById('barcode-reader');
  const statusEl = document.getElementById('scannerStatus');

  if (!readerElement) return;

  try {
    html5QrCode = new Html5Qrcode('barcode-reader');

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 100 },
      aspectRatio: 1.777,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
      ],
    };

    // Спочатку пробуємо задню камеру (для телефонів)
    try {
      await html5QrCode.start({ facingMode: 'environment' }, config, onScanSuccess, onScanFailure);
      isScanning = true;
      console.log('Запущено задню камеру');
    } catch (backCameraError) {
      console.log('Задня камера недоступна, пробуємо передню...', backCameraError);

      // Якщо задня камера недоступна — пробуємо передню (для ноутбуків)
      try {
        await html5QrCode.start({ facingMode: 'user' }, config, onScanSuccess, onScanFailure);
        isScanning = true;
        console.log('Запущено передню камеру');
      } catch (frontCameraError) {
        console.log('Передня камера також недоступна, пробуємо будь-яку...', frontCameraError);

        // Останній варіант — будь-яка доступна камера
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          await html5QrCode.start(devices[0].id, config, onScanSuccess, onScanFailure);
          isScanning = true;
          console.log('Запущено камеру:', devices[0].label);
        } else {
          throw new Error('Камери не знайдено');
        }
      }
    }

    if (statusEl) {
      statusEl.textContent = 'Наведіть камеру на штрих-код';
      statusEl.className = 'scanner-modal__status';
    }
  } catch (err) {
    console.error('Помилка запуску камери:', err);

    if (statusEl) {
      statusEl.textContent = 'Камера недоступна. Введіть код вручну.';
      statusEl.className = 'scanner-modal__status scanner-modal__status--error';
    }
  }
}

function onScanSuccess(decodedText, decodedResult) {
  console.log('Знайдено штрих-код:', decodedText);

  // Вібрація на мобільних
  if (navigator.vibrate) {
    navigator.vibrate(200);
  }

  handleBarcodeScan(decodedText);
}

function onScanFailure(error) {
  // Ігноруємо — це нормально, коли код ще не в фокусі
}

// ==================== ОБРОБКА ШТРИХ-КОДУ ====================

async function handleBarcodeScan(barcode) {
  const statusEl = document.getElementById('scannerStatus');

  if (statusEl) {
    statusEl.textContent = 'Шукаємо продукт...';
    statusEl.className = 'scanner-modal__status scanner-modal__status--loading';
  }

  try {
    // 1. Шукаємо в локальній базі scanned_products
    const localProduct = await findInLocalDatabase(barcode);

    if (localProduct) {
      console.log('Знайдено локально:', localProduct);
      onProductFoundHandler(localProduct);
      return;
    }

    // 2. Шукаємо в Open Food Facts
    const offProduct = await searchOpenFoodFacts(barcode);

    if (offProduct) {
      console.log('Знайдено в Open Food Facts:', offProduct);

      // Зберігаємо в локальну базу для кешування
      await saveToLocalDatabase(offProduct);

      onProductFoundHandler(offProduct);
      return;
    }

    // 3. Не знайдено
    if (statusEl) {
      statusEl.textContent = 'Продукт не знайдено 😔 Спробуйте інший або створіть вручну.';
      statusEl.className = 'scanner-modal__status scanner-modal__status--error';
    }
  } catch (error) {
    console.error('Помилка пошуку:', error);

    if (statusEl) {
      statusEl.textContent = 'Помилка пошуку. Спробуйте ще раз.';
      statusEl.className = 'scanner-modal__status scanner-modal__status--error';
    }
  }
}

// ==================== ПОШУК В ЛОКАЛЬНІЙ БАЗІ ====================

async function findInLocalDatabase(barcode) {
  const { data, error } = await supabase
    .from('scanned_products')
    .select('*')
    .eq('barcode', barcode)
    .maybeSingle();

  if (error) {
    console.error('Помилка Supabase:', error);
    return null;
  }

  return data;
}

// ==================== ПОШУК В OPEN FOOD FACTS ====================

async function searchOpenFoodFacts(barcode) {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,product_name_uk,product_name_pl,product_name_en,brands,nutriments,image_url`,
    );

    const data = await response.json();

    if (data.status !== 1 || !data.product) {
      return null;
    }

    const p = data.product;
    const nutriments = p.nutriments || {};

    return {
      barcode: barcode,
      name_ua: p.product_name_uk || p.product_name || null,
      name_en: p.product_name_en || p.product_name || null,
      name_pl: p.product_name_pl || null,
      brand: p.brands || null,
      kcal: Math.round(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0),
      protein: parseFloat((nutriments.proteins_100g || nutriments.proteins || 0).toFixed(1)),
      fat: parseFloat((nutriments.fat_100g || nutriments.fat || 0).toFixed(1)),
      carbs: parseFloat(
        (nutriments.carbohydrates_100g || nutriments.carbohydrates || 0).toFixed(1),
      ),
      image_url: p.image_url || null,
      source: 'openfoodfacts',
    };
  } catch (error) {
    console.error('Помилка Open Food Facts:', error);
    return null;
  }
}

// ==================== ЗБЕРЕЖЕННЯ В ЛОКАЛЬНУ БАЗУ ====================

async function saveToLocalDatabase(product) {
  try {
    const { error } = await supabase.from('scanned_products').upsert([product], {
      onConflict: 'barcode',
      ignoreDuplicates: true,
    });

    if (error) {
      console.warn('Не вдалося кешувати продукт:', error);
    }
  } catch (err) {
    console.warn('Помилка кешування:', err);
  }
}

// ==================== CALLBACK ПРИ ЗНАЙДЕННІ ====================

function onProductFoundHandler(product) {
  const statusEl = document.getElementById('scannerStatus');

  // Визначаємо назву для відображення
  const displayName = product.name_ua || product.name_en || product.name_pl || 'Без назви';
  const brandText = product.brand ? ` (${product.brand})` : '';

  if (statusEl) {
    statusEl.innerHTML = `
      <span class="scanner-modal__success">✅ ${displayName}${brandText}</span>
      <br>
      <small>${product.kcal} ккал · Б${product.protein} · Ж${product.fat} · В${product.carbs}</small>
    `;
    statusEl.className = 'scanner-modal__status scanner-modal__status--success';
  }

  // Закриваємо сканер через 1 секунду і передаємо продукт
  setTimeout(() => {
    closeScanner();

    if (onProductFound && typeof onProductFound === 'function') {
      onProductFound({
        ...product,
        name: displayName,
        name_ua: product.name_ua || displayName,
      });
    }
  }, 1000);
}
