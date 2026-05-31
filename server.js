/*
 * Copyright (C) 2026 ZMS
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
// Copyright by cdblue999@gmail.com, 2026
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const fs = require('fs');
const Growatt = require('growatt');

// === Process-level crash protection ===
process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err.message, err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason instanceof Error ? reason.message : reason);
});

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAPI_TOKEN = process.env.GROWATT_TOKEN;          // optional — no longer required
const ACCOUNT = process.env.GROWATT_ACCOUNT || '';
const API_BASE = 'https://openapi.growatt.com/v1';
const LEGACY_BASE = 'https://openapi.growatt.com';
const SESSION_SECRET = process.env.SESSION_SECRET || 'myGrowatt-session-' + Date.now();

// ──────────────────────────────────────────────
//  Utility
// ──────────────────────────────────────────────

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

// ──────────────────────────────────────────────
//  Growatt session helpers
// ──────────────────────────────────────────────

/**
 * Re-create a growatt client instance from the cookie stored in the Express
 * session.  Returns `null` when the user is not logged in to Growatt.
 */
function getGrowatt(req) {
  if (!req.session || !req.session.growattCookie) return null;
  const g = new Growatt({ timeout: 15000 });
  g.cookie = req.session.growattCookie;
  g.connected = true;
  return g;
}

/**
 * Normalise the plant list returned by growatt.getPlatList() so it matches
 * the shape the front-end expects (OpenAPI style).
 */
function normalisePlant(raw) {
  return {
    plant_id: raw.id,
    name: raw.plantName || raw.name || '',
    plantName: raw.plantName || raw.name || '',
    total_energy: raw.eTotal || raw.totalEnergy || 0,
    eTotal: raw.eTotal || raw.totalEnergy || 0,
    today_energy: raw.eToday || raw.todayEnergy || 0,
    eToday: raw.eToday || raw.todayEnergy || 0,
    peak_power: raw.peakPower || raw.nominalPower || 0,
    nominalPower: raw.peakPower || raw.nominalPower || 0,
    status: String(raw.status ?? '1'),
    city: raw.city || '',
    country: raw.country || '',
    create_date: raw.createDate || raw.creatDate || '',
  };
}

// ──────────────────────────────────────────────
//  Middleware stack
// ──────────────────────────────────────────────

app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json());

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

// Auth guard — public paths bypass, everything else needs an active session
const PUBLIC_PATHS = ['/login.html', '/api/auth/', '/health', '/css/', '/js/', '/favicon'];
app.use((req, res, next) => {
  if (PUBLIC_PATHS.some(p => req.path.startsWith(p) || req.path === p)) return next();
  if (req.session && req.session.user) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
  }
  res.redirect('/login.html');
});

// API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down', code: 'RATE_LIMIT' },
});
app.use('/api/', apiLimiter);

// ──────────────────────────────────────────────
//  Auth routes
// ──────────────────────────────────────────────

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { email, password, apiKey } = req.body;
  if (!email || !password) {
    throw new AppError('Email and password required', 400, 'INVALID_PARAM');
  }

  // 1. Authenticate against Growatt Server API (email + password)
  const growatt = new Growatt({ timeout: 15000 });
  await growatt.login(email, password);

  // 2. Store Growatt session cookie + optional OpenAPI token
  req.session.growattCookie = growatt.cookie;
  req.session.user = email;
  if (apiKey && typeof apiKey === 'string' && apiKey.trim()) {
    req.session.openApiToken = apiKey.trim();
  } else {
    req.session.openApiToken = null;
  }

  res.json({ success: true, email });
}));

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/auth/status', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ loggedIn: true, email: req.session.user, hasGrowattSession: !!req.session.growattCookie });
  }
  res.json({ loggedIn: false });
});

// === Linked Growatt accounts (multi-account comparison) ===
const LINKED_ACCOUNTS_FILE = path.join(__dirname, '.linked-accounts.json');

