const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.GROWATT_TOKEN;
const ACCOUNT = process.env.GROWATT_ACCOUNT || '';
const API_BASE = 'https://openapi.growatt.com/v1';
const LEGACY_BASE = 'https://openapi.growatt.com';

class AppError extends Error {
  constructor(message, status = 502, code = 'API_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function apiHeaders() {
  return { token: TOKEN, 'User-Agent': 'myGrowatt/1.0' };
}

async function apiGet(endpoint, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = API_BASE + endpoint + (qs ? '?' + qs : '');
  console.log(`[api] GET ${url}`);
  const res = await fetch(url, { headers: apiHeaders() });
  const json = await res.json();
  if (json.error_code !== 0) {
    throw new AppError(json.error_msg || `API error ${json.error_code}`, 502, String(json.error_code));
  }
  return json.data;
}

async function apiPost(endpoint, data = {}) {
  const body = new URLSearchParams(data).toString();
  const url = API_BASE + endpoint;
  console.log(`[api] POST ${url}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...apiHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const json = await res.json();
  if (json.error_code !== 0) {
    throw new AppError(json.error_msg || `API error ${json.error_code}`, 502, String(json.error_code));
  }
  return json.data;
}

async function legacyPost(endpoint, data = {}) {
  const body = new URLSearchParams(data).toString();
  const url = LEGACY_BASE + '/' + endpoint;
  console.log(`[legacy] POST ${url}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...apiHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { html: text, status: res.status }; }
}

async function legacyGet(endpoint, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = LEGACY_BASE + '/' + endpoint + (qs ? '?' + qs : '');
  console.log(`[legacy] GET ${url}`);
  const res = await fetch(url, { headers: apiHeaders() });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text, isHtml: text.trim().startsWith('<'), status: res.status }; }
}

// Account info
app.get('/api/account', asyncHandler(async (req, res) => {
  res.json({ name: ACCOUNT });
}));

// Plant list
app.get('/api/plants', asyncHandler(async (req, res) => {
  const data = await apiGet('/plant/list');
  res.json(data.plants || []);
}));

// Plant detail
app.get('/api/plant/:id', asyncHandler(async (req, res) => {
  const [details, overview, devices] = await Promise.all([
    apiGet('/plant/details', { plant_id: req.params.id }),
    apiGet('/plant/data', { plant_id: req.params.id }),
    apiGet('/device/list', { plant_id: req.params.id, page: '', perpage: '' })
  ]);
  res.json({ details, overview, devices: devices.devices || [] });
}));

// Device list
app.get('/api/plant/:id/devices', asyncHandler(async (req, res) => {
  const data = await apiGet('/device/list', { plant_id: req.params.id, page: '', perpage: '' });
  res.json(data.devices || []);
}));

// MIX total data
app.get('/api/plant/:id/mix/:sn/total', asyncHandler(async (req, res) => {
  const data = await apiPost('/device/mix/mix_last_data', { mix_sn: req.params.sn });
  res.json(data);
}));

// MIX status (same endpoint, different mapping)
app.get('/api/plant/:id/mix/:sn/status', asyncHandler(async (req, res) => {
  const data = await apiPost('/device/mix/mix_last_data', { mix_sn: req.params.sn });
  res.json(data);
}));

// Energy charts (daily, monthly, yearly)
const ENERGY_MAP = {
  daily: { endpoint: '/plant/energy', time_unit: 'day', days: 7 },
  monthly: { endpoint: '/plant/energy', time_unit: 'month', days: 365 },
  yearly: { endpoint: '/plant/energy', time_unit: 'year', days: 365 * 5 }
};
app.get('/api/plant/:id/energy/:period', asyncHandler(async (req, res) => {
  const cfg = ENERGY_MAP[req.params.period];
  if (!cfg) throw new AppError('Invalid period', 400, 'INVALID_PARAM');
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - cfg.days);
  const data = await apiGet('/plant/energy', {
    plant_id: req.params.id,
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    time_unit: cfg.time_unit,
    page: 1,
    perpage: 100
  });
  res.json(data);
}));

// Plant power data for today
app.get('/api/plant/:id/power', asyncHandler(async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const data = await apiGet('/plant/power', { plant_id: req.params.id, date });
  res.json(data);
}));

