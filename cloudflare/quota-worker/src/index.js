const DEFAULT_FREE_DAILY_LIMIT = 3;
const MAX_UNITS_PER_CLAIM = 20;

function json(data, status = 200) {
  return Response.json(data, { status });
}

function getAllowedOrigin(request, env) {
  const configured = (env.ALLOWED_ORIGINS || "").trim();
  if (!configured) return "*";
  const requestOrigin = request.headers.get("Origin") || "";
  const allowed = configured.split(",").map((v) => v.trim()).filter(Boolean);
  if (allowed.includes(requestOrigin)) return requestOrigin;
  return allowed[0] || "*";
}

function addCors(response, request, env) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", getAllowedOrigin(request, env));
  headers.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token");
  headers.set("Access-Control-Max-Age", "86400");
  headers.append("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function toIsoResetAt(now = new Date()) {
  const nextMidnightUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return new Date(nextMidnightUtc).toISOString();
}

function secondsUntilNextMidnightUtc(now = new Date()) {
  const nextMidnightUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  const deltaSec = Math.ceil((nextMidnightUtc - now.getTime()) / 1000);
  // Keep usage keys alive slightly past midnight for cleanup tolerance.
  return Math.max(120, deltaSec + 1800);
}

function dateBucket(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function normalizeCode(raw) {
  return String(raw || "").trim().toUpperCase();
}

function clampUnits(raw) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_UNITS_PER_CLAIM);
}

async function safeJsonBody(request) {
  if (request.method !== "POST") return {};
  try {
    return await request.json();
  } catch (_e) {
    return {};
  }
}

function clientIpFromRequest(request) {
  const cfIp = request.headers.get("CF-Connecting-IP");
  if (cfIp) return cfIp.trim();
  const xff = request.headers.get("X-Forwarded-For");
  if (xff) return xff.split(",")[0].trim();
  return "0.0.0.0";
}

async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function loadProPlan(env, code) {
  const cleanCode = normalizeCode(code);
  if (!cleanCode) return null;
  const row = await env.DB
    .prepare(
      "SELECT code, daily_limit, is_unlimited, active, expires_at FROM pro_keys WHERE code = ? LIMIT 1",
    )
    .bind(cleanCode)
    .first();

  if (!row) return null;
  if (Number(row.active) !== 1) return null;
  if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) return null;

  return {
    code: row.code,
    isUnlimited: Number(row.is_unlimited) === 1,
    dailyLimit: Number.isFinite(Number(row.daily_limit)) ? Number(row.daily_limit) : null,
  };
}

async function getUsageCount(env, key) {
  const raw = await env.QUOTA_KV.get(key);
  const value = Number.parseInt(raw || "0", 10);
  return Number.isFinite(value) ? value : 0;
}

async function setUsageCount(env, key, count) {
  await env.QUOTA_KV.put(key, String(count), {
    expirationTtl: secondsUntilNextMidnightUtc(),
  });
}

function buildQuotaResponse({
  allowed,
  tier,
  quotaDaily,
  usedToday,
  dateKey,
  proCodeAccepted = false,
}) {
  const remaining = quotaDaily === null ? null : Math.max(0, quotaDaily - usedToday);
  return {
    allowed,
    tier,
    quotaDaily,
    usedToday,
    remaining,
    resetAt: toIsoResetAt(),
    dateBucket: dateKey,
    proCodeAccepted,
  };
}

async function resolvePlan(request, env, body) {
  const dateKey = dateBucket();
  const proCode = normalizeCode(body.proCode);
  const proPlan = await loadProPlan(env, proCode);

  if (proPlan) {
    const codeHash = await sha256Hex(proPlan.code);
    return {
      tier: "pro",
      quotaDaily: proPlan.isUnlimited ? null : Math.max(1, proPlan.dailyLimit || 1),
      usageKey: `usage:pro:${dateKey}:${codeHash}`,
      dateKey,
      proCodeAccepted: true,
    };
  }

  const ipHash = await sha256Hex(clientIpFromRequest(request));
  const freeLimit = Math.max(1, Number.parseInt(env.FREE_DAILY_LIMIT || DEFAULT_FREE_DAILY_LIMIT, 10) || DEFAULT_FREE_DAILY_LIMIT);
  return {
    tier: "free",
    quotaDaily: freeLimit,
    usageKey: `usage:free:${dateKey}:${ipHash}`,
    dateKey,
    proCodeAccepted: false,
  };
}