function loadLinkedAccounts() {
  try {
    if (fs.existsSync(LINKED_ACCOUNTS_FILE)) return JSON.parse(fs.readFileSync(LINKED_ACCOUNTS_FILE, 'utf8'));
  } catch (e) { console.warn('[accounts] read error:', e.message); }
  return [];
}
function saveLinkedAccounts(accounts) {
  try {
    fs.writeFileSync(LINKED_ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
  } catch (e) { console.warn('[accounts] write error:', e.message); }
}

app.get('/api/accounts/linked', (req, res) => {
  const list = loadLinkedAccounts().map(a => ({
    id: a.id,
    email: a.email,
    label: a.label,
    method: a.token ? 'token' : 'password',
  }));
  res.json(list);
});

app.post('/api/accounts/link', asyncHandler(async (req, res) => {
  const { email, password, token, label } = req.body;
  if (!email) throw new AppError('Email required', 400, 'INVALID_PARAM');
  if (!token && !password) throw new AppError('Password or API token required', 400, 'INVALID_PARAM');

  if (token) {
    // Verify token by fetching plants via OpenAPI
    const testHeaders = { token, 'User-Agent': 'myGrowatt/1.0' };
    const testRes = await fetch(API_BASE + '/plant/list', { headers: testHeaders });
    const testJson = await testRes.json();
    if (testJson.error_code !== 0) {
      throw new AppError('Invalid token: ' + (testJson.error_msg || 'API error'), 400, 'INVALID_TOKEN');
    }
  } else {
    // Verify password by attempting Server API login
    const g = new Growatt({ timeout: 15000 });
    try {
      await g.login(email, password);
    } catch {
      throw new AppError('Invalid Growatt credentials', 401, 'AUTH_FAILED');
    }
  }

  const accounts = loadLinkedAccounts();
  const id = 'ext_' + Date.now().toString(36);
  const entry = { id, email, label: label || email, createdAt: new Date().toISOString() };
  if (token) entry.token = token;
  accounts.push(entry);
  saveLinkedAccounts(accounts);

  res.json({ success: true, id, email, label: label || email });
}));

app.delete('/api/accounts/link/:id', asyncHandler(async (req, res) => {
  let accounts = loadLinkedAccounts();
  const idx = accounts.findIndex(a => a.id === req.params.id);
  if (idx === -1) throw new AppError('Account not found', 404, 'NOT_FOUND');
  accounts.splice(idx, 1);
  saveLinkedAccounts(accounts);
  res.json({ success: true });
}));

// Proxy: fetch plants from a linked account
app.get('/api/external/:accountId/plants', asyncHandler(async (req, res) => {
  const accounts = loadLinkedAccounts();
  const acct = accounts.find(a => a.id === req.params.accountId);
  if (!acct) throw new AppError('Linked account not found', 404, 'NOT_FOUND');

  if (acct.token) {
    const headers = { token: acct.token, 'User-Agent': 'myGrowatt/1.0' };
    const data = await (await fetch(API_BASE + '/plant/list', { headers })).json();
    if (data.error_code !== 0) throw new AppError(data.error_msg || 'API error', 502, String(data.error_code));
    return res.json({
      accountId: acct.id,
      email: acct.email,
      label: acct.label,
      plants: (data.data && data.data.plants) ? data.data.plants : [],
    });
  }

  // Password-based linked account — requires re-authentication
  throw new AppError('Password-based linked accounts require re-authentication', 400, 'PASSWORD_REAUTH_REQUIRED');
}));

// Proxy: fetch plant detail from a linked account
app.get('/api/external/:accountId/plant/:plantId', asyncHandler(async (req, res) => {
  const accounts = loadLinkedAccounts();
  const acct = accounts.find(a => a.id === req.params.accountId);
  if (!acct) throw new AppError('Linked account not found', 404, 'NOT_FOUND');
  if (!acct.token) throw new AppError('Detail retrieval requires token-based linked account', 400, 'TOKEN_REQUIRED');
  const headers = { token: acct.token, 'User-Agent': 'myGrowatt/1.0' };
  const plantId = req.params.plantId;
  const [details, overview, devices] = await Promise.all([
    (await fetch(API_BASE + '/plant/details?plant_id=' + plantId, { headers })).json(),
    (await fetch(API_BASE + '/plant/data?plant_id=' + plantId, { headers })).json(),
    (await fetch(API_BASE + '/device/list?plant_id=' + plantId + '&page=&perpage=', { headers })).json()
  ]);
  res.json({
    accountId: acct.id,
    email: acct.email,
    label: acct.label,
    details: details.error_code === 0 ? details.data : null,
    overview: overview.error_code === 0 ? overview.data : null,
    devices: devices.error_code === 0 ? (devices.data && devices.data.devices ? devices.data.devices : []) : []
  });
}));

// Proxy: fetch energy data from a linked account
app.get('/api/external/:accountId/plant/:plantId/energy/:period', asyncHandler(async (req, res) => {
  const accounts = loadLinkedAccounts();
  const acct = accounts.find(a => a.id === req.params.accountId);
  if (!acct) throw new AppError('Linked account not found', 404, 'NOT_FOUND');
  if (!acct.token) throw new AppError('Energy data requires token-based linked account', 400, 'TOKEN_REQUIRED');
  const headers = { token: acct.token, 'User-Agent': 'myGrowatt/1.0' };
  const plantId = req.params.plantId;
  const cfg = ENERGY_MAP[req.params.period];
  if (!cfg) throw new AppError('Invalid period', 400, 'INVALID_PARAM');
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - cfg.days);
  const url = API_BASE + '/plant/energy?plant_id=' + plantId + '&start_date=' + start.toISOString().slice(0, 10) + '&end_date=' + end.toISOString().slice(0, 10) + '&time_unit=' + cfg.time_unit + '&page=1&perpage=100';
  const data = await (await fetch(url, { headers })).json();
  res.json(data.error_code === 0 ? data.data : data);
}));

