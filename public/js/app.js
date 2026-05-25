// Copyright by cdblue999@gmail.com, 2026
let charts = {};
let currentPlant = null;

const $ = id => document.getElementById(id);
const loading = $('loading');
const loadingText = $('loading-text');
const plantCards = $('plant-cards');
const plantDetail = $('plant-detail');
const plantsOverview = $('plants-overview');
const plantDetailHeader = $('plant-detail-header');
const plantsCount = $('plants-count');
const summaryStats = $('summary-stats');
const backBtn = $('back-btn');
const refreshBtn = $('refresh-btn');
const prosumerBtn = $('prosumer-btn');
const accountName = $('account-name');
const toastContainer = $('toast-container');

function showLoading(msg) {
  loadingText.textContent = msg || t('loading');
  loading.classList.remove('hidden');
}
function hideLoading() { loading.classList.add('hidden'); }

// Toast notification system
let toastTimer = null;
function showToast(message, type = 'error', duration = 5000) {
  if (!toastContainer) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span class="toast-icon">${type === 'success' ? '✓' : type === 'warning' ? '⚠' : '✕'}</span><span class="toast-msg">${escHtml(message)}</span>`;
  toastContainer.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast-visible'));
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('toast-visible');
    setTimeout(() => t.remove(), 300);
  }, duration);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// Global error handler
const globalOnError = (err) => {
  if (err && !err._handled) {
    showToast(err.message || t('unexpectedError'));
  }
};
window.addEventListener('unhandledrejection', (e) => {
  globalOnError(e.reason);
});

// === Auth check ===
async function checkAuth() {
  try {
    const data = await api('/api/auth/status');
    if (!data.loggedIn) {
      window.location.href = '/login.html';
      return false;
    }
    return true;
  } catch {
    window.location.href = '/login.html';
    return false;
  }
}

// === Internationalization ===
const LANG = {
  pl: {
    pageTitle: 'myGrowatt - Monitor PV',
    tabOverview: 'Przegląd',
    tabDevices: 'Urządzenia',
    tabCharts: 'Wykresy',
    tabBilling: 'Rozliczenia',
    tabBattery: 'Bateria',
    langName: 'PL',
    langAlt: 'EN',
    copyright: 'Copyright by cdblue999@gmail.com, 2026',
    refreshBtnTitle: 'Odśwież wszystkie dane',
    refreshBtnText: 'Odśwież',
    prosumerBtnTitle: 'Informacje o rozliczeniach prosumenta',
    logoutBtnTitle: 'Wyloguj się',
    loading: 'Ładowanie...',
    loadingPlants: 'Ładowanie plantacji...',
    loadingPlant: 'Ładowanie szczegółów...',
    loadingBilling: 'Ładowanie danych rozliczeniowych...',
    loadingData: 'Ładowanie danych...',
    yourPlants: 'Twoje plantacje',
    plants: 'Plantacje',
    online: 'Online',
    offline: 'Offline',
    totalKwh: 'Całkowita kWh',
    todayKwh: 'Dzisiaj kWh',
    peakPowerKw: 'Moc szczytowa (kW)',
    location: 'Lokalizacja',
    plantLabel: 'Plantacja',
    retry: 'Ponów',
    allPlants: 'Wszystkie plantacje',
    name: 'Nazwa',
    totalEnergy: 'Energia całkowita',
    today: 'Dzisiaj',
    currentPower: 'Moc bieżąca',
    monthly: 'Miesięcznie',
    yearly: 'Rocznie',
    peakPower: 'Moc szczytowa',
    plantOverview: 'Przegląd plantacji',
    installedArea: 'Powierzchnia instalacji',
    gridType: 'Rodzaj sieci',
    timezone: 'Strefa czasowa',
    address: 'Adres',
    country: 'Kraj',
    created: 'Utworzono',
    energySummary: 'Podsumowanie energii',
    thisMonth: 'W tym miesiącu',
    thisYear: 'W tym roku',
    co2Saved: 'CO₂ zaoszczędzone',
    lastUpdate: 'Ostatnia aktualizacja',
    devices: 'Urządzenia',
    inverter: 'Inwerter',
    energyKwh: 'Energia (kWh)',
    energyPeriod: 'Energia — {0}',
    noEnergyData: 'Brak danych energii dla tego okresu',
    noPowerData: 'Brak danych mocy na dzisiaj',
    powerW: 'Moc (W)',
    powerToday: 'Moc — Dzisiaj (5-min interwały)',
    day: 'Dzień',
    month: 'Miesiąc',
    year: 'Rok',
    noDevices: 'Nie znaleziono urządzeń dla tej plantacji.',
    sn: 'SN',
    type: 'Typ',
    datalogger: 'Rejestrator',
    lastUpdateLabel: 'Ostatnia aktualizacja',
    settings: 'Ustawienia',
    realtimeUnavailable: 'Dane czasu rzeczywistego niedostępne przez API',
    batteryUnavailable: 'Dane baterii dostępne tylko dla systemów hybrydowych MIX/SPH.',
    // Billing
    plant: 'Plantacja',
    installed: 'Zainstalowano',
    system: 'System',
    ratio: 'Współczynnik',
    contract: 'Kontrakt',
    netMetering: 'Net-Metering (opusty)',
    netBilling: 'Net-Billing',
    yourSystem: 'Twój system',
    legacy: 'Przestarzały',
    alternative: 'Alternatywa',
    productionSummary: 'Podsumowanie produkcji',
    lifetimeProduction: 'produkcja całkowita',
    yearlyAvg: 'Średnia roczna',
    thisYearLabel: 'W tym roku',
    thisMonthLabel: 'W tym miesiącu',
    todayLabel: 'Dzisiaj',
    selfConsumption: 'Autokonsumpcja',
    gridPrice: 'Cena energii (PLN/kWh)',
    sellPrice: 'Cena sprzedaży (PLN/kWh)',
    equivalentEnergy: 'ekwiwalent energii',
    totalFinancial: 'łączna korzyść finansowa',
    selfConsumed: 'Autokonsumpcja',
    exportedToGrid: 'Oddane do sieci',
    credit: 'Kredyt (1:{0})',
    saved: 'Zapis ({0} PLN/kWh)',
    sold: 'Sprzedano ({0} PLN/kWh)',
    totalValue: 'Łączna wartość',
    yearlyProduction: 'Produkcja roczna',
    year: 'Rok',
    estValueOpusty: 'Szac. wartość (opusty)',
    estValueNetBilling: 'Szac. wartość (net-billing)',
    total: 'Razem',
    // Devices tab
    deviceInfo: 'Informacje o urządzeniu',
    gridParams: 'Parametry sieci',
    powerSettings: 'Ustawienia mocy',
    systemSettings: 'System',
    deviceSettings: 'Ustawienia urządzenia — {0}',
    failedLoadSettings: 'Nie udało się załadować ustawień: ',
    settingsSaved: 'Ustawienia zapisane pomyślnie',
    failedSave: 'Nie udało się zapisać: ',
    saveSettings: 'Zapisz ustawienia',
    saving: 'Zapisywanie...',
    cancel: 'Anuluj',
    // Settings labels
    voltageHighLimit: 'Górny limit napięcia (V)',
    voltageLowLimit: 'Dolny limit napięcia (V)',
    workingFrequencyMin: 'Częstotliwość min (Hz)',
    workingFrequencyMax: 'Częstotliwość max (Hz)',
    wideVoltageEnable: 'Szeroki zakres nap.',
    activeRate: 'Współczynnik aktywny (%)',
    reactiveRate: 'Współczynnik bierny (%)',
    pf: 'Współczynnik mocy',
    pfModel: 'Model PF',
    alias: 'Alias',
    onOff: 'Wł./Wył.',
    // Settings options
    disabled: 'Wyłączone',
    enabled: 'Włączone',
    off: 'Wył.',
    on: 'Wł.',
    fixedPf: 'Stały PF',
    pfCurve: 'Krzywa PF',
    // Errors
    failedLoadPlants: 'Nie udało się załadować plantacji: ',
    failedLoadPlant: 'Nie udało się załadować szczegółów: ',
    chartUnavailable: 'Dane wykresu niedostępne: ',
    unexpectedError: 'Wystąpił nieoczekiwany błąd',
    requestFailed: 'Żądanie nie powiodło się ({0})',
    // Prosumer modal
    prosumerTitle: 'Informacje o rozliczeniach prosumenta — Polska',
    prosumerNetMetering: 'Net-Metering (opusty) — do 31.03.2022',
    prosumerNetMeteringDesc: 'Dla instalacji zgłoszonych do 31 marca 2022. Obowiązuje przez 15 lat od pierwszej kWh wprowadzonej do sieci.',
    prosumerNmLe10: 'Instalacja ≤10 kW: oddaj 1 kWh → odbierz 0,8 kWh',
    prosumerNmGt10: 'Instalacja >10 kW: oddaj 1 kWh → odbierz 0,7 kWh',
    prosumerNmNoDist: 'Brak opłaty dystrybucyjnej zmiennej',
    prosumerNm12m: 'Rozliczenie nadwyżki w ciągu 12 miesięcy',
    prosumerNetBilling: 'Net-Billing — od 1.04.2022',
    prosumerNbDesc: 'Dla nowych prosumentów (wniosek od 1 kwietnia 2022). Rozliczenie wartościowe (PLN), nie ilościowe.',
    prosumerNbMarket: 'Nadwyżka sprzedawana po cenie rynkowej',
    prosumerNbDistFee: 'Opłata dystrybucyjna zmienna naliczana',
    prosumerNbDeposit: 'Depozyt prosumencki ważny 12 miesięcy',
    prosumerNbRefund: 'Zwrot max 20% nadwyżki miesięcznej',
    prosumerTimeline: 'Kalendarium',
    prosumerTl2019: 'Pakiet Prosumencki — firmy mogą być prosumentami (do 50 kW)',
    prosumerTl202204: 'Net-billing wchodzi dla nowych prosumentów',
    prosumerTl202207: 'Wycena po miesięcznej cenie rynkowej',
    prosumerTl202407: 'Wycena po cenach godzinowych (RDN)',
    prosumerSources: 'Źródła oficjalne',
    prosumerModalClose: '×'
  },
  en: {
    pageTitle: 'myGrowatt - PV Plant Monitor',
    tabOverview: 'Overview',
    tabDevices: 'Devices',
    tabCharts: 'Energy Charts',
    tabBilling: 'Billing',
    tabBattery: 'Battery',
    langName: 'EN',
    langAlt: 'PL',
    copyright: 'Copyright by cdblue999@gmail.com, 2026',
    refreshBtnTitle: 'Refresh all data',
    refreshBtnText: 'Refresh',
    prosumerBtnTitle: 'Polish prosumer billing info',
    logoutBtnTitle: 'Sign out',
    loading: 'Loading...',
    loadingPlants: 'Loading your plants...',
    loadingPlant: 'Loading plant details...',
    loadingBilling: 'Loading billing data...',
    loadingData: 'Loading data...',
    yourPlants: 'Your Plants',
    plants: 'Plants',
    online: 'Online',
    offline: 'Offline',
    totalKwh: 'Total kWh',
    todayKwh: 'Today kWh',
    peakPowerKw: 'Peak Power (kW)',
    location: 'Location',
    plantLabel: 'Plant',
    retry: 'Retry',
    allPlants: 'All Plants',
    name: 'Name',
    totalEnergy: 'Total Energy',
    today: 'Today',
    currentPower: 'Current Power',
    monthly: 'Monthly',
    yearly: 'Yearly',
    peakPower: 'Peak Power',
    plantOverview: 'Plant Overview',
    installedArea: 'Installed Area',
    gridType: 'Grid Type',
    timezone: 'Timezone',
    address: 'Address',
    country: 'Country',
    created: 'Created',
    energySummary: 'Energy Summary',
    thisMonth: 'This Month',
    thisYear: 'This Year',
    co2Saved: 'CO₂ Saved',
    lastUpdate: 'Last Update',
    devices: 'Devices',
    inverter: 'Inverter',
    energyKwh: 'Energy (kWh)',
    energyPeriod: 'Energy — {0}',
    noEnergyData: 'No energy data for this period',
    noPowerData: 'No power data for today',
    powerW: 'Power (W)',
    powerToday: 'Power — Today (5-min intervals)',
    day: 'Day',
    month: 'Month',
    year: 'Year',
    noDevices: 'No devices found for this plant.',
    sn: 'SN',
    type: 'Type',
    datalogger: 'Datalogger',
    lastUpdateLabel: 'Last Update',
    settings: 'Settings',
    realtimeUnavailable: 'Real-time data unavailable via API',
    batteryUnavailable: 'Battery data is only available for MIX/SPH hybrid inverter systems.',
    plant: 'Plant',
    installed: 'Installed',
    system: 'System',
    ratio: 'Ratio',
    contract: 'Contract',
    netMetering: 'Net-Metering (opusty)',
    netBilling: 'Net-Billing',
    yourSystem: 'Your system',
    legacy: 'Legacy',
    alternative: 'Alternative',
    productionSummary: 'Production Summary',
    lifetimeProduction: 'lifetime production',
    yearlyAvg: 'Yearly avg',
    thisYearLabel: 'This year',
    thisMonthLabel: 'This month',
    todayLabel: 'Today',
    selfConsumption: 'Self-consumption',
    gridPrice: 'Grid price (PLN/kWh)',
    sellPrice: 'Sell price (PLN/kWh)',
    equivalentEnergy: 'equivalent energy benefit',
    totalFinancial: 'total financial benefit',
    selfConsumed: 'Self-consumed',
    exportedToGrid: 'Exported to grid',
    credit: 'Credit (1:{0})',
    saved: 'Saved ({0} PLN/kWh)',
    sold: 'Sold ({0} PLN/kWh)',
    totalValue: 'Total value',
    yearlyProduction: 'Yearly Production',
    year: 'Year',
    estValueOpusty: 'Est. value (opusty)',
    estValueNetBilling: 'Est. value (net-billing)',
    total: 'Total',
    deviceInfo: 'Device Info',
    gridParams: 'Grid Parameters',
    powerSettings: 'Power Settings',
    systemSettings: 'System',
    deviceSettings: 'Device Settings — {0}',
    failedLoadSettings: 'Failed to load settings: ',
    settingsSaved: 'Settings saved successfully',
    failedSave: 'Failed to save: ',
    saveSettings: 'Save Settings',
    saving: 'Saving...',
    cancel: 'Cancel',
    voltageHighLimit: 'Voltage High Limit (V)',
    voltageLowLimit: 'Voltage Low Limit (V)',
    workingFrequencyMin: 'Freq Min (Hz)',
    workingFrequencyMax: 'Freq Max (Hz)',
    wideVoltageEnable: 'Wide Voltage',
    activeRate: 'Active Rate (%)',
    reactiveRate: 'Reactive Rate (%)',
    pf: 'Power Factor',
    pfModel: 'PF Model',
    alias: 'Alias',
    onOff: 'On/Off',
    disabled: 'Disabled',
    enabled: 'Enabled',
    off: 'Off',
    on: 'On',
    fixedPf: 'Fixed PF',
    pfCurve: 'PF Curve',
    failedLoadPlants: 'Failed to load plants: ',
    failedLoadPlant: 'Failed to load plant details: ',
    chartUnavailable: 'Chart data unavailable: ',
    unexpectedError: 'An unexpected error occurred',
    requestFailed: 'Request failed ({0})',
    prosumerTitle: 'Prosumer Billing Info — Poland',
    prosumerNetMetering: 'Net-Metering (opusty) — until 31.03.2022',
    prosumerNetMeteringDesc: 'For installations reported before March 31, 2022. Valid for 15 years from the first kWh fed to the grid.',
    prosumerNmLe10: 'Installation ≤10 kW: give 1 kWh → take 0.8 kWh',
    prosumerNmGt10: 'Installation >10 kW: give 1 kWh → take 0.7 kWh',
    prosumerNmNoDist: 'No variable distribution fee',
    prosumerNm12m: 'Settlement within 12 months',
    prosumerNetBilling: 'Net-Billing — from 1.04.2022',
    prosumerNbDesc: 'For new prosumers (application from April 1, 2022). Monetary settlement (PLN), not energy-based.',
    prosumerNbMarket: 'Surplus sold at market price',
    prosumerNbDistFee: 'Variable distribution fee charged',
    prosumerNbDeposit: 'Prosumer deposit valid 12 months',
    prosumerNbRefund: 'Refund max 20% of monthly surplus',
    prosumerTimeline: 'Timeline',
    prosumerTl2019: 'Prosumer Package — companies can be prosumers (up to 50 kW)',
    prosumerTl202204: 'Net-billing introduced for new prosumers',
    prosumerTl202207: 'Monthly market price valuation',
    prosumerTl202407: 'Hourly RDN price valuation',
    prosumerSources: 'Official Sources',
    prosumerModalClose: '×'
  }
};

let currentLang = 'pl';

function t(key, ...args) {
  let str = (LANG[currentLang] && LANG[currentLang][key]);
  if (!str) str = (LANG['en'] && LANG['en'][key]);
  if (!str) str = key;
  if (args.length) {
    args.forEach((a, i) => { str = str.replace(new RegExp(`\\{${i}\\}`, 'g'), a); });
  }
  return str;
}

function translateStatic() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (key && el.textContent.trim()) el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

function toggleLang() {
  currentLang = currentLang === 'pl' ? 'en' : 'pl';
  document.documentElement.lang = currentLang;
  const btn = document.getElementById('lang-btn');
  if (btn) btn.textContent = t('langAlt');
  translateStatic();
  // Re-render dynamic content
  if (currentPlant) {
    const activeTab = document.querySelector('.tab.active');
    if (activeTab) {
      activeTab.click();
    } else {
      loadPlantDetail(currentPlant.id);
    }
  } else {
    loadDashboard();
  }
  // Update prosumer modal if visible
  const prosumerModal = document.getElementById('prosumer-modal');
  if (prosumerModal && !prosumerModal.classList.contains('hidden')) {
    renderProsumerModal();
  }
}

function initLang() {
  const langBtn = document.getElementById('lang-btn');
  if (langBtn) langBtn.textContent = t('langAlt');
  translateStatic();
}

// Prosumer Info
prosumerBtn.addEventListener('click', () => {
  renderProsumerModal();
  document.getElementById('prosumer-modal').classList.remove('hidden');
});
function closeProsumerInfo() {
  document.getElementById('prosumer-modal').classList.add('hidden');
}

function renderProsumerModal() {
  const modal = document.getElementById('prosumer-modal');
  if (!modal) return;
  modal.querySelector('.modal-header h3').textContent = t('prosumerTitle');
  const body = modal.querySelector('.modal-body');
  body.innerHTML = `
    <div class="prosumer-section">
      <h4>${t('prosumerNetMetering')}</h4>
      <p>${t('prosumerNetMeteringDesc')}</p>
      <ul>
        <li>${t('prosumerNmLe10')}</li>
        <li>${t('prosumerNmGt10')}</li>
        <li>${t('prosumerNmNoDist')}</li>
        <li>${t('prosumerNm12m')}</li>
      </ul>
    </div>
    <div class="prosumer-section">
      <h4>${t('prosumerNetBilling')}</h4>
      <p>${t('prosumerNbDesc')}</p>
      <ul>
        <li>${t('prosumerNbMarket')}</li>
        <li>${t('prosumerNbDistFee')}</li>
        <li>${t('prosumerNbDeposit')}</li>
        <li>${t('prosumerNbRefund')}</li>
      </ul>
    </div>
    <div class="prosumer-section">
      <h4>${t('prosumerTimeline')}</h4>
      <table class="prosumer-timeline">
        <tr><td class="yr">2019</td><td>${t('prosumerTl2019')}</td></tr>
        <tr><td class="yr">2022-04</td><td>${t('prosumerTl202204')}</td></tr>
        <tr><td class="yr">2022-07</td><td>${t('prosumerTl202207')}</td></tr>
        <tr><td class="yr">2024-07</td><td>${t('prosumerTl202407')}</td></tr>
      </table>
    </div>
    <div class="prosumer-section">
      <h4>${t('prosumerSources')}</h4>
      <ul class="prosumer-links">
        <li><a href="https://www.gov.pl/web/klimat/sejm-przyjal-nowelizacje-ustawy-o-odnawialnych-zrodlach-energii-wprowadzajaca-zmiany-do-systemu-rozliczen-prosumentow" target="_blank" rel="noopener">Gov.pl — Net-billing introduction (2021)</a></li>
        <li><a href="https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20190000503" target="_blank" rel="noopener">ISAP — Rozporządzenie 2019 poz. 503</a></li>
        <li><a href="https://eon.pl/-/media/Eon/Dokumenty/Obsluga-i-pomoc/Zasady-rozliczania/QA_Zasady_rozliczenia_prosumentow.ashx" target="_blank" rel="noopener">E.ON — Zasady rozliczania prosumentów</a></li>
        <li><a href="https://kwant.net.pl/akademia/artykuly/jak-rozlicza-sie-prosument-nowy-system-rozliczania-z-zakladem-energetycznym-dla-prosumentow-1-kwietnia-2022-r-60" target="_blank" rel="noopener">Kwant — Jak rozlicza się prosument?</a></li>
      </ul>
    </div>
  `;
}

checkAuth().then(ok => {
  if (ok) {
    initLang();
    loadAccount();
    loadDashboard();
  }
});

async function loadAccount() {
  try {
    const data = await api('/api/account');
    if (data.name) accountName.textContent = data.name;
  } catch {
    // Silently fail - account name is optional
  }
  // Show logout button when fully loaded
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.style.display = '';
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {}
  window.location.href = '/login.html';
}

async function loadDashboard() {
  showLoading(t('loadingPlants'));
  try {
    const plants = await api('/api/plants');
    renderPlantCards(plants);
  } catch (err) {
    err._handled = true;
    showToast(t('failedLoadPlants') + err.message, 'error', 8000);
    plantCards.innerHTML = `<div class="error-state">
      <div class="error-icon">
        <svg viewBox="0 0 24 24" width="48" height="48"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#f87171" opacity="0.6"/></svg>
      </div>
      <p>${escHtml(err.message)}</p>
      <button class="btn-sm" onclick="loadDashboard()">${t('retry')}</button>
    </div>`;
  } finally {
    hideLoading();
  }
}

refreshBtn.addEventListener('click', () => {
  if (currentPlant) {
    loadPlantDetail(currentPlant.id);
  } else {
    loadDashboard();
  }
});

function renderPlantCards(plants) {
  plantCards.innerHTML = '';
  const list = Array.isArray(plants) ? plants : [];
  plantsCount.textContent = `${list.length} ${t('plants')}`;

  let totalEnergy = 0;
  let onlineCount = 0;

  list.forEach((p, i) => {
    const id = p.plant_id || p.id;
    const name = p.name || p.plantName || `Plant ${id}`;
    const energy = parseFloat(p.total_energy || p.eTotal || 0);
    if (!isNaN(energy)) totalEnergy += energy;

    const isOnline = String(p.status) === '1' || String(p.status) === 'online' || String(p.status) === '0';
    if (isOnline) onlineCount++;

    const statusText = isOnline ? t('online') : t('offline');
    const statusClass = isOnline ? 'status-online' : 'status-offline';

    const card = document.createElement('div');
    card.className = 'plant-card';
    card.style.animationDelay = `${i * 0.06}s`;
    card.innerHTML = `
      <div class="plant-card-header">
        <div class="plant-name">${escHtml(name)}</div>
        <div class="plant-status ${statusClass}">${statusText}</div>
      </div>
      <div class="plant-card-stats">
        <div class="plant-stat">
          <div class="value accent">${fmt(p.total_energy || p.eTotal || '—')}</div>
          <div class="label">${t('totalKwh')}</div>
        </div>
        <div class="plant-stat">
          <div class="value ${p.today_energy ? 'green' : ''}">${fmt(p.today_energy || p.eToday || '—')}</div>
          <div class="label">${t('todayKwh')}</div>
        </div>
        <div class="plant-stat">
          <div class="value blue">${fmt(p.peak_power || p.nominalPower || '—')}</div>
          <div class="label">${t('peakPowerKw')}</div>
        </div>
        <div class="plant-stat">
          <div class="value purple">${p.city || p.country || '—'}</div>
          <div class="label">${t('location')}</div>
        </div>
      </div>
    `;
    card.addEventListener('click', () => loadPlantDetail(id));
    plantCards.appendChild(card);
  });

  summaryStats.innerHTML = `
    <div class="summary-stat"><span class="value">${list.length}</span><span class="label">${t('plants')}</span></div>
    <div class="summary-stat"><span class="value">${onlineCount}</span><span class="label">${t('online')}</span></div>
    <div class="summary-stat"><span class="value accent">${fmt(totalEnergy)}</span><span class="label">${t('totalKwh')}</span></div>
  `;
}

async function loadPlantDetail(plantId) {
  showLoading(t('loadingPlant'));
  plantDetail.classList.remove('hidden');
  plantsOverview.classList.add('hidden');
  currentPlant = { id: plantId };

  try {
    const data = await api(`/api/plant/${plantId}`);
    const { details, overview, devices } = data;
    currentPlant.devices = devices || [];
    currentPlant.details = details;

    renderPlantHeader(details, overview);
    renderOverviewTab(details, overview, devices);
    loadChartData('daily', plantId);
    renderDevicesTab(devices);
    renderBatteryTab(plantId);
  } catch (err) {
    err._handled = true;
    showToast(t('failedLoadPlant') + err.message, 'error', 8000);
    plantDetailHeader.innerHTML = `<div class="error-state"><p>${escHtml(err.message)}</p><button class="btn-sm" onclick="loadPlantDetail('${plantId}')">${t('retry')}</button></div>`;
  } finally {
    hideLoading();
  }
}

function renderPlantHeader(details, overview) {
  plantDetailHeader.innerHTML = '';
  const metrics = [
    { label: t('name'), value: details.name || '—', cls: '' },
    { label: t('totalEnergy'), value: `${fmt(overview.total_energy)} kWh`, cls: 'accent' },
    { label: t('today'), value: `${fmt(overview.today_energy)} kWh`, cls: 'green' },
    { label: t('currentPower'), value: `${fmt(overview.current_power * 1000)} W`, cls: 'blue' },
    { label: t('monthly'), value: `${fmt(overview.monthly_energy)} kWh`, cls: 'accent' },
    { label: t('yearly'), value: `${fmt(overview.yearly_energy)} kWh`, cls: 'green' },
    { label: t('peakPower'), value: `${fmt(details.peak_power)} kW`, cls: '' },
    { label: t('location'), value: [details.city, details.country].filter(Boolean).join(', ') || '—', cls: '' }
  ];
  metrics.forEach(m => {
    const d = document.createElement('div');
    d.className = 'detail-stat';
    d.innerHTML = `<div class="value ${m.cls}">${m.value}</div><div class="label">${m.label}</div>`;
    plantDetailHeader.appendChild(d);
  });
}

function renderOverviewTab(details, overview, devices) {
  const ov = document.querySelector('#tab-overview');
  ov.innerHTML = '';

  const plantCard = document.createElement('div');
  plantCard.className = 'info-card';
  plantCard.innerHTML = `
    <h3>${t('plantOverview')}</h3>
    <div class="info-row"><span>${t('peakPower')}</span><span class="val">${fmt(details.peak_power)} kW</span></div>
    <div class="info-row"><span>${t('installedArea')}</span><span class="val">${details.installed_panel_area || details.installed_dc_capacity || '—'}</span></div>
    <div class="info-row"><span>${t('gridType')}</span><span class="val">${details.grid_type || '—'}</span></div>
    <div class="info-row"><span>${t('timezone')}</span><span class="val">${details.timezone || '—'}</span></div>
    <div class="info-row"><span>${t('address')}</span><span class="val">${[details.address1, details.address2, details.city].filter(Boolean).join(', ') || '—'}</span></div>
    <div class="info-row"><span>${t('country')}</span><span class="val">${details.country || '—'}</span></div>
    <div class="info-row"><span>${t('created')}</span><span class="val">${details.create_date || '—'}</span></div>
  `;
  ov.appendChild(plantCard);

  const energyCard = document.createElement('div');
  energyCard.className = 'info-card';
  energyCard.innerHTML = `
    <h3>${t('energySummary')}</h3>
    <div class="info-row"><span>${t('totalEnergy')}</span><span class="val accent">${fmt(overview.total_energy)} kWh</span></div>
    <div class="info-row"><span>${t('today')}</span><span class="val green">${fmt(overview.today_energy)} kWh</span></div>
    <div class="info-row"><span>${t('thisMonth')}</span><span class="val">${fmt(overview.monthly_energy)} kWh</span></div>
    <div class="info-row"><span>${t('thisYear')}</span><span class="val">${fmt(overview.yearly_energy)} kWh</span></div>
    <div class="info-row"><span>${t('currentPower')}</span><span class="val blue">${fmt(overview.current_power * 1000)} W</span></div>
    <div class="info-row"><span>${t('co2Saved')}</span><span class="val green">${fmt(overview.carbon_offset)} kg</span></div>
    <div class="info-row"><span>${t('lastUpdate')}</span><span class="val">${overview.last_update_time || '—'}</span></div>
  `;
  ov.appendChild(energyCard);

  if (devices && devices.length > 0) {
    const deviceCard = document.createElement('div');
    deviceCard.className = 'info-card';
    deviceCard.innerHTML = `
      <h3>${t('devices')}</h3>
      ${devices.map(d => `
        <div class="info-row">
          <div class="device-clickable" onclick="openDeviceSettings('${d.type}','${d.device_sn}')">
            <span>${escHtml(d.model || t('inverter'))}</span>
            <span class="settings-icon">⚙</span>
          </div>
          <span class="val ${d.status === 1 ? 'green' : ''}">SN: ${d.device_sn} ${d.status === 1 ? '🟢' : '🔴'}</span>
        </div>
      `).join('')}
    `;
    ov.appendChild(deviceCard);
  }
}

async function loadChartData(period, plantId) {
  try {
    const data = await api(`/api/plant/${plantId}/energy/${period}`);
    renderCharts(data, period);
  } catch (err) {
    showToast(t('failedChart') + err.message, 'warning', 5000);
  }
}

function renderCharts(data, period) {
  destroyCharts();

  const energys = data.energys || [];
  const labels = energys.map(e => e.date || e.time || '');
  const values = energys.map(e => parseFloat(e.energy) || 0);

  const commonOpts = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { labels: { color: '#8892a6', font: { size: 11 } } }
    },
    scales: {
      x: { ticks: { color: '#5a6577', maxTicksLimit: 12, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
      y: { ticks: { color: '#5a6577', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
    }
  };

  // Energy chart
  const energyEl = $('chart-energy');
  if (energyEl && labels.length > 0) {
    const ctx = energyEl.getContext('2d');
    charts['chart-energy'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: t('energyKwh'),
          data: values,
          backgroundColor: '#f5c842',
          borderRadius: 4
        }]
      },
      options: {
        ...commonOpts,
        plugins: {
          ...commonOpts.plugins,
          title: { display: true, text: t('energyPeriod', period), color: '#e8edf5', font: { size: 13 } }
        }
      }
    });
  } else if (energyEl) {
    energyEl.parentElement.innerHTML = '<div style="padding:40px;text-align:center;color:#5a6577;">' + t('noEnergyData') + '</div><canvas id="chart-energy" style="display:none"></canvas>';
  }

  // Power chart (load separately)
  loadPowerChart(period);
}

async function loadPowerChart(period) {
  if (!currentPlant) return;
  try {
    const data = await api(`/api/plant/${currentPlant.id}/power`);
    const powers = data.powers || [];
    if (powers.length === 0) {
      const el = $('chart-power');
      if (el) el.parentElement.innerHTML = '<div style="padding:40px;text-align:center;color:#5a6577;">' + t('noPowerData') + '</div><canvas id="chart-power" style="display:none"></canvas>';
      return;
    }
    const labels = powers.map(p => p.time || '');
    const values = powers.map(p => parseFloat(p.power) || 0);

    const powerEl = $('chart-power');
    if (!powerEl) return;
    const ctx = powerEl.getContext('2d');
    charts['chart-power'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: t('power'),
          data: values,
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96,165,250,0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { labels: { color: '#8892a6', font: { size: 11 } } },
          title: { display: true, text: t('powerToday'), color: '#e8edf5', font: { size: 13 } }
        },
        scales: {
          x: { ticks: { color: '#5a6577', maxTicksLimit: 24, font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
          y: { ticks: { color: '#5a6577', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  } catch (err) {
    console.error('Power chart error:', err);
  }
}

function renderDevicesTab(devices) {
  const grid = document.getElementById('devices-grid');
  if (!grid) return;
  if (!devices || devices.length === 0) {
    grid.innerHTML = `<p class="empty-state">${t('noDevices')}</p>`;
    return;
  }
  grid.innerHTML = '';
  devices.forEach(d => {
    const card = document.createElement('div');
    card.className = 'device-card';
    card.innerHTML = `
      <div class="device-card-header">
        <span class="device-model">${escHtml(d.model || t('inverter'))}</span>
        <span class="device-status ${d.status === 1 ? 'status-online' : 'status-offline'}">${d.status === 1 ? t('online') : t('offline')}</span>
      </div>
      <div class="device-meta">
        <div class="info-row"><span>${t('sn')}</span><span class="val mono">${escHtml(d.device_sn)}</span></div>
        <div class="info-row"><span>${t('type')}</span><span class="val">${d.type || '—'}</span></div>
        <div class="info-row"><span>${t('datalogger')}</span><span class="val mono">${escHtml(d.datalogger_sn || '—')}</span></div>
        <div class="info-row"><span>${t('lastUpdate')}</span><span class="val">${d.last_update_time || '—'}</span></div>
      </div>
      <div id="device-real-${d.device_sn}" class="device-real">
        <div class="device-real-loading">${t('loadingData')}</div>
      </div>
      <button class="device-settings-btn" onclick="openDeviceSettings('${d.type}','${d.device_sn}')">
        ⚙ ${t('settings')}
      </button>
    `;
    grid.appendChild(card);
    loadDeviceRealData(d.device_sn);
  });
}

async function loadDeviceRealData(sn) {
  const el = document.getElementById(`device-real-${sn}`);
  if (!el) return;
  try {
    const data = await api(`/api/device/${sn}/real`);
    const fields = [
      { label: t('power'), key: 'power', unit: 'W' },
      { label: t('energyToday'), key: 'eToday', unit: 'kWh' },
      { label: t('energyTotal'), key: 'eTotal', unit: 'kWh' },
      { label: t('vac1'), key: 'vac1', unit: 'V' },
      { label: t('iac1'), key: 'iac1', unit: 'A' },
      { label: t('frequency'), key: 'fac1', unit: 'Hz' },
      { label: t('temperature'), key: 'temperature', unit: '°C' },
      { label: t('vpv1'), key: 'vpv1', unit: 'V' }
    ];
    const has = fields.some(f => data[f.key] !== undefined);
    if (has) {
      el.innerHTML = `<div class="device-real-grid">${fields.filter(f => data[f.key] !== undefined).map(f =>
        `<div class="device-real-stat"><span class="lbl">${f.label}</span><span class="val">${fmt(data[f.key])} ${f.unit}</span></div>`
      ).join('')}</div>`;
    } else {
      el.innerHTML = '<div class="device-real-loading">' + t('realtimeUnavailable') + '</div>';
    }
  } catch {
    el.innerHTML = '<div class="device-real-loading">Real-time data unavailable via API</div>';
  }
}

function renderBatteryTab(plantId) {
  const bc = $('tab-battery');
  bc.innerHTML = `<p class="empty-state">${t('batteryUnavailable')}</p>`;
}

// === Billing Tab ===
const BILLING_DEFAULTS = { selfConsumption: 25, gridPrice: 0.80, sellPrice: 0.30 };
let billingParams = { ...BILLING_DEFAULTS };

async function loadBillingTab(plantId) {
  const bc = document.getElementById('billing-content');
  bc.innerHTML = `<div class="modal-loading">${t('loadingBilling')}</div>`;
  try {
    const data = await api(`/api/plant/${plantId}/billing`);
    renderBillingTab(data);
  } catch (err) {
    bc.innerHTML = `<div class="error-state"><p>${escHtml(err.message)}</p></div>`;
  }
}

function renderBillingTab(data) {
  const bc = document.getElementById('billing-content');
  if (!bc) return;

  const { peakPower, createDate, totalEnergy, installBefore2022, netMeteringRatio, yearlies, overview, plantName } = data;
  const installYear = createDate ? createDate.substring(0, 4) : '—';

  // Calculate with current params
  const sc = billingParams.selfConsumption / 100;
  const selfKwh = totalEnergy * sc;
  const exportKwh = totalEnergy * (1 - sc);

  // Net-metering (opusty): 1 kWh exported = netMeteringRatio kWh credit
  const nmCredit = exportKwh * netMeteringRatio;
  const nmTotalKwh = selfKwh + nmCredit;
  const nmValuePLN = nmTotalKwh * billingParams.gridPrice;

  // Net-billing: exported at sellPrice
  const nbExportValue = exportKwh * billingParams.sellPrice;
  const nbSelfValue = selfKwh * billingParams.gridPrice;
  const nbTotalValue = nbExportValue + nbSelfValue;

  bc.innerHTML = `
    <div class="billing-grid">
      <div class="billing-card plant-summary">
        <h3>${escHtml(plantName || t('plant'))}</h3>
        <div class="billing-summary-stats">
          <div class="bill-stat"><span class="lbl">${t('peakPower')}</span><span class="val">${peakPower} kW</span></div>
          <div class="bill-stat"><span class="lbl">${t('installed')}</span><span class="val">${createDate || '—'}</span></div>
          <div class="bill-stat"><span class="lbl">${t('system')}</span><span class="val ${installBefore2022 ? 'green' : 'accent'}">${installBefore2022 ? t('netMetering') : t('netBilling')}</span></div>
          <div class="bill-stat"><span class="lbl">${t('ratio')}</span><span class="val">1:${netMeteringRatio}</span></div>
          <div class="bill-stat"><span class="lbl">${t('contract')}</span><span class="val">${installYear}–${parseInt(installYear) + 15}</span></div>
        </div>
      </div>

      <div class="billing-card totals-card">
        <h3>${t('productionSummary')}</h3>
        <div class="billing-big-number accent">${fmt(totalEnergy)} <span class="unit">kWh</span></div>
        <div class="billing-sub">${t('lifetimeProduction')}</div>
        <div class="billing-row"><span>${t('yearlyAvg')}</span><span class="val">${yearlies.length > 0 ? fmt(totalEnergy / yearlies.length) : '—'} kWh</span></div>
        <div class="billing-row"><span>${t('thisYearLabel')}</span><span class="val green">${fmt(overview.yearlyEnergy)} kWh</span></div>
        <div class="billing-row"><span>${t('thisMonthLabel')}</span><span class="val">${fmt(overview.monthlyEnergy)} kWh</span></div>
        <div class="billing-row"><span>${t('todayLabel')}</span><span class="val">${fmt(overview.todayEnergy)} kWh</span></div>
      </div>
    </div>

    <div class="billing-controls">
      <div class="control-group">
        <label>${t('selfConsumption')}</label>
        <div class="slider-row">
          <input type="range" id="sc-slider" min="0" max="100" value="${billingParams.selfConsumption}" oninput="updateBilling()">
          <span id="sc-label" class="slider-val">${billingParams.selfConsumption}%</span>
        </div>
      </div>
      <div class="control-group">
        <label>${t('gridPrice')}</label>
        <input type="number" id="grid-price" class="billing-input" step="0.01" min="0" value="${billingParams.gridPrice}" onchange="updateBilling()">
      </div>
      <div class="control-group">
        <label>${t('sellPrice')}</label>
        <input type="number" id="sell-price" class="billing-input" step="0.01" min="0" value="${billingParams.sellPrice}" onchange="updateBilling()">
      </div>
    </div>

    <div class="billing-comparison">
      <div class="billing-scenario ${installBefore2022 ? 'scenario-active' : ''}">
        <div class="scenario-header">
          <h4>${t('netMetering')}</h4>
          <span class="scenario-badge ${installBefore2022 ? 'badge-active' : 'badge-inactive'}">${installBefore2022 ? t('yourSystem') : t('legacy')}</span>
        </div>
        <div class="billing-big-number accent">${fmt(nmTotalKwh)} <span class="unit">kWh</span></div>
        <div class="billing-sub">${t('equivEnergyBenefit')}</div>
        <div class="scenario-detail">
          <div class="billing-row"><span>${t('selfConsumed')}</span><span class="val">${fmt(selfKwh)} kWh</span></div>
          <div class="billing-row"><span>${t('exportedToGrid')}</span><span class="val">${fmt(exportKwh)} kWh</span></div>
          <div class="billing-row"><span>${t('credit', netMeteringRatio)}</span><span class="val green">${fmt(nmCredit)} kWh</span></div>
          <div class="billing-row total-row"><span>${t('totalValue')}</span><span class="val accent">${fmt(nmValuePLN)} PLN</span></div>
        </div>
      </div>

      <div class="billing-scenario ${!installBefore2022 ? 'scenario-active' : ''}">
        <div class="scenario-header">
          <h4>${t('netBilling')}</h4>
          <span class="scenario-badge ${!installBefore2022 ? 'badge-active' : 'badge-inactive'}">${!installBefore2022 ? t('yourSystem') : t('alternative')}</span>
        </div>
        <div class="billing-big-number blue">${fmt(nbTotalValue)} <span class="unit">PLN</span></div>
        <div class="billing-sub">${t('totalFinancialBenefit')}</div>
        <div class="scenario-detail">
          <div class="billing-row"><span>${t('selfConsumed')}</span><span class="val">${fmt(selfKwh)} kWh</span></div>
          <div class="billing-row"><span>${t('saved', fmt(billingParams.gridPrice))}</span><span class="val green">${fmt(nbSelfValue)} PLN</span></div>
          <div class="billing-row"><span>${t('exportedToGrid')}</span><span class="val">${fmt(exportKwh)} kWh</span></div>
          <div class="billing-row"><span>${t('sold', fmt(billingParams.sellPrice))}</span><span class="val">${fmt(nbExportValue)} PLN</span></div>
          <div class="billing-row total-row"><span>${t('totalValue')}</span><span class="val blue">${fmt(nbTotalValue)} PLN</span></div>
        </div>
      </div>
    </div>

    <div class="billing-card">
      <h3>${t('yearlyProduction')}</h3>
      <table class="billing-table">
        <tr><th>${t('year')}</th><th>kWh</th><th>${t('estValueOpusty')}</th><th>${t('estValueNetbilling')}</th></tr>
        ${yearlies.map(y => {
          const ySc = totalEnergy > 0 ? sc : 0;
          const yExport = y.energy * (1 - ySc);
          const yNm = (y.energy * ySc) + (yExport * netMeteringRatio);
          const yNb = (y.energy * ySc * billingParams.gridPrice) + (yExport * billingParams.sellPrice);
          return `<tr><td>${escHtml(y.year)}</td><td>${fmt(y.energy)}</td><td class="green">${fmt(yNm * billingParams.gridPrice)} PLN</td><td class="blue">${fmt(yNb)} PLN</td></tr>`;
        }).join('')}
        <tr class="total-row"><td><strong>${t('total')}</strong></td><td><strong>${fmt(totalEnergy)}</strong></td><td class="green"><strong>${fmt(nmTotalKwh * billingParams.gridPrice)} PLN</strong></td><td class="blue"><strong>${fmt(nbTotalValue)} PLN</strong></td></tr>
      </table>
    </div>
  `;
}

function updateBilling() {
  const scEl = document.getElementById('sc-slider');
  const gpEl = document.getElementById('grid-price');
  const spEl = document.getElementById('sell-price');
  if (scEl) billingParams.selfConsumption = parseInt(scEl.value);
  if (gpEl) billingParams.gridPrice = parseFloat(gpEl.value) || 0;
  if (spEl) billingParams.sellPrice = parseFloat(spEl.value) || 0;
  const label = document.getElementById('sc-label');
  if (label) label.textContent = billingParams.selfConsumption + '%';
  if (currentPlant) loadBillingTab(currentPlant.id);
}

function destroyCharts() {
  Object.keys(charts).forEach(k => { try { charts[k].destroy(); } catch {} });
  charts = {};
}

backBtn.addEventListener('click', () => {
  plantDetail.classList.add('hidden');
  plantsOverview.classList.remove('hidden');
  currentPlant = null;
  destroyCharts();
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    const target = document.getElementById(`tab-${tab.dataset.tab}`);
    if (target) target.classList.add('active');
    // Load billing data on tab click
    if (tab.dataset.tab === 'billing' && currentPlant) {
      loadBillingTab(currentPlant.id);
    }
  });
});

document.querySelector('#chart-period')?.addEventListener('click', e => {
  const btn = e.target.closest('.btn-sm');
  if (!btn || !currentPlant) return;
  document.querySelectorAll('#chart-period .btn-sm').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadChartData(btn.dataset.period, currentPlant.id);
});

function fmt(v) {
  if (v === undefined || v === null || v === '') return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return v;
  return n.toFixed(1);
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// === Device Settings ===
let currentDevice = null;

const SETTINGS_GROUPS = {
  grid: { title: t('gridParams'), keys: ['voltageHighLimit','voltageLowLimit','workingFrequencyMin','workingFrequencyMax','wideVoltageEnable'] },
  power: { title: t('powerSettings'), keys: ['activeRate','reactiveRate','pf','pfModel'] },
  system: { title: t('system'), keys: ['timezone','alias','onOff'] }
};

const SETTINGS_LABELS = {
  voltageHighLimit: t('voltageHighLimit'),
  voltageLowLimit: t('voltageLowLimit'),
  workingFrequencyMin: t('workingFrequencyMin'),
  workingFrequencyMax: t('workingFrequencyMax'),
  wideVoltageEnable: t('wideVoltageEnable'),
  activeRate: t('activeRate'),
  reactiveRate: t('reactiveRate'),
  pf: t('pf'),
  pfModel: t('pfModel'),
  timezone: t('timezone'),
  alias: t('alias'),
  onOff: t('onOff')
};

const SETTINGS_OPTIONS = {
  wideVoltageEnable: { 0: t('disabled'), 1: t('enabled') },
  onOff: { 0: t('off'), 1: t('on') },
  pfModel: { 0: t('fixedPF'), 1: t('pfCurve') }
};

function openDeviceSettings(type, sn) {
  currentDevice = { type, sn };
  const modal = document.getElementById('settings-modal');
  const title = document.getElementById('settings-title');
  title.textContent = t('deviceSettings', sn);
  modal.classList.remove('hidden');
  document.getElementById('settings-loading').classList.remove('hidden');
  document.getElementById('settings-form').classList.add('hidden');
  document.getElementById('settings-fields').innerHTML = '';
  loadDeviceSettings(type, sn);
}

function closeSettings() {
  currentDevice = null;
  document.getElementById('settings-modal').classList.add('hidden');
}

async function loadDeviceSettings(type, sn) {
  try {
    const data = await api(`/api/device/${type}/${sn}/settings`);
    renderDeviceSettings(data);
  } catch (err) {
    err._handled = true;
    document.getElementById('settings-loading').textContent = t('failedSettings') + err.message;
    document.getElementById('settings-loading').classList.remove('hidden');
  }
}

function renderDeviceSettings(settings) {
  document.getElementById('settings-loading').classList.add('hidden');
  const form = document.getElementById('settings-form');
  form.classList.remove('hidden');
  const container = document.getElementById('settings-fields');
  container.innerHTML = '';

  // Info section
  const infoKeys = ['sn','deviceModel','model','fwVersion','innerVersion','datalogSn','plantId','status','lost'];
  let html = `<div class="settings-group"><h4>${t('deviceInfo')}</h4>`;
  infoKeys.forEach(k => {
    if (settings[k] !== undefined) {
      html += `<div class="setting-info"><strong>${k}</strong><span class="val">${escHtml(String(settings[k]))}</span></div>`;
    }
  });
  html += '</div>';
  container.innerHTML = html;

  // Editable groups
  Object.keys(SETTINGS_GROUPS).forEach(groupKey => {
    const group = SETTINGS_GROUPS[groupKey];
    let groupHtml = `<div class="settings-group"><h4>${group.title}</h4>`;
    group.keys.forEach(k => {
      if (settings[k] !== undefined) {
        const val = String(settings[k]);
        const label = SETTINGS_LABELS[k] || k;
        const options = SETTINGS_OPTIONS[k];
        groupHtml += `<div class="setting-row">
          <span class="setting-label">${label}</span>`;
        if (options) {
          groupHtml += `<select class="setting-input" data-key="${k}">`;
          Object.entries(options).forEach(([optVal, optLabel]) => {
            groupHtml += `<option value="${optVal}"${val === optVal ? ' selected' : ''}>${optLabel}</option>`;
          });
          groupHtml += `</select>`;
        } else if (k === 'timezone') {
          groupHtml += `<select class="setting-input" data-key="${k}">`;
          for (let i = -12; i <= 13; i++) {
            const z = String(i);
            groupHtml += `<option value="${z}"${val === z ? ' selected' : ''}>UTC${i >= 0 ? '+' : ''}${i}</option>`;
          }
          groupHtml += `</select>`;
        } else {
          groupHtml += `<input type="text" class="setting-input" data-key="${k}" value="${escHtml(val)}">`;
        }
        groupHtml += `</div>`;
      }
    });
    groupHtml += '</div>';
    container.innerHTML += groupHtml;
  });

  form.onsubmit = saveDeviceSettings;
}

async function saveDeviceSettings(e) {
  e.preventDefault();
  if (!currentDevice) return;
  const btn = document.getElementById('save-settings-btn');
  btn.disabled = true;
  btn.textContent = t('saving');

  const values = {};
  document.querySelectorAll('#settings-form [data-key]').forEach(el => {
    values[el.dataset.key] = el.value;
  });

  try {
    await fetch(`/api/device/${currentDevice.type}/${currentDevice.sn}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parameter_id: 0, values })
    });
    const res = await fetch(`/api/device/${currentDevice.type}/${currentDevice.sn}/settings`, {
      headers: { 'Content-Type': 'application/json' }
    });
    const updated = await res.json();
    renderDeviceSettings(updated);
    showToast(t('settingsSaved'), 'success', 3000);
  } catch (err) {
    showToast(t('failedSave') + err.message, 'error', 6000);
  } finally {
    btn.disabled = false;
    btn.textContent = t('saveSettings');
  }
}
