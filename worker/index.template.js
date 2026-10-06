const page = __PAGE_HTML__;
const profilePage = __PROFILE_PAGE_HTML__;
const faqPage = __FAQ_PAGE_HTML__;
const privacyPage = __PRIVACY_PAGE_HTML__;
const servicePages = __SERVICE_PAGES__;
const legacyPages = __LEGACY_PAGES__;
const indexableLegacyPaths = __INDEXABLE_LEGACY_PATHS__;
const teamAssets = __TEAM_ASSETS__;
const brandCss = __BRAND_CSS__;
const serviceCss = __SERVICE_CSS__;
const logoBase64 = __LOGO_BASE64__;
const heroBase64 = __HERO_BASE64__;
const scenarioLeakBase64 = __SCENARIO_LEAK_BASE64__;
const scenarioHeatingBase64 = __SCENARIO_HEATING_BASE64__;
const scenarioMouldBase64 = __SCENARIO_MOULD_BASE64__;
const scenarioDangerBase64 = __SCENARIO_DANGER_BASE64__;
const scenarioBathroomBase64 = __SCENARIO_BATHROOM_BASE64__;
const scenarioElectricalBase64 = __SCENARIO_ELECTRICAL_BASE64__;
const scenarioPestsBase64 = __SCENARIO_PESTS_BASE64__;
const scenarioFlooringBase64 = __SCENARIO_FLOORING_BASE64__;
const scenarioKitchenPlumbingBase64 = __SCENARIO_KITCHEN_PLUMBING_BASE64__;
const scenarioWindowsDoorsBase64 = __SCENARIO_WINDOWS_DOORS_BASE64__;
const hlpaLogoBase64 = __HLPA_LOGO_BASE64__;
const sraBadgeBase64 = __SRA_BADGE_BASE64__;
const hlpaBadgeBase64 = __HLPA_BADGE_BASE64__;
const ownerEmail = "corbyn.davidson@hotmail.com";
const canonicalPath = (path) => path === "/" ? "/" : `${path.replace(/\/+$/, "")}/`;
const sitemapPaths = [...new Set(["/", "/faqs/", ...Object.keys(servicePages).map(canonicalPath), ...indexableLegacyPaths.filter((path) => legacyPages[path]).map(canonicalPath)])];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapPaths.map((path) => `  <url>
    <loc>https://www.sds-solicitors.com${path}</loc>
    <lastmod>2026-09-23</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${path === "/" ? "1.0" : path === "/housing-disrepair/" || path === "/housing-disrepair-claims/" ? "0.9" : path.includes("/case-studies/") || path.includes("/our-people/") ? "0.7" : "0.8"}</priority>
  </url>`).join("\n")}
</urlset>`;
const robots = `User-agent: *
Allow: /
Disallow: /submissions
Disallow: /submissions.csv