// Proxy: fetch power data from a linked account
app.get('/api/external/:accountId/plant/:plantId/power', asyncHandler(async (req, res) => {
  const accounts = loadLinkedAccounts();
  const acct = accounts.find(a => a.id === req.params.accountId);
  if (!acct) throw new AppError('Linked account not found', 404, 'NOT_FOUND');
  if (!acct.token) throw new AppError('Power data requires token-based linked account', 400, 'TOKEN_REQUIRED');
  const headers = { token: acct.token, 'User-Agent': 'myGrowatt/1.0' };
  const plantId = req.params.plantId;
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const data = await (await fetch(API_BASE + '/plant/power?plant_id=' + plantId + '&date=' + date, { headers })).json();
  res.json(data.error_code === 0 ? data.data : data);
}));

// ──────────────────────────────────────────────
//  Static files
// ──────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public')));

// ──────────────────────────────────────────────
//  OpenAPI helpers  (optional, used when a token is available)
// ──────────────────────────────────────────────

function resolveToken(req) {
  return req.session?.openApiToken || OPENAPI_TOKEN;
}

function apiHeaders(token) {
  return { token, 'User-Agent': 'myGrowatt/1.0' };
}

async function apiGet(token, endpoint, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = API_BASE + endpoint + (qs ? '?' + qs : '');
  const res = await fetch(url, { headers: apiHeaders(token) });
  const json = await res.json();
  if (json.error_code !== 0) {
    throw new AppError(json.error_msg || `API error ${json.error_code}`, 502, String(json.error_code));
  }
  return json.data;
}

async function apiPost(token, endpoint, data = {}) {
  const body = new URLSearchParams(data).toString();
  const url = API_BASE + endpoint;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...apiHeaders(token), 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json();
  if (json.error_code !== 0) {
    throw new AppError(json.error_msg || `API error ${json.error_code}`, 502, String(json.error_code));
  }
  return json.data;
}

async function legacyGet(token, endpoint, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = LEGACY_BASE + '/' + endpoint + (qs ? '?' + qs : '');
  const res = await fetch(url, { headers: apiHeaders(token) });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text, isHtml: text.trim().startsWith('<'), status: res.status }; }
}

async function legacyPost(token, endpoint, data = {}) {
  const body = new URLSearchParams(data).toString();
  const url = LEGACY_BASE + '/' + endpoint;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...apiHeaders(token), 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { html: text, status: res.status }; }
}

