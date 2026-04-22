/**
 * Barcode Scanner Module v2
 * - Native BarcodeDetector API (primary) — набагато швидший на Android/iOS 17+
 * - html5-qrcode fallback для старих браузерів
 * - Підтримка ліхтарика, HD камери, continuous autofocus
 * - Інтеграція з Open Food Facts + кеш у scanned_products
 */

import { supabase } from './supabaseClient.js';

// ==================== STATE ====================
let onProductFound = null;

// Native detector state
let nativeDetector = null;
let videoStream = null;
let videoEl = null;
let rafId = null;
let isNativeScanning = false;

// Fallback (html5-qrcode) state
let html5QrCode = null;
let isFallbackScanning = false;

// Torch state (shared між обома шляхами)
let torchTrack = null;
let torchOn = false;

// Формати ШК, які підтримуємо (grocery barcodes)
const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];

// ==================== ІНІЦІАЛІЗАЦІЯ ====================

export function initBarcodeScanner(callback) {
  onProductFound = callback;

  const barcodeBtn = document.getElementById('barcodeBtn');
  const scannerModal = document.getElementById('scannerModal');
  const closeScannerBtn = document.getElementById('closeScannerBtn');
  const scannerOverlay = scannerModal?.querySelector('.scanner-modal__overlay');
  const manualBarcodeInput = document.getElementById('manualBarcodeInput');
  const manualBarcodeBtn = document.getElementById('manualBarcodeBtn');
  const torchBtn = document.getElementById('torchBtn');

  if (barcodeBtn) {
    barcodeBtn.addEventListener('click', openScanner);
  }

  if (closeScannerBtn) {
    closeScannerBtn.addEventListener('click', closeScanner);
  }

  if (scannerOverlay) {
    scannerOverlay.addEventListener('click', closeScanner);
  }

  if (torchBtn) {
    torchBtn.addEventListener('click', toggleTorch);
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
  const statusEl = document.getElementById('scannerStatus');

  if (!scannerModal) return;

  scannerModal.hidden = false;

  if (manualBarcodeInput) {
    manualBarcodeInput.value = '';
  }

  // Reset torch UI
  torchOn = false;
  updateTorchButton(false, false);

  if (statusEl) {
    statusEl.textContent = 'Ініціалізація камери...';
    statusEl.className = 'scanner-modal__status';
  }

  // Вибір стратегії: native BarcodeDetector → fallback html5-qrcode
  if (await canUseNativeDetector()) {
    console.log('[Scanner] Using native BarcodeDetector');
    await startNativeScanner();
  } else {
    console.log('[Scanner] Using html5-qrcode fallback');
    await loadHtml5QrCodeLibrary();
    await startFallbackScanner();
  }
}

export async function closeScanner() {
  const scannerModal = document.getElementById('scannerModal');

  // Вимикаємо ліхтарик перед закриттям (щоб не "горів" при наступному відкритті)
  if (torchTrack && torchOn) {
    try {
      await torchTrack.applyConstraints({ advanced: [{ torch: false }] });
    } catch {}
    torchOn = false;
  }

  // Зупиняємо native scanner
  if (isNativeScanning || videoStream) {
    isNativeScanning = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (videoStream) {
      videoStream.getTracks().forEach((t) => t.stop());
      videoStream = null;
    }
    if (videoEl) {
      videoEl.srcObject = null;
      videoEl.remove();
      videoEl = null;
    }
    nativeDetector = null;
  }

  // Зупиняємо fallback scanner
  if (html5QrCode && isFallbackScanning) {
    try {
      await html5QrCode.stop();
      await html5QrCode.clear();
    } catch (err) {
      console.warn('Помилка зупинки fallback сканера:', err);
    }
    isFallbackScanning = false;
  }

  torchTrack = null;

  if (scannerModal) {
    scannerModal.hidden = true;
  }
}

// ==================== NATIVE DETECTOR ====================

async function canUseNativeDetector() {
  if (!('BarcodeDetector' in window)) return false;

  try {
    const supported = await BarcodeDetector.getSupportedFormats();
    // Потрібен хоча б EAN-13 (основний формат на продуктах)
    return supported.includes('ean_13');
  } catch {
    return false;
  }
}

async function startNativeScanner() {
  const readerEl = document.getElementById('barcode-reader');
  const statusEl = document.getElementById('scannerStatus');

  if (!readerEl) return;

  try {
    // 1. Створюємо детектор з доступними форматами
    const supportedFormats = await BarcodeDetector.getSupportedFormats();
    const formats = BARCODE_FORMATS.filter((f) => supportedFormats.includes(f));
    nativeDetector = new BarcodeDetector({ formats });

    // 2. Запитуємо HD камеру з continuous autofocus
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        focusMode: 'continuous',
        advanced: [{ focusMode: 'continuous' }],
      },
      audio: false,
    });

    // 3. Рендеримо video element
    videoEl = document.createElement('video');
    videoEl.setAttribute('playsinline', 'true');
    videoEl.muted = true;
    videoEl.autoplay = true;
    videoEl.srcObject = videoStream;
    videoEl.style.width = '100%';
    videoEl.style.height = '100%';
    videoEl.style.objectFit = 'cover';
    videoEl.style.display = 'block';

    readerEl.innerHTML = '';
    readerEl.appendChild(videoEl);

    await videoEl.play();

    // 4. Перевіряємо підтримку ліхтарика
    const [track] = videoStream.getVideoTracks();
    torchTrack = track;
    const capabilities = track.getCapabilities?.() || {};
    const hasTorch = 'torch' in capabilities;
    updateTorchButton(hasTorch, false);

    // 5. Запускаємо цикл детекції
    isNativeScanning = true;
    if (statusEl) {
      statusEl.textContent = 'Наведіть камеру на штрих-код';
      statusEl.className = 'scanner-modal__status';
    }

    detectLoop();
  } catch (err) {
    console.error('Native scanner failed, fallback...', err);
    // Якщо native зламався — пробуємо fallback
    await loadHtml5QrCodeLibrary();
    await startFallbackScanner();
  }
}

