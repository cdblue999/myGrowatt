// Copyright by cdblue999@gmail.com, 2026
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');

// === Process-level crash protection ===
process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err.message, err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason instanceof Error ? reason.message : reason);
});

const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.GROWATT_TOKEN;
const ACCOUNT = process.env.GROWATT_ACCOUNT || '';
const API_BASE = 'https://openapi.growatt.com/v1';
const LEGACY_BASE = 'https://openapi.growatt.com';
const SESSION_SECRET = process.env.SESSION_SECRET || 'myGrowatt-session-' + Date.now();
const USERS_FILE = path.join(__dirname, '.users.json');

// === User store ===
function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
  } catch (e) { console.warn('[auth] cannot read users file:', e.message); }
  return {};
}

function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (e) { console.warn('[auth] cannot save users file:', e.message); }
}

// Pre-create user entries
let users = loadUsers();
let userDirty = false;
['emsolar355@gmail.com', 'zsolarewicz@gmail.com'].forEach(email => {
  if (!users[email]) {
    users[email] = { password: null, createdAt: new Date().toISOString() };
    userDirty = true;
  }
});
if (userDirty) saveUsers(users);

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

// === Security & infrastructure middleware ===
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json());

// === Session ===
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
}));

// === Auth middleware ===
const PUBLIC_PATHS = ['/login.html', '/api/auth/', '/health', '/css/', '/js/', '/favicon'];
app.use((req, res, next) => {
  // Always allow public paths
  if (PUBLIC_PATHS.some(p => req.path.startsWith(p) || req.path === p)) return next();
  // Logged-in users pass through
  if (req.session && req.session.user) return next();
  // API calls get 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
  }
  // Everything else redirects to login
  res.redirect('/login.html');
});

// API rate limiter — 30 requests per 15 min per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down', code: 'RATE_LIMIT' }
});
app.use('/api/', apiLimiter);

// === Auth routes ===
app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email) throw new AppError('Email required', 400, 'INVALID_PARAM');

  users = loadUsers();
  const user = users[email];
  if (!user) throw new AppError('User not found', 401, 'AUTH_FAILED');

  if (!user.password) {
    // No password set yet — tell frontend to show setup form
    return res.json({ needSetup: true, email });
  }

  if (!password) return res.json({ needPassword: true, email });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new AppError('Invalid password', 401, 'AUTH_FAILED');

  req.session.user = email;
  res.json({ success: true, email });
}));

app.post('/api/auth/setup', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError('Email and password required', 400, 'INVALID_PARAM');
  if (password.length < 6) throw new AppError('Password must be at least 6 characters', 400, 'INVALID_PARAM');

  users = loadUsers();
  const user = users[email];
  if (!user) throw new AppError('User not found', 401, 'AUTH_FAILED');
  if (user.password) throw new AppError('Password already set', 400, 'ALREADY_SETUP');

  user.password = await bcrypt.hash(password, 10);
  saveUsers(users);

  req.session.user = email;
  res.json({ success: true, email });
}));

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/auth/status', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ loggedIn: true, email: req.session.user });
  }
  res.json({ loggedIn: false });
});

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

// === Input validation helpers ===
function validatePlantId(id) {
  if (!/^\d+$/.test(String(id))) throw new AppError('Invalid plant ID', 400, 'INVALID_PARAM');
  return id;
}
function validateDeviceSn(sn) {
  if (!/^[a-zA-Z0-9_-]+$/.test(String(sn))) throw new AppError('Invalid device serial number', 400, 'INVALID_PARAM');
  return sn;
}

// Health check for platform monitoring
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), tokenSet: !!TOKEN });
});

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
  const plantId = validatePlantId(req.params.id);
  const [details, overview, devices] = await Promise.all([
    apiGet('/plant/details', { plant_id: plantId }),
    apiGet('/plant/data', { plant_id: plantId }),
    apiGet('/device/list', { plant_id: plantId, page: '', perpage: '' })
  ]);
  res.json({ details, overview, devices: devices.devices || [] });
}));

// Device list
app.get('/api/plant/:id/devices', asyncHandler(async (req, res) => {
  const plantId = validatePlantId(req.params.id);
  const data = await apiGet('/device/list', { plant_id: plantId, page: '', perpage: '' });
  res.json(data.devices || []);
}));

// MIX total data
app.get('/api/plant/:id/mix/:sn/total', asyncHandler(async (req, res) => {
  const sn = validateDeviceSn(req.params.sn);
  const data = await apiPost('/device/mix/mix_last_data', { mix_sn: sn });
  res.json(data);
}));

// MIX status (same endpoint, different mapping)
app.get('/api/plant/:id/mix/:sn/status', asyncHandler(async (req, res) => {
  const sn = validateDeviceSn(req.params.sn);
  const data = await apiPost('/device/mix/mix_last_data', { mix_sn: sn });
  res.json(data);
}));