// Helper: extract embedded JSON from legacy HTML response
function extractEmbeddedJson(text, varName) {
  const re = new RegExp(varName + '=JSON\\.parse\\(\\\'((?:[^\'\\\\]|\\\\.)+)\\\'\\)');
  const match = text.match(re);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

// ──────────────────────────────────────────────
//  Input validation
// ──────────────────────────────────────────────

function validatePlantId(id) {
  if (!/^\d+$/.test(String(id))) throw new AppError('Invalid plant ID', 400, 'INVALID_PARAM');
  return id;
}

function validateDeviceSn(sn) {
  if (!/^[a-zA-Z0-9_-]+$/.test(String(sn))) throw new AppError('Invalid device serial number', 400, 'INVALID_PARAM');
  return sn;
}

// ──────────────────────────────────────────────
//  Data endpoints  (Server API via growatt package)
// ──────────────────────────────────────────────

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), tokenSet: !!OPENAPI_TOKEN });
});

// Account info
app.get('/api/account', asyncHandler(async (req, res) => {
  res.json({ name: req.session.user || ACCOUNT });
}));

// ─── Plant list ───────────────────────────────

app.get('/api/plants', asyncHandler(async (req, res) => {
  const g = getGrowatt(req);
  if (!g) throw new AppError('No Growatt session — re-login required', 401, 'GROWATT_SESSION_EXPIRED');

  const rawList = await g.getPlatList();
  if (!Array.isArray(rawList)) {
    // The package may wrap the array in an object
    const list = (rawList && rawList.obj) || rawList?.data || [];
    return res.json(Array.isArray(list) ? list.map(normalisePlant) : []);
  }
  res.json(rawList.map(normalisePlant));
}));

// ─── Plant detail ─────────────────────────────

app.get('/api/plant/:id', asyncHandler(async (req, res) => {
  const plantId = validatePlantId(req.params.id);
  const g = getGrowatt(req);
  if (!g) throw new AppError('No Growatt session', 401, 'GROWATT_SESSION_EXPIRED');

  // getPlantData returns { result: 1, obj: { ... } }
  const plantDataRaw = await g.getPlantData(plantId).catch(() => ({}));
  const plantData = plantDataRaw.obj || {};

  // getDevicesByPlant returns { result: 1, obj: { inverter: [...], ... } }
  const devicesRaw = await g.getDevicesByPlant(plantId).catch(() => ({}));
  const devicesObj = devicesRaw.obj || {};

  // Flatten devices from type-keyed object into list
  const devices = [];
  if (devicesObj) {
    for (const [type, list] of Object.entries(devicesObj)) {
      if (Array.isArray(list)) {
        list.forEach(dev => {
          if (Array.isArray(dev) && dev.length >= 2) {
            devices.push({
              type,
              device_sn: dev[0],
              model: dev[1] || '',
              status: 1,
              last_update_time: '',
              datalogger_sn: '',
            });
          }
        });
      }
    }
  }

  // Build a response that matches what the frontend expects
  const overview = {
    total_energy: plantData.eTotal || plantData.totalEnergy || 0,
    today_energy: plantData.eToday || plantData.todayEnergy || 0,
    monthly_energy: plantData.eMonth || plantData.monthEnergy || 0,
    yearly_energy: plantData.eYear || plantData.yearEnergy || 0,
    current_power: plantData.pac || plantData.currentPower || 0,
    carbon_offset: plantData.co2 || plantData.carbonOffset || 0,
    last_update_time: plantData.lastUpdateTime || '',
  };

  const details = {
    name: plantData.plantName || plantData.name || '',
    peak_power: plantData.peakPower || plantData.nominalPower || 0,
    installed_panel_area: plantData.installedPanelArea || '',
    installed_dc_capacity: plantData.installedDcCapacity || '',
    grid_type: plantData.gridType || '',
    timezone: plantData.timezone || '',
    address1: plantData.address1 || plantData.address || '',
    address2: plantData.address2 || '',
    city: plantData.city || '',
    country: plantData.country || '',
    create_date: plantData.createDate || plantData.creatDate || '',
  };

  res.json({ details, overview, devices });
}));

// ─── Energy data ──────────────────────────────

const ENERGY_MAP = {
  daily: { time_unit: 'day', days: 7 },
  monthly: { time_unit: 'month', days: 365 },
  yearly: { time_unit: 'year', days: 365 * 5 },
};