// MIX energy history (delegated to plant energy)
app.get('/api/plant/:id/mix/:sn/energy/:period', asyncHandler(async (req, res) => {
  const cfg = ENERGY_MAP[req.params.period];
  if (!cfg) throw new AppError('Invalid period', 400, 'INVALID_PARAM');
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - cfg.days);
  let data;
  try {
    data = await apiPost('/device/mix/mix_data', {
      mix_sn: req.params.sn,
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      page: 1,
      perpage: 100
    });
  } catch {
    data = await apiGet('/plant/energy', {
      plant_id: req.params.id,
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      time_unit: cfg.time_unit,
      page: 1,
      perpage: 100
    });
  }
  res.json(data);
}));

// MIX battery weekly - not available for V1 inverter, return empty
app.get('/api/plant/:id/mix/:sn/battery/weekly', (req, res) => {
  res.json({ batteryList: [], week: [] });
});

// ============ DEVICE ADVANCED SETTINGS ============

// Helper: extract embedded JSON from legacy HTML response
function extractEmbeddedJson(text, varName) {
  const re = new RegExp(varName + '=JSON\\.parse\\(\\\'((?:[^\'\\\\]|\\\\.)+)\\\'\\)');
  const match = text.match(re);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

// Device info - type-specific
app.get('/api/device/:type/:sn/info', asyncHandler(async (req, res) => {
  const type = parseInt(req.params.type);
  const sn = req.params.sn;
  if (type === 5) {
    return res.json(await apiGet('/device/mix/mix_data_info', { device_sn: sn }));
  }
  if (type === 7) {
    return res.json(await apiGet('/device/tlx/tlx_data_info', { device_sn: sn }));
  }
  const r = await legacyGet('commonDeviceSetC/setInverter', { type: 'server', invSn: sn });
  if (r.isHtml && r.raw) {
    const parsed = extractEmbeddedJson(r.raw, 'inv');
    if (parsed) return res.json(parsed);
  }
  res.json(r);
}));

// Device settings
app.get('/api/device/:type/:sn/settings', asyncHandler(async (req, res) => {
  const type = parseInt(req.params.type);
  const sn = req.params.sn;
  if (type === 5) {
    return res.json(await apiGet('/device/mix/mix_data_info', { device_sn: sn }));
  }
  if (type === 7) {
    return res.json(await apiGet('/device/tlx/tlx_set_info', { device_sn: sn }));
  }
  const r = await legacyGet('commonDeviceSetC/setInverter', { type: 'server', invSn: sn });
  if (r.isHtml && r.raw) {
    const parsed = extractEmbeddedJson(r.raw, 'inv');
    if (parsed) return res.json(parsed);
  }
  res.json(r);
}));

// Write device parameter
app.post('/api/device/:type/:sn/settings', asyncHandler(async (req, res) => {
  const type = parseInt(req.params.type);
  const sn = req.params.sn;
  const { parameter_id, values } = req.body;
  if (!parameter_id) throw new AppError('parameter_id required', 400, 'MISSING_PARAM');

  if (type === 5) {
    const data = { mix_sn: sn, type: parameter_id };
    for (let i = 1; i <= 18; i++) data[`param${i}`] = (values && values[i]) || '';
    return res.json(await apiPost('/mixSet', data));
  }
  if (type === 7) {
    const data = { tlx_sn: sn, type: parameter_id };
    for (let i = 1; i <= 19; i++) data[`param${i}`] = (values && values[i]) || '';
    return res.json(await apiPost('/tlxSet', data));
  }
  const data = { op: 'inverterSet', serialNum: sn, type: parameter_id };
  if (values) {
    for (const [k, v] of Object.entries(values)) data[k] = String(v);
  }
  const result = await legacyPost('newTcpsetAPI.do', data);
  res.json(result);
}));

// Datalogger info
app.get('/api/device/:sn/datalogger', asyncHandler(async (req, res) => {
  const sn = req.params.sn;
  const r = await legacyGet('commonDeviceSetC/setDatalog', { type: 'server', datalogSn: sn });
  if (r.isHtml && r.raw) {
    const parsed = extractEmbeddedJson(r.raw, 'datalog');
    if (parsed) return res.json(parsed);
  }
  res.json(r);
}));

// Logout (no-op with token)
app.post('/api/logout', (req, res) => {
  res.json({ success: true });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const status = err.status || 502;
  const code = err.code || 'SERVER_ERROR';
  console.error(`[${code}] ${req.method} ${req.path}:`, err.message);
  res.status(status).json({ error: err.message, code });
});

if (!TOKEN) {
  console.error('FATAL: GROWATT_TOKEN environment variable is required');
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`myGrowatt running at http://localhost:${PORT}`);
});