async function detectLoop() {
  if (!isNativeScanning || !videoEl || !nativeDetector) return;

  try {
    // Чекаємо поки відео готове
    if (videoEl.readyState >= 2) {
      const barcodes = await nativeDetector.detect(videoEl);
      if (barcodes.length > 0) {
        const code = barcodes[0].rawValue;
        if (code) {
          if (navigator.vibrate) navigator.vibrate(200);
          isNativeScanning = false; // блокуємо повторні виклики
          handleBarcodeScan(code);
          return;
        }
      }
    }
  } catch (err) {
    // Окремі кадри можуть фейлитись — не зупиняємось
    console.debug('Detect tick failed:', err);
  }

  rafId = requestAnimationFrame(detectLoop);
}

// ==================== TORCH (ЛІХТАРИК) ====================

async function toggleTorch() {
  if (!torchTrack) return;

  try {
    torchOn = !torchOn;
    await torchTrack.applyConstraints({
      advanced: [{ torch: torchOn }],
    });
    updateTorchButton(true, torchOn);
  } catch (err) {
    console.warn('Не вдалося перемкнути ліхтарик:', err);
    torchOn = false;
    updateTorchButton(true, false);
  }
}

function updateTorchButton(supported, on) {
  const torchBtn = document.getElementById('torchBtn');
  if (!torchBtn) return;

  torchBtn.hidden = !supported;
  torchBtn.classList.toggle('is-on', on);
  torchBtn.setAttribute('aria-pressed', String(on));
}

// ==================== FALLBACK (html5-qrcode) ====================

function loadHtml5QrCodeLibrary() {
  return new Promise((resolve, reject) => {
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

async function startFallbackScanner() {
  const readerEl = document.getElementById('barcode-reader');
  const statusEl = document.getElementById('scannerStatus');

  if (!readerEl || !window.Html5Qrcode) return;

  readerEl.innerHTML = '';

  const config = {
    fps: 25,
    qrbox: (w, h) => {
      // Широкий прямокутник під ШК, адаптивний до розміру
      const boxW = Math.floor(w * 0.85);
      const boxH = Math.floor(h * 0.35);
      return { width: boxW, height: boxH };
    },
    formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
    ],
    videoConstraints: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      focusMode: 'continuous',
      advanced: [{ focusMode: 'continuous' }],
    },
    experimentalFeatures: {
      useBarCodeDetectorIfSupported: true,
    },
  };

  const onSuccess = (decodedText) => {
    if (navigator.vibrate) navigator.vibrate(200);
    handleBarcodeScan(decodedText);
  };

  const onFailure = () => {
    // Тиша — це нормально коли код ще не в кадрі
  };

  try {
    html5QrCode = new Html5Qrcode('barcode-reader');

    try {
      await html5QrCode.start({ facingMode: 'environment' }, config, onSuccess, onFailure);
      isFallbackScanning = true;
    } catch (backErr) {
      console.warn('Задня камера недоступна, пробуємо fallback:', backErr);
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        await html5QrCode.start(devices[0].id, config, onSuccess, onFailure);
        isFallbackScanning = true;
      } else {
        throw new Error('Камери не знайдено');
      }
    }

    // Підхоплюємо torch track з активного стріму (для кнопки ліхтарика)
    setTimeout(() => {
      try {
        const vid = readerEl.querySelector('video');
        if (vid?.srcObject) {
          const [track] = vid.srcObject.getVideoTracks();
          torchTrack = track;
          const capabilities = track.getCapabilities?.() || {};
          updateTorchButton('torch' in capabilities, false);
        }
      } catch {
        // silent
      }
    }, 500);

    if (statusEl) {
      statusEl.textContent = 'Наведіть камеру на штрих-код';
      statusEl.className = 'scanner-modal__status';
    }
  } catch (err) {
    console.error('Fallback scanner failed:', err);
    if (statusEl) {
      statusEl.textContent = 'Камера недоступна. Введіть код вручну.';
      statusEl.className = 'scanner-modal__status scanner-modal__status--error';
    }
  }
}

// ==================== ОБРОБКА ШТРИХ-КОДУ ====================
// (логіка БД + Open Food Facts — залишена 1 в 1 як було)

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

async function searchOpenFoodFacts(barcode) {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,product_name_uk,product_name_pl,product_name_en,brands,nutriments,image_url`,
    );
    const data = await response.json();

    if (data.status !== 1 || !data.product) return null;

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

async function saveToLocalDatabase(product) {
  try {
    const { error } = await supabase.from('scanned_products').upsert([product], {
      onConflict: 'barcode',
      ignoreDuplicates: true,
    });
    if (error) console.warn('Не вдалося кешувати продукт:', error);
  } catch (err) {
    console.warn('Помилка кешування:', err);
  }
}

function onProductFoundHandler(product) {
  const statusEl = document.getElementById('scannerStatus');
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

  // Закриваємо сканер через 1 секунду і передаємо продукт у callback
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
