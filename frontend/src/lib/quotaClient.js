const STORAGE_KEYS = {
  deviceId: "nta_device_id_v1",
  proCode: "nta_pro_code_v1",
  snapshot: "nta_quota_snapshot_v1",
};

const DEFAULT_LIMIT = 3;

function getApiBase() {
  return (process.env.REACT_APP_QUOTA_API_URL || "").replace(/\/+$/, "");
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStorage(key) {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch (_e) {
    return null;
  }
}

function writeStorage(key, value) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch (_e) {
    // ignore storage failures (private mode, locked storage, etc.)
  }
}

function removeStorage(key) {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch (_e) {
    // ignore
  }
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function safeJsonParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

function fallbackUuid() {
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normaliseCode(code) {
  return (code || "").trim().toUpperCase();
}

function normaliseStatus(payload = {}) {
  const usedToday = Number.isFinite(payload.usedToday) ? payload.usedToday : 0;
  const quotaDaily = payload.quotaDaily === null
    ? null
    : Number.isFinite(payload.quotaDaily) ? payload.quotaDaily : DEFAULT_LIMIT;
  const remaining = quotaDaily === null
    ? null
    : Number.isFinite(payload.remaining) ? payload.remaining : Math.max(0, quotaDaily - usedToday);
  return {
    allowed: payload.allowed !== false,
    tier: payload.tier || "free",
    quotaDaily,
    usedToday,
    remaining,
    resetAt: payload.resetAt || null,
    dateBucket: payload.dateBucket || todayUtc(),
    proCodeAccepted: !!payload.proCodeAccepted,
    source: payload.source || "remote",
  };
}

export function quotaIsEnabled() {
  return !!getApiBase();
}

export function getOrCreateDeviceId() {
  const existing = readStorage(STORAGE_KEYS.deviceId);
  if (existing) return existing;
  const next = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : fallbackUuid();
  writeStorage(STORAGE_KEYS.deviceId, next);
  return next;
}

export function getSavedProCode() {
  return normaliseCode(readStorage(STORAGE_KEYS.proCode) || "");
}

export function persistProCode(code) {
  const clean = normaliseCode(code);
  if (!clean) {
    removeStorage(STORAGE_KEYS.proCode);
    return "";
  }
  writeStorage(STORAGE_KEYS.proCode, clean);
  return clean;
}

export function getCachedQuotaStatus() {
  const snapshot = safeJsonParse(readStorage(STORAGE_KEYS.snapshot));
  if (!snapshot || snapshot.dateBucket !== todayUtc()) return null;
  return normaliseStatus({ ...snapshot, source: "device-cache" });
}

function cacheQuotaStatus(status) {
  writeStorage(STORAGE_KEYS.snapshot, JSON.stringify(status));
}

async function postJson(path, payload) {
  const base = getApiBase();
  if (!base) {
    return {
      ok: true,
      json: {
        allowed: true,
        tier: "local-only",
        quotaDaily: null,
        usedToday: 0,
        remaining: null,
        dateBucket: todayUtc(),
        source: "bypass",
      },
    };
  }

  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

export async function refreshQuotaStatus(proCode) {
  const cleanCode = normaliseCode(proCode);
  const cached = getCachedQuotaStatus();
  try {
    const result = await postJson("/v1/quota/status", {
      proCode: cleanCode || null,
      deviceId: getOrCreateDeviceId(),
    });
    if (!result.ok) {
      throw new Error(result.json?.error || `HTTP_${result.status}`);
    }
    const status = normaliseStatus(result.json);
    cacheQuotaStatus(status);
    return status;
  } catch (_e) {
    if (cached) return cached;
    return normaliseStatus({
      allowed: false,
      tier: "unknown",
      quotaDaily: DEFAULT_LIMIT,
      usedToday: 0,
      remaining: 0,
      source: "offline",
    });
  }
}

export async function claimQuota({ proCode, units = 1 }) {
  const cleanCode = normaliseCode(proCode);
  const result = await postJson("/v1/quota/claim", {
    proCode: cleanCode || null,
    units,
    deviceId: getOrCreateDeviceId(),
  });

  if (!result.ok) {
    const fallback = normaliseStatus({
      allowed: false,
      tier: "unknown",
      quotaDaily: DEFAULT_LIMIT,
      usedToday: 0,
      remaining: 0,
      source: "error",
    });
    cacheQuotaStatus(fallback);
    return fallback;
  }

  const status = normaliseStatus(result.json);
  cacheQuotaStatus(status);
  return status;
}