app.get('/api/plant/:id/energy/:period', asyncHandler(async (req, res) => {
  const plantId = validatePlantId(req.params.id);
  const cfg = ENERGY_MAP[req.params.period];
  if (!cfg) throw new AppError('Invalid period', 400, 'INVALID_PARAM');

  const token = resolveToken(req);

  // Prefer OpenAPI when a token is available (richer data)
  if (token) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - cfg.days);
    const data = await apiGet(token, '/plant/energy', {
      plant_id: plantId,
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      time_unit: cfg.time_unit,
      page: 1,
      perpage: 100,
    });
    return res.json(data);
  }

  // Fallback: growatt package — getPlantData returns current data, not history
  // Return a minimal response
  res.json({ energys: [] });
}));

// ─── Power data ───────────────────────────────

app.get('/api/plant/:id/power', asyncHandler(async (req, res) => {
  const plantId = validatePlantId(req.params.id);
  const token = resolveToken(req);

  if (token) {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const data = await apiGet(token, '/plant/power', { plant_id: plantId, date });
    return res.json(data);
  }

  res.json({ powers: [] });
}));

// ─── Billing calculation (Polish prosumer) ────

app.get('/api/plant/:id/billing', asyncHandler(async (req, res) => {
  const plantId = validatePlantId(req.params.id);
  const g = getGrowatt(req);
  if (!g) throw new AppError('No Growatt session', 401, 'GROWATT_SESSION_EXPIRED');

  const token = resolveToken(req);

  // Try OpenAPI first for the richest data set
  if (token) {
    const [details, overview, plantsList] = await Promise.all([
      apiGet(token, '/plant/details', { plant_id: plantId }).catch(() => ({})),
      apiGet(token, '/plant/data', { plant_id: plantId }),
      apiGet(token, '/plant/list').catch(() => ({ plants: [] })),
    ]);

    const plantMeta = (plantsList.plants || []).find(
      p => String(p.plant_id) === String(plantId) || String(p.id) === String(plantId)
    ) || {};
    const peakPower = parseFloat(plantMeta.peak_power || details.peak_power || 0);
    const createDate = plantMeta.create_date || details.create_date || '';
    const totalEnergy = parseFloat(overview.total_energy || 0);

    const energyRes = await apiGet(token, '/plant/energy', {
      plant_id: plantId,
      start_date: '2019-01-01',
      end_date: '2035-12-31',
      time_unit: 'year',
      page: 1,
      perpage: 100,
    }).catch(() => ({ energys: [] }));

    const yearlies = (energyRes.energys || []).map(e => ({
      year: String(e.date).substring(0, 4),
      energy: parseFloat(e.energy) || 0,
    }));

    const installDate = new Date(createDate || '2020-01-01');
    const cutoffDate = new Date('2022-04-01');
    const isNetMetering = installDate < cutoffDate;
    const netMeteringRatio = peakPower <= 10 ? 0.8 : 0.7;

    return res.json({
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
        lastUpdate: overview.last_update_time || '',
      },
      plantName: plantMeta.name || details.name || '',
    });
  }

  // Fallback: use growatt package data
  const plantDataRaw = await g.getPlantData(plantId).catch(() => ({}));
  const plantData = plantDataRaw.obj || {};
  const peakPower = parseFloat(plantData.nominalPower || plantData.peakPower || 0);
  const createDate = plantData.createDate || plantData.creatDate || '';
  const totalEnergy = parseFloat(plantData.eTotal || plantData.totalEnergy || 0);
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
    yearlies: [],
    overview: {
      todayEnergy: parseFloat(plantData.eToday || 0),
      monthlyEnergy: parseFloat(plantData.eMonth || 0),
      yearlyEnergy: parseFloat(plantData.eYear || 0),
      currentPower: parseFloat(plantData.pac || 0),
      lastUpdate: '',
    },
    plantName: plantData.plantName || '',
  });
}));

// ─── Devices ──────────────────────────────────

