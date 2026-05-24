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
const accountName = $('account-name');
const toastContainer = $('toast-container');

function showLoading(msg = 'Loading...') {
  loadingText.textContent = msg;
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
    showToast(err.message || 'An unexpected error occurred');
  }
};
window.addEventListener('unhandledrejection', (e) => {
  globalOnError(e.reason);
});

loadAccount();
loadDashboard();

async function loadAccount() {
  try {
    const data = await api('/api/account');
    if (data.name) accountName.textContent = data.name;
  } catch {
    // Silently fail - account name is optional
  }
}

async function loadDashboard() {
  showLoading('Loading your plants...');
  try {
    const plants = await api('/api/plants');
    renderPlantCards(plants);
  } catch (err) {
    err._handled = true;
    showToast('Failed to load plants: ' + err.message, 'error', 8000);
    plantCards.innerHTML = `<div class="error-state">
      <div class="error-icon">
        <svg viewBox="0 0 24 24" width="48" height="48"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#f87171" opacity="0.6"/></svg>
      </div>
      <p>${escHtml(err.message)}</p>
      <button class="btn-sm" onclick="loadDashboard()">Retry</button>
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
  plantsCount.textContent = `${list.length} Plant${list.length !== 1 ? 's' : ''}`;

  let totalEnergy = 0;
  let onlineCount = 0;

  list.forEach((p, i) => {
    const id = p.plant_id || p.id;
    const name = p.name || p.plantName || `Plant ${id}`;
    const energy = parseFloat(p.total_energy || p.eTotal || 0);
    if (!isNaN(energy)) totalEnergy += energy;

    const isOnline = String(p.status) === '1' || String(p.status) === 'online' || String(p.status) === '0';
    if (isOnline) onlineCount++;

    const statusText = isOnline ? 'Online' : 'Offline';
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
          <div class="label">Total kWh</div>
        </div>
        <div class="plant-stat">
          <div class="value ${p.today_energy ? 'green' : ''}">${fmt(p.today_energy || p.eToday || '—')}</div>
          <div class="label">Today kWh</div>
        </div>
        <div class="plant-stat">
          <div class="value blue">${fmt(p.peak_power || p.nominalPower || '—')}</div>
          <div class="label">Peak Power (kW)</div>
        </div>
        <div class="plant-stat">
          <div class="value purple">${p.city || p.country || '—'}</div>
          <div class="label">Location</div>
        </div>
      </div>
    `;
    card.addEventListener('click', () => loadPlantDetail(id));
    plantCards.appendChild(card);
  });

  summaryStats.innerHTML = `
    <div class="summary-stat"><span class="value">${list.length}</span><span class="label">Plants</span></div>
    <div class="summary-stat"><span class="value">${onlineCount}</span><span class="label">Online</span></div>
    <div class="summary-stat"><span class="value accent">${fmt(totalEnergy)}</span><span class="label">Total kWh</span></div>
  `;
}

async function loadPlantDetail(plantId) {
  showLoading('Loading plant details...');
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
    showToast('Failed to load plant details: ' + err.message, 'error', 8000);
    plantDetailHeader.innerHTML = `<div class="error-state"><p>${escHtml(err.message)}</p><button class="btn-sm" onclick="loadPlantDetail('${plantId}')">Retry</button></div>`;
  } finally {
    hideLoading();
  }
}