async function handleQuotaStatus(request, env) {
  const body = await safeJsonBody(request);
  const plan = await resolvePlan(request, env, body);
  const usedToday = await getUsageCount(env, plan.usageKey);
  return json(
    buildQuotaResponse({
      allowed: plan.quotaDaily === null ? true : usedToday < plan.quotaDaily,
      tier: plan.tier,
      quotaDaily: plan.quotaDaily,
      usedToday,
      dateKey: plan.dateKey,
      proCodeAccepted: plan.proCodeAccepted,
    }),
  );
}

async function handleQuotaClaim(request, env) {
  const body = await safeJsonBody(request);
  const units = clampUnits(body.units);
  const plan = await resolvePlan(request, env, body);
  const usedToday = await getUsageCount(env, plan.usageKey);
  const nextUsed = usedToday + units;

  if (plan.quotaDaily !== null && nextUsed > plan.quotaDaily) {
    return json(
      buildQuotaResponse({
        allowed: false,
        tier: plan.tier,
        quotaDaily: plan.quotaDaily,
        usedToday,
        dateKey: plan.dateKey,
        proCodeAccepted: plan.proCodeAccepted,
      }),
    );
  }

  await setUsageCount(env, plan.usageKey, nextUsed);
  return json(
    buildQuotaResponse({
      allowed: true,
      tier: plan.tier,
      quotaDaily: plan.quotaDaily,
      usedToday: nextUsed,
      dateKey: plan.dateKey,
      proCodeAccepted: plan.proCodeAccepted,
    }),
  );
}

function requireAdmin(request, env) {
  const expected = env.ADMIN_TOKEN;
  if (!expected) return false;
  const provided = request.headers.get("X-Admin-Token") || "";
  return provided === expected;
}

async function handleAdminUpsert(request, env) {
  if (!requireAdmin(request, env)) {
    return json({ error: "unauthorized" }, 401);
  }

  const body = await safeJsonBody(request);
  const code = normalizeCode(body.code);
  if (!code || !/^NTA-PRO-[A-Z0-9-]{2,40}$/.test(code)) {
    return json({ error: "invalid_code_format" }, 400);
  }

  const isUnlimited = !!body.isUnlimited;
  const active = body.active === false ? 0 : 1;
  const dailyLimit = isUnlimited ? null : Math.max(1, Number.parseInt(body.dailyLimit, 10) || 20);
  const note = String(body.note || "").slice(0, 200);
  const expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : null;
  const nowIso = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO pro_keys (code, daily_limit, is_unlimited, active, note, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET
       daily_limit = excluded.daily_limit,
       is_unlimited = excluded.is_unlimited,
       active = excluded.active,
       note = excluded.note,
       expires_at = excluded.expires_at,
       updated_at = excluded.updated_at`,
  )
    .bind(code, dailyLimit, isUnlimited ? 1 : 0, active, note, expiresAt, nowIso, nowIso)
    .run();

  return json({
    ok: true,
    code,
    quotaDaily: dailyLimit,
    isUnlimited,
    active: active === 1,
    expiresAt,
  });
}

async function handleAdminRevoke(request, env) {
  if (!requireAdmin(request, env)) {
    return json({ error: "unauthorized" }, 401);
  }

  const body = await safeJsonBody(request);
  const code = normalizeCode(body.code);
  if (!code) return json({ error: "missing_code" }, 400);

  await env.DB.prepare("UPDATE pro_keys SET active = 0, updated_at = ? WHERE code = ?")
    .bind(new Date().toISOString(), code)
    .run();

  return json({ ok: true, code, active: false });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return addCors(new Response(null, { status: 204 }), request, env);
    }

    const url = new URL(request.url);
    let response;

    if (request.method === "GET" && url.pathname === "/health") {
      response = json({ ok: true, service: "quota-worker" });
      return addCors(response, request, env);
    }

    if (request.method === "POST" && url.pathname === "/v1/quota/status") {
      response = await handleQuotaStatus(request, env);
      return addCors(response, request, env);
    }

    if (request.method === "POST" && url.pathname === "/v1/quota/claim") {
      response = await handleQuotaClaim(request, env);
      return addCors(response, request, env);
    }

    if (request.method === "POST" && url.pathname === "/v1/admin/pro-code") {
      response = await handleAdminUpsert(request, env);
      return addCors(response, request, env);
    }

    if (request.method === "POST" && url.pathname === "/v1/admin/pro-code/revoke") {
      response = await handleAdminRevoke(request, env);
      return addCors(response, request, env);
    }

    return addCors(json({ error: "not_found" }, 404), request, env);
  },
};