app.get('/api/plant/:id/devices', asyncHandler(async (req, res) => {
  const plantId = validatePlantId(req.params.id);
  const g = getGrowatt(req);
  if (!g) throw new AppError('No Growatt session', 401, 'GROWATT_SESSION_EXPIRED');

  const raw = await g.getDevicesByPlant(plantId).catch(() => ({}));
  const obj = raw.obj || {};
  const devices = [];
  for (const [type, list] of Object.entries(obj)) {
    if (Array.isArray(list)) {
      list.forEach(dev => {
        if (Array.isArray(dev) && dev.length >= 2) {
          devices.push({
            type,
            device_sn: dev[0],
            model: dev[1] || '',
            status: 1,
            last_update_time: '',
            datalogger_sn: '',
          });
        }
      });
    }
  }
  res.json(devices);
}));

// ─── Real-time device data ────────────────────

app.get('/api/device/:sn/real', asyncHandler(async (req, res) => {
  const sn = validateDeviceSn(req.params.sn);
  const token = resolveToken(req);

  if (token) {
    const data = await apiGet(token, '/device/inverter/inverter_last_data', { device_sn: sn });
    return res.json(data);
  }

  // Without an API token this data is unavailable via the Server API
  res.json({});
}));

// ─── Plant alarms ─────────────────────────────

app.get('/api/plant/:id/alarms', asyncHandler(async (req, res) => {
  const plantId = validatePlantId(req.params.id);
  const token = resolveToken(req);

  if (token) {
    try {
      const data = await apiGet(token, '/device/alarm/alarm_list', { plant_id: plantId, page: '1', perpage: '20' });
      return res.json(data);
    } catch (e) {
      try {
        const r = await legacyGet(token, 'newAlarmCenter.do', { op: 'getAlarmList', plantId, page: 1, perpage: 20 });
        return res.json(r);
      } catch {}
    }
  }

  res.json({ alarms: [], count: 0 });
}));

// ─── Weather ──────────────────────────────────

app.get('/api/plant/:id/weather', asyncHandler(async (req, res) => {
  const plantId = validatePlantId(req.params.id);
  const token = resolveToken(req);

  if (token) {
    try {
      const data = await apiGet(token, '/weather/weather/plant_weather', { plant_id: plantId });
      return res.json(data);
    } catch {}
  }

  res.json({ weather: [] });
}));

// ─── Device settings ──────────────────────────

app.get('/api/device/:type/:sn/settings', asyncHandler(async (req, res) => {
  const type = parseInt(req.params.type);
  const sn = validateDeviceSn(req.params.sn);
  const token = resolveToken(req);

  if (!token) throw new AppError('OpenAPI token required for device settings', 400, 'TOKEN_REQUIRED');

  if (type === 5) return res.json(await apiGet(token, '/device/mix/mix_data_info', { device_sn: sn }));
  if (type === 7) return res.json(await apiGet(token, '/device/tlx/tlx_set_info', { device_sn: sn }));

  const r = await legacyGet(token, 'commonDeviceSetC/setInverter', { type: 'server', invSn: sn });
  if (r.isHtml && r.raw) {
    const parsed = extractEmbeddedJson(r.raw, 'inv');
    if (parsed) return res.json(parsed);
  }
  res.json(r);
}));

app.post('/api/device/:type/:sn/settings', asyncHandler(async (req, res) => {
  const type = parseInt(req.params.type);
  const sn = validateDeviceSn(req.params.sn);
  const { parameter_id, values } = req.body;
  if (parameter_id === undefined || parameter_id === null) throw new AppError('parameter_id required', 400, 'MISSING_PARAM');

  const token = resolveToken(req);
  if (!token) throw new AppError('OpenAPI token required for device settings', 400, 'TOKEN_REQUIRED');

  if (type === 5) {
    const data = { mix_sn: sn, type: parameter_id };
    for (let i = 1; i <= 18; i++) data[`param${i}`] = (values && values[i]) || '';
    return res.json(await apiPost(token, '/mixSet', data));
  }
  if (type === 7) {
    const data = { tlx_sn: sn, type: parameter_id };
    for (let i = 1; i <= 19; i++) data[`param${i}`] = (values && values[i]) || '';
    return res.json(await apiPost(token, '/tlxSet', data));
  }
  const data = { op: 'inverterSet', serialNum: sn, paramId: parameter_id };
  if (values) {
    for (const [k, v] of Object.entries(values)) data[k] = String(v);
  }
  const result = await legacyPost(token, 'newTcpsetAPI.do', data);
  res.json(result);
}));