Sitemap: https://www.sds-solicitors.com/sitemap.xml
`;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const decodeImage = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const protectedUser = (request) => {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!email) return { response: Response.redirect(new URL("/signin-with-chatgpt?return_to=/submissions", request.url), 302) };
  if (email !== ownerEmail) return { response: new Response("You do not have access to these submissions.", { status: 403 }) };
  return { email };
};

const adminPage = (rows) => `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Form submissions | Housing Condition Claims UK</title>
<style>:root{font-family:system-ui,sans-serif;color:#101b2d;background:#f6f3ec}*{box-sizing:border-box}body{margin:0}.shell{width:min(1180px,calc(100% - 32px));margin:42px auto}.head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:24px}.head h1{margin:0;font-size:clamp(2rem,5vw,4rem);letter-spacing:-.05em}.actions{display:flex;gap:10px;flex-wrap:wrap}.button{display:inline-flex;padding:11px 16px;border-radius:999px;background:#101b2d;color:white;text-decoration:none;font-weight:700}.button.secondary{background:#ff6b57;color:#101b2d}.table-wrap{overflow:auto;background:white;border-radius:18px;box-shadow:0 16px 50px rgba(20,41,67,.1)}table{width:100%;border-collapse:collapse;min-width:940px}th,td{padding:14px 16px;text-align:left;border-bottom:1px solid #e5e8ed;vertical-align:top}th{font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;background:#142943;color:white}td{font-size:.92rem}.empty{padding:50px;text-align:center;color:#566171}.count{color:#566171;margin-top:8px}@media(max-width:700px){.head{align-items:flex-start;flex-direction:column}.shell{margin-top:24px}}</style></head>
<body><main class="shell"><div class="head"><div><h1>Form submissions</h1><div class="count">${rows.length} most recent enquiries</div></div><div class="actions"><a class="button secondary" href="/submissions.csv">Download CSV</a><a class="button" href="/">Back to site</a><a class="button" href="/signout-with-chatgpt?return_to=/">Sign out</a></div></div>
${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Received</th><th>Name</th><th>Email</th><th>Phone</th><th>Postcode</th><th>Type of disrepair</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.created_at)}</td><td>${escapeHtml(row.full_name)}</td><td><a href="mailto:${escapeHtml(row.email)}">${escapeHtml(row.email)}</a></td><td><a href="tel:${escapeHtml(row.phone)}">${escapeHtml(row.phone)}</a></td><td>${escapeHtml(row.postcode)}</td><td>${escapeHtml(row.disrepair_type)}</td></tr>`).join("")}</tbody></table></div>` : '<div class="table-wrap empty">No enquiries have been submitted yet.</div>'}
</main></body></html>`;

const csvCell = (value) => {
  let text = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response(page, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
    }
    if (request.method === "GET" && url.pathname === "/sitemap.xml") {
      return new Response(sitemap, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }
    if (request.method === "GET" && url.pathname === "/robots.txt") {
      return new Response(robots, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }
    if (request.method === "GET" && (url.pathname === "/our-experts/sheldon-davidson" || url.pathname === "/our-experts/sheldon-davidson/")) {
      return Response.redirect(new URL("/about-us/our-people/sheldon-davidson/", request.url), 301);
    }
    if (request.method === "GET" && (url.pathname === "/faqs" || url.pathname === "/faqs/")) {
      return new Response(faqPage, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
    }
    if (request.method === "GET" && (url.pathname === "/privacy" || url.pathname === "/privacy/")) {
      return new Response(privacyPage, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
    }
    if (request.method === "GET") {
      const servicePage = servicePages[url.pathname.replace(/\/$/, "")];
      if (servicePage) return new Response(servicePage, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
      const legacyPage = legacyPages[url.pathname.replace(/\/$/, "")];
      if (legacyPage) return new Response(legacyPage, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
    }
    if (request.method === "GET" && url.pathname === "/brand.css") {
      return new Response(brandCss, { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=86400" } });
    }
    if (request.method === "GET" && url.pathname === "/service.css") {
      return new Response(serviceCss, { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=86400" } });
    }
    if (request.method === "GET" && url.pathname === "/assets/sheldon-davidson-solicitors-logo.png") {
      return new Response(decodeImage(logoBase64), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
    }
    if (request.method === "GET" && url.pathname === "/assets/housing-conditions-hero.png") {
      return new Response(decodeImage(heroBase64), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
    }
    if (request.method === "GET" && url.pathname === "/assets/hlpa-logo.jpg") {
      return new Response(decodeImage(hlpaLogoBase64), { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400" } });
    }
    if (request.method === "GET" && url.pathname === "/assets/sra-regulated-badge.png") {
      return new Response(decodeImage(sraBadgeBase64), { headers: { "content-type": "image/png", "cache-control": "public, max-age=604800", "x-content-type-options": "nosniff" } });
    }
    if (request.method === "GET" && url.pathname === "/assets/hlpa-membership-badge.png") {
      return new Response(decodeImage(hlpaBadgeBase64), { headers: { "content-type": "image/png", "cache-control": "public, max-age=604800", "x-content-type-options": "nosniff" } });
    }
    const scenarioAssets = {
      "/assets/scenario-leak.jpg": scenarioLeakBase64,
      "/assets/scenario-heating.jpg": scenarioHeatingBase64,
      "/assets/scenario-mould.jpg": scenarioMouldBase64,
      "/assets/scenario-danger.jpg": scenarioDangerBase64,
      "/assets/scenario-bathroom.png": scenarioBathroomBase64,
      "/assets/scenario-electrical.png": scenarioElectricalBase64,
      "/assets/scenario-pests.png": scenarioPestsBase64,
      "/assets/scenario-flooring.png": scenarioFlooringBase64,
      "/assets/scenario-kitchen-plumbing.png": scenarioKitchenPlumbingBase64,
      "/assets/scenario-windows-doors.png": scenarioWindowsDoorsBase64,
    };
    if (request.method === "GET" && scenarioAssets[url.pathname]) {
      return new Response(decodeImage(scenarioAssets[url.pathname]), { headers: { "content-type": url.pathname.endsWith(".png") ? "image/png" : "image/jpeg", "cache-control": "public, max-age=86400" } });
    }
    if (request.method === "GET" && teamAssets[url.pathname]) {
      return new Response(decodeImage(teamAssets[url.pathname]), { headers: { "content-type": "image/webp", "cache-control": "public, max-age=604800", "x-content-type-options": "nosniff" } });
    }

    if (request.method === "POST" && url.pathname === "/api/leads") {
      if (!env.DB) return json({ error: "The enquiry service is temporarily unavailable." }, 503);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Please check the form and try again." }, 400); }
      if (body.company) return json({ ok: true });
      const fullName = String(body.fullName ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const phone = String(body.phone ?? "").trim();
      const postcode = String(body.postcode ?? "").trim().toUpperCase();
      const disrepairType = String(body.disrepairType ?? "").trim();
      const allowedTypes = ["Damp or mould", "Leaks or water damage", "Broken heating or hot water", "Cracks or structural damage", "Pests or sanitation", "Unsafe electrics", "Other"];
      if (fullName.length < 2 || fullName.length > 100) return json({ error: "Please enter your full name." }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) return json({ error: "Please enter a valid email address." }, 400);
      if (!/^[0-9+()\s-]{7,30}$/.test(phone)) return json({ error: "Please enter a valid phone number." }, 400);
      if (!/^[A-Z0-9 ]{5,12}$/.test(postcode)) return json({ error: "Please enter a valid postcode." }, 400);
      if (!allowedTypes.includes(disrepairType)) return json({ error: "Please choose the type of disrepair." }, 400);
      try {
        await env.DB.prepare(`INSERT INTO enquiries (full_name, email, phone, postcode, disrepair_type) VALUES (?, ?, ?, ?, ?)`)
          .bind(fullName, email, phone, postcode, disrepairType).run();
        return json({ ok: true }, 201);
      } catch (error) {
        console.error("Unable to save enquiry", error?.name || "Error");
        return json({ error: "We could not send your enquiry. Please try again." }, 500);
      }
    }

    if (request.method === "GET" && (url.pathname === "/submissions" || url.pathname === "/submissions.csv")) {
      const auth = protectedUser(request);
      if (auth.response) return auth.response;
      if (!env.DB) return new Response("The submissions database is temporarily unavailable.", { status: 503 });
      const result = await env.DB.prepare(`SELECT created_at, full_name, email, phone, postcode, disrepair_type FROM enquiries ORDER BY id DESC LIMIT 500`).all();
      const rows = result.results ?? [];
      if (url.pathname.endsWith(".csv")) {
        const header = ["Received", "Full name", "Email", "Phone", "Postcode", "Type of disrepair"];
        const csv = [header.map(csvCell).join(","), ...rows.map((row) => [row.created_at, row.full_name, row.email, row.phone, row.postcode, row.disrepair_type].map(csvCell).join(","))].join("\r\n");
        return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=housing-condition-enquiries.csv", "cache-control": "no-store" } });
      }
      return new Response(adminPage(rows), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    }

    return new Response(`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>Page not found | Housing Condition Claims UK</title><style>body{margin:0;background:#f3f8f8;color:#032b4c;font:18px/1.6 system-ui,sans-serif}.box{width:min(720px,calc(100% - 40px));margin:12vh auto;padding:48px;background:#fff;border-radius:18px;box-shadow:0 20px 60px #032b4c18}h1{font-size:clamp(2.4rem,7vw,4.8rem);line-height:1;margin:0 0 22px}a{display:inline-block;margin-top:16px;padding:14px 20px;border-radius:10px;background:#efb400;color:#032b4c;font-weight:800;text-decoration:none}</style></head><body><main class="box"><p>404</p><h1>That page could not be found.</h1><p>The address may have changed. You can return to the housing claims overview or contact the team for help.</p><a href="/housing-disrepair/">Explore housing claims</a></main></body></html>`, { status: 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" } });
  },
};