function renderPlantHeader(details, overview) {
  plantDetailHeader.innerHTML = '';
  const metrics = [
    { label: 'Name', value: details.name || '—', cls: '' },
    { label: 'Total Energy', value: `${fmt(overview.total_energy)} kWh`, cls: 'accent' },
    { label: 'Today', value: `${fmt(overview.today_energy)} kWh`, cls: 'green' },
    { label: 'Current Power', value: `${fmt(overview.current_power * 1000)} W`, cls: 'blue' },
    { label: 'Monthly', value: `${fmt(overview.monthly_energy)} kWh`, cls: 'accent' },
    { label: 'Yearly', value: `${fmt(overview.yearly_energy)} kWh`, cls: 'green' },
    { label: 'Peak Power', value: `${fmt(details.peak_power)} kW`, cls: '' },
    { label: 'Location', value: [details.city, details.country].filter(Boolean).join(', ') || '—', cls: '' }
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
    <h3>Plant Overview</h3>
    <div class="info-row"><span>Peak Power</span><span class="val">${fmt(details.peak_power)} kW</span></div>
    <div class="info-row"><span>Installed Area</span><span class="val">${details.installed_panel_area || details.installed_dc_capacity || '—'}</span></div>
    <div class="info-row"><span>Grid Type</span><span class="val">${details.grid_type || '—'}</span></div>
    <div class="info-row"><span>Timezone</span><span class="val">${details.timezone || '—'}</span></div>
    <div class="info-row"><span>Address</span><span class="val">${[details.address1, details.address2, details.city].filter(Boolean).join(', ') || '—'}</span></div>
    <div class="info-row"><span>Country</span><span class="val">${details.country || '—'}</span></div>
    <div class="info-row"><span>Created</span><span class="val">${details.create_date || '—'}</span></div>
  `;
  ov.appendChild(plantCard);

  const energyCard = document.createElement('div');
  energyCard.className = 'info-card';
  energyCard.innerHTML = `
    <h3>Energy Summary</h3>
    <div class="info-row"><span>Total Energy</span><span class="val accent">${fmt(overview.total_energy)} kWh</span></div>
    <div class="info-row"><span>Today</span><span class="val green">${fmt(overview.today_energy)} kWh</span></div>
    <div class="info-row"><span>This Month</span><span class="val">${fmt(overview.monthly_energy)} kWh</span></div>
    <div class="info-row"><span>This Year</span><span class="val">${fmt(overview.yearly_energy)} kWh</span></div>
    <div class="info-row"><span>Current Power</span><span class="val blue">${fmt(overview.current_power * 1000)} W</span></div>
    <div class="info-row"><span>CO₂ Saved</span><span class="val green">${fmt(overview.carbon_offset)} kg</span></div>
    <div class="info-row"><span>Last Update</span><span class="val">${overview.last_update_time || '—'}</span></div>
  `;
  ov.appendChild(energyCard);

  if (devices && devices.length > 0) {
    const deviceCard = document.createElement('div');
    deviceCard.className = 'info-card';
    deviceCard.innerHTML = `
      <h3>Devices</h3>
      ${devices.map(d => `
        <div class="info-row">
          <div class="device-clickable" onclick="openDeviceSettings('${d.type}','${d.device_sn}')">
            <span>${escHtml(d.model || 'Inverter')}</span>
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
    showToast('Chart data unavailable: ' + err.message, 'warning', 5000);
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
          label: 'Energy (kWh)',
          data: values,
          backgroundColor: '#f5c842',
          borderRadius: 4
        }]
      },
      options: {
        ...commonOpts,
        plugins: {
          ...commonOpts.plugins,
          title: { display: true, text: `Energy — ${period}`, color: '#e8edf5', font: { size: 13 } }
        }
      }
    });
  } else if (energyEl) {
    energyEl.parentElement.innerHTML = '<div style="padding:40px;text-align:center;color:#5a6577;">No energy data for this period</div><canvas id="chart-energy" style="display:none"></canvas>';
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
      if (el) el.parentElement.innerHTML = '<div style="padding:40px;text-align:center;color:#5a6577;">No power data for today</div><canvas id="chart-power" style="display:none"></canvas>';
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
          label: 'Power (W)',
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
          title: { display: true, text: 'Power — Today (5-min intervals)', color: '#e8edf5', font: { size: 13 } }
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
    grid.innerHTML = '<p class="empty-state">No devices found for this plant.</p>';
    return;
  }
  grid.innerHTML = '';
  devices.forEach(d => {
    const card = document.createElement('div');
    card.className = 'device-card';
    card.innerHTML = `
      <div class="device-card-header">
        <span class="device-model">${escHtml(d.model || 'Inverter')}</span>
        <span class="device-status ${d.status === 1 ? 'status-online' : 'status-offline'}">${d.status === 1 ? 'Online' : 'Offline'}</span>
      </div>
      <div class="device-meta">
        <div class="info-row"><span>SN</span><span class="val mono">${escHtml(d.device_sn)}</span></div>
        <div class="info-row"><span>Type</span><span class="val">${d.type || '—'}</span></div>
        <div class="info-row"><span>Datalogger</span><span class="val mono">${escHtml(d.datalogger_sn || '—')}</span></div>
        <div class="info-row"><span>Last Update</span><span class="val">${d.last_update_time || '—'}</span></div>
      </div>
      <div id="device-real-${d.device_sn}" class="device-real">
        <div class="device-real-loading">Loading data...</div>
      </div>
      <button class="device-settings-btn" onclick="openDeviceSettings('${d.type}','${d.device_sn}')">
        ⚙ Settings
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
      { label: 'Power', key: 'power', unit: 'W' },
      { label: 'Energy Today', key: 'eToday', unit: 'kWh' },
      { label: 'Energy Total', key: 'eTotal', unit: 'kWh' },
      { label: 'VAC1', key: 'vac1', unit: 'V' },
      { label: 'IAC1', key: 'iac1', unit: 'A' },
      { label: 'Frequency', key: 'fac1', unit: 'Hz' },
      { label: 'Temperature', key: 'temperature', unit: '°C' },
      { label: 'VPV1', key: 'vpv1', unit: 'V' }
    ];
    const has = fields.some(f => data[f.key] !== undefined);
    if (has) {
      el.innerHTML = `<div class="device-real-grid">${fields.filter(f => data[f.key] !== undefined).map(f =>
        `<div class="device-real-stat"><span class="lbl">${f.label}</span><span class="val">${fmt(data[f.key])} ${f.unit}</span></div>`
      ).join('')}</div>`;
    } else {
      el.innerHTML = '<div class="device-real-loading">Real-time data unavailable via API</div>';
    }
  } catch {
    el.innerHTML = '<div class="device-real-loading">Real-time data unavailable via API</div>';
  }
}
  const bc = $('tab-battery');
  bc.innerHTML = '<p class="empty-state">Battery data is only available for MIX/SPH hybrid inverter systems.</p>';
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
  grid: { title: 'Grid Parameters', keys: ['voltageHighLimit','voltageLowLimit','workingFrequencyMin','workingFrequencyMax','wideVoltageEnable'] },
  power: { title: 'Power Settings', keys: ['activeRate','reactiveRate','pf','pfModel'] },
  system: { title: 'System', keys: ['timezone','alias','onOff'] }
};