// ─── Device info ──────────────────────────────

app.get('/api/device/:type/:sn/info', asyncHandler(async (req, res) => {
  const type = parseInt(req.params.type);
  const sn = validateDeviceSn(req.params.sn);
  const token = resolveToken(req);

  if (!token) throw new AppError('OpenAPI token required for device info', 400, 'TOKEN_REQUIRED');

  if (type === 5) return res.json(await apiGet(token, '/device/mix/mix_data_info', { device_sn: sn }));
  if (type === 7) return res.json(await apiGet(token, '/device/tlx/tlx_data_info', { device_sn: sn }));

  const r = await legacyGet(token, 'commonDeviceSetC/setInverter', { type: 'server', invSn: sn });
  if (r.isHtml && r.raw) {
    const parsed = extractEmbeddedJson(r.raw, 'inv');
    if (parsed) return res.json(parsed);
  }
  res.json(r);
}));

// ─── Datalogger info ──────────────────────────

app.get('/api/device/:sn/datalogger', asyncHandler(async (req, res) => {
  const sn = validateDeviceSn(req.params.sn);
  const token = resolveToken(req);
  if (!token) throw new AppError('OpenAPI token required for datalogger', 400, 'TOKEN_REQUIRED');

  const r = await legacyGet(token, 'commonDeviceSetC/setDatalog', { type: 'server', datalogSn: sn });
  if (r.isHtml && r.raw) {
    const parsed = extractEmbeddedJson(r.raw, 'datalog');
    if (parsed) return res.json(parsed);
  }
  res.json(r);
}));

// ─── MIX endpoints ────────────────────────────

app.get('/api/plant/:id/mix/:sn/total', asyncHandler(async (req, res) => {
  const sn = validateDeviceSn(req.params.sn);
  const token = resolveToken(req);
  if (!token) return res.json({});

  const data = await apiPost(token, '/device/mix/mix_last_data', { mix_sn: sn });
  res.json(data);
}));

app.get('/api/plant/:id/mix/:sn/status', asyncHandler(async (req, res) => {
  const sn = validateDeviceSn(req.params.sn);
  const token = resolveToken(req);
  if (!token) return res.json({});

  const data = await apiPost(token, '/device/mix/mix_last_data', { mix_sn: sn });
  res.json(data);
}));

app.get('/api/plant/:id/mix/:sn/energy/:period', asyncHandler(async (req, res) => {
  const plantId = validatePlantId(req.params.id);
  const sn = validateDeviceSn(req.params.sn);
  const cfg = ENERGY_MAP[req.params.period];
  if (!cfg) throw new AppError('Invalid period', 400, 'INVALID_PARAM');
  const token = resolveToken(req);

  if (token) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - cfg.days);
    let data;
    try {
      data = await apiPost(token, '/device/mix/mix_data', {
        mix_sn: sn,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        page: 1,
        perpage: 100,
      });
    } catch {
      data = await apiGet(token, '/plant/energy', {
        plant_id: plantId,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        time_unit: cfg.time_unit,
        page: 1,
        perpage: 100,
      });
    }
    return res.json(data);
  }

  res.json({ energys: [] });
}));

app.get('/api/plant/:id/mix/:sn/battery/weekly', (req, res) => {
  res.json({ batteryList: [], week: [] });
});

// ──────────────────────────────────────────────
//  Misc
// ──────────────────────────────────────────────

app.post('/api/logout', (req, res) => {
  res.json({ success: true });
});

// ──────────────────────────────────────────────
//  Error handling
// ──────────────────────────────────────────────

app.use((err, req, res, next) => {
  const status = err.status || 502;
  const code = err.code || 'SERVER_ERROR';
  console.error(`[${code}] ${req.method} ${req.path}:`, err.message);
  res.status(status).json({ error: err.message, code });
});

// ──────────────────────────────────────────────
//  Start
// ──────────────────────────────────────────────

if (OPENAPI_TOKEN) {
  console.log('[info] GROWATT_TOKEN set — OpenAPI endpoints available');
} else {
  console.log('[info] GROWATT_TOKEN not set — only Server API (email+password) is used');
}

app.listen(PORT, () => {
  console.log(`myGrowatt running at http://localhost:${PORT}`);
});