// Energy charts (daily, monthly, yearly)
const ENERGY_MAP = {
  daily: { endpoint: '/plant/energy', time_unit: 'day', days: 7 },
  monthly: { endpoint: '/plant/energy', time_unit: 'month', days: 365 },
  yearly: { endpoint: '/plant/energy', time_unit: 'year', days: 365 * 5 }
};
app.get('/api/plant/:id/energy/:period', asyncHandler(async (req, res) => {
  const plantId = validatePlantId(req.params.id);
  const cfg = ENERGY_MAP[req.params.period];
  if (!cfg) throw new AppError('Invalid period', 400, 'INVALID_PARAM');
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - cfg.days);
  const data = await apiGet('/plant/energy', {
    plant_id: plantId,
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
  const plantId = validatePlantId(req.params.id);
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const data = await apiGet('/plant/power', { plant_id: plantId, date });
  res.json(data);
}));

// Billing calculation (Polish prosumer)
app.get('/api/plant/:id/billing', asyncHandler(async (req, res) => {
  const plantId = validatePlantId(req.params.id);

  const [details, overview, plantsList] = await Promise.all([
    apiGet('/plant/details', { plant_id: plantId }).catch(e => { console.warn('[warn] plant/details failed:', e.message); return {}; }),
    apiGet('/plant/data', { plant_id: plantId }),
    apiGet('/plant/list').catch(e => { console.warn('[warn] plant/list failed:', e.message); return { plants: [] }; })
  ]);

  const plantMeta = (plantsList.plants || []).find(p => String(p.plant_id) === String(plantId) || String(p.id) === String(plantId)) || {};
  const peakPower = parseFloat(plantMeta.peak_power || details.peak_power || 0);
  const createDate = plantMeta.create_date || details.create_date || '';
  const totalEnergy = parseFloat(overview.total_energy || 0);

  const end = new Date();
  const start = new Date('2019-01-01');
  const energyRes = await apiGet('/plant/energy', {
    plant_id: plantId,
    start_date: start.toISOString().slice(0, 10),
    end_date: '2035-12-31',
    time_unit: 'year',
    page: 1,
    perpage: 100
  }).catch(e => { console.warn('[warn] plant/energy failed:', e.message); return { energys: [] }; });

  const yearlies = (energyRes.energys || []).map(e => ({
    year: String(e.date).substring(0, 4),
    energy: parseFloat(e.energy) || 0
  }));

  const installDate = new Date(createDate || '2020-01-01');
  const cutoffDate = new Date('2022-04-01');
  const isNetMetering = installDate < cutoffDate;
  const netMeteringRatio = peakPower <= 10 ? 0.8 : 0.7;

  res.json({
    peakPower,
    createDate,
    totalEnergy,
    installBefore2022: isNetMetering,
    netMeteringRatio,
    yearlies,
    overview: {
      todayEnergy: parseFloat(overview.today_energy || 0),
      monthlyEnergy: parseFloat(overview.monthly_energy || 0),
      yearlyEnergy: parseFloat(overview.yearly_energy || 0),
      currentPower: parseFloat(overview.current_power || 0),
      lastUpdate: overview.last_update_time || ''
    },
    plantName: plantMeta.name || details.name || ''
  });
}));

// MIX energy history (delegated to plant energy)
app.get('/api/plant/:id/mix/:sn/energy/:period', asyncHandler(async (req, res) => {
  const plantId = validatePlantId(req.params.id);
  const sn = validateDeviceSn(req.params.sn);
  const cfg = ENERGY_MAP[req.params.period];
  if (!cfg) throw new AppError('Invalid period', 400, 'INVALID_PARAM');
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - cfg.days);
  let data;
  try {
    data = await apiPost('/device/mix/mix_data', {
      mix_sn: sn,
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      page: 1,
      perpage: 100
    });
  } catch {
    data = await apiGet('/plant/energy', {
      plant_id: plantId,
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

// ============ REAL-TIME DEVICE DATA ============
app.get('/api/device/:sn/real', asyncHandler(async (req, res) => {
  const sn = validateDeviceSn(req.params.sn);
  const data = await apiGet('/device/inverter/inverter_last_data', { device_sn: sn });
  res.json(data);
}));

// ============ PLANT ALARMS ============
app.get('/api/plant/:id/alarms', asyncHandler(async (req, res) => {
  const plantId = validatePlantId(req.params.id);
  try {
    const data = await apiGet('/device/alarm/alarm_list', {
      plant_id: plantId,
      page: '1',
      perpage: '20'
    });
    res.json(data);
  } catch (e) {
    console.warn('[warn] alarm_list api failed:', e.message);
    try {
      const r = await legacyGet('newAlarmCenter.do', { op: 'getAlarmList', plantId: plantId, page: 1, perpage: 20 });
      res.json(r);
    } catch (e2) {
      console.warn('[warn] alarm_list legacy fallback failed:', e2.message);
      res.json({ alarms: [], count: 0 });
    }
  }
}));

// ============ PLANT WEATHER ============
app.get('/api/plant/:id/weather', asyncHandler(async (req, res) => {
  const plantId = validatePlantId(req.params.id);
  try {
    const data = await apiGet('/weather/weather/plant_weather', { plant_id: plantId });
    res.json(data);
  } catch (e) {
    console.warn('[warn] weather failed:', e.message);
    res.json({ weather: [] });
  }
}));

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
  const sn = validateDeviceSn(req.params.sn);
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
  const sn = validateDeviceSn(req.params.sn);
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
  const sn = validateDeviceSn(req.params.sn);
  const { parameter_id, values } = req.body;
  if (parameter_id === undefined || parameter_id === null) throw new AppError('parameter_id required', 400, 'MISSING_PARAM');

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
  const data = { op: 'inverterSet', serialNum: sn, paramId: parameter_id };
  if (values) {
    for (const [k, v] of Object.entries(values)) data[k] = String(v);
  }
  const result = await legacyPost('newTcpsetAPI.do', data);
  res.json(result);
}));

// Datalogger info
app.get('/api/device/:sn/datalogger', asyncHandler(async (req, res) => {
  const sn = validateDeviceSn(req.params.sn);
  const r = await legacyGet('commonDeviceSetC/setDatalog', { type: 'server', datalogSn: sn });
  if (r.isHtml && r.raw) {
    const parsed = extractEmbeddedJson(r.raw, 'datalog');
    if (parsed) return res.json(parsed);
  }
  res.json(r);
}));

// Logout (no-op with token - session logout is handled by /api/auth/logout)
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