const SETTINGS_LABELS = {
  voltageHighLimit: 'Voltage High Limit (V)',
  voltageLowLimit: 'Voltage Low Limit (V)',
  workingFrequencyMin: 'Freq Min (Hz)',
  workingFrequencyMax: 'Freq Max (Hz)',
  wideVoltageEnable: 'Wide Voltage',
  activeRate: 'Active Rate (%)',
  reactiveRate: 'Reactive Rate (%)',
  pf: 'Power Factor',
  pfModel: 'PF Model',
  timezone: 'Timezone',
  alias: 'Alias',
  onOff: 'On/Off'
};

const SETTINGS_OPTIONS = {
  wideVoltageEnable: { 0: 'Disabled', 1: 'Enabled' },
  onOff: { 0: 'Off', 1: 'On' },
  pfModel: { 0: 'Fixed PF', 1: 'PF Curve' }
};

function openDeviceSettings(type, sn) {
  currentDevice = { type, sn };
  const modal = document.getElementById('settings-modal');
  const title = document.getElementById('settings-title');
  title.textContent = `Device Settings — ${sn}`;
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
    document.getElementById('settings-loading').textContent = 'Failed to load settings: ' + err.message;
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
  let html = '<div class="settings-group"><h4>Device Info</h4>';
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
  btn.textContent = 'Saving...';

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
    showToast('Settings saved successfully', 'success', 3000);
  } catch (err) {
    showToast('Failed to save: ' + err.message, 'error', 6000);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Settings';
  }
}
