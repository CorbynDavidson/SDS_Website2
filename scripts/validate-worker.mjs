import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const workerPath = resolve(import.meta.dirname, "../dist/server/index.js");
const source = await readFile(workerPath, "utf8");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const worker = await import(moduleUrl);
assert.equal(typeof worker.default?.fetch, "function");

const repairPages = JSON.parse(await readFile(resolve(import.meta.dirname, "../src/repair-pages.json"), "utf8"));
const servicePages = JSON.parse(await readFile(resolve(import.meta.dirname, "../src/service-pages.json"), "utf8"));
const migratedPages = JSON.parse(await readFile(resolve(import.meta.dirname, "../src/migrated-pages.json"), "utf8"));
const caseStudies = JSON.parse(await readFile(resolve(import.meta.dirname, "../src/case-studies.json"), "utf8"));
const team = JSON.parse(await readFile(resolve(import.meta.dirname, "../src/team.json"), "utf8"));
const newsArticles = JSON.parse(await readFile(resolve(import.meta.dirname, "../src/news-articles.json"), "utf8"));
assert.equal(team.length, 14, "The leadership and housing-team directory should contain 14 profiles");
assert.equal(new Set(team.map((person) => person.slug)).size, team.length, "Team profile slugs must be unique");
assert.equal(team[1]?.slug, "victoria-mccormack", "Victoria McCormack should appear directly after the Managing Director");
assert.equal(newsArticles.length, 10, "The news hub should contain ten substantive articles");
assert.equal(new Set(newsArticles.map((article) => article.slug)).size, newsArticles.length, "News article slugs must be unique");
const fetchPath = (path) => worker.default.fetch(new Request(`https://housingconditionclaims.org${path}`), {});
const indexablePaths = [
  "/",
  "/faqs/",
  ...servicePages.map((item) => `/${item.slug}/`),
  ...repairPages.map((item) => `/${item.slug}/`),
  ...migratedPages.map((item) => `${item.path}/`),
  "/housing-disrepair-claims/compensation-calculator/",
  "/about-us/case-studies/",
  ...caseStudies.map((item) => `/about-us/case-studies/${item.slug}/`),
  "/about-us/our-people/",
  ...team.map((item) => `/about-us/our-people/${item.slug}/`),
  "/about-us/complaints/",
  "/about-us/news/",
  ...newsArticles.map((article) => `/about-us/news/${article.slug}/`),
];
const htmlByPath = new Map();

for (const path of indexablePaths) {
  const response = await fetchPath(path);
  assert.equal(response.status, 200, `${path} should return 200`);
  assert.match(response.headers.get("content-type") || "", /^text\/html/, `${path} should return HTML`);
  const html = await response.text();
  assert.ok(!html.includes(">undefined<") && !html.includes('"undefined"'), `${path} contains an undefined value`);
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `${path} should contain one h1`);
  assert.match(html, /<meta name="description" content="[^"]+">/, `${path} needs a meta description`);
  assert.match(html, /<meta name="robots" content="index,follow">/, `${path} should be indexable`);
  assert.ok(html.includes(`<link rel="canonical" href="https://housingconditionclaims.org${path}">`), `${path} has the wrong canonical`);
  assert.match(html, /application\/ld\+json/, `${path} needs structured data`);
  assert.ok(html.includes('src="/assets/sheldon-davidson-solicitors-logo.png"'), `${path} should use the current Sheldon Davidson Solicitors logo`);
  assert.ok(html.includes('alt="Sheldon Davidson Solicitors"'), `${path} should describe the logo accurately`);
  assert.ok(!html.includes("housing-condition-claims-logo.png"), `${path} should not reference the retired logo asset`);
  assert.ok(html.includes("Sheldon Davidson Solicitors Limited is Authorised and regulated by the Solicitors Regulation Authority · SRA No. 519502"), `${path} should use the current regulatory top bar`);
  assert.ok(html.includes("Housing Condition Claim Specialists</span>"), `${path} should use the specialist brand caption`);
  assert.ok(!html.includes(">An official trading style of Sheldon Davidson Solicitors Limited</span>"), `${path} should not use the previous logo caption`);
  assert.ok(html.includes('id="compact-brand"'), `${path} should include the compact responsive logo sizing`);
  assert.ok(html.includes("font-weight:800!important;white-space:nowrap!important"), `${path} should keep the specialist caption bold and on one line`);
  htmlByPath.set(path, html);
}

const logoResponse = await fetchPath("/assets/sheldon-davidson-solicitors-logo.png");
assert.equal(logoResponse.status, 200, "The Sheldon Davidson Solicitors logo should return 200");
assert.equal(logoResponse.headers.get("content-type"), "image/png", "The logo should be served as PNG");
assert.ok((await logoResponse.arrayBuffer()).byteLength > 100000, "The logo asset should not be empty or truncated");

const internalTargets = new Set();
for (const html of htmlByPath.values()) {
  for (const match of html.matchAll(/(?:href|src)="(\/[^"#?]*)(?:[#?][^"]*)?"/g)) internalTargets.add(match[1] || "/");
}
for (const target of internalTargets) {
  const response = await fetchPath(target);
  assert.ok(response.status < 400, `Internal target ${target} returned ${response.status}`);
}

const sitemapResponse = await fetchPath("/sitemap.xml");
assert.equal(sitemapResponse.status, 200);
const sitemap = await sitemapResponse.text();
for (const path of indexablePaths) assert.ok(sitemap.includes(`<loc>https://housingconditionclaims.org${path}</loc>`), `${path} is missing from the sitemap`);
assert.ok(sitemap.includes("<lastmod>2026-09-23</lastmod>"), "Sitemap lastmod is out of date");
assert.ok(!sitemap.includes("/submissions"), "Protected submissions must not appear in the sitemap");

const peopleHtml = htmlByPath.get("/about-us/our-people/");
assert.ok(peopleHtml.includes('class="team-grid"'), "Our People page should include the multi-profile gallery");
assert.ok(!peopleHtml.includes("data-team-carousel") && !peopleHtml.includes("team-marquee"), "Single-profile carousel markup should not remain");
assert.equal((peopleHtml.match(/<article class="team-card/g) || []).length, team.length, "Gallery should display every team member together");
assert.equal((peopleHtml.match(/class="team-card team-card-leadership"/g) || []).length, 2, "The two senior leaders should be visually identified");
for (const person of team) {
  assert.ok(peopleHtml.includes(`/about-us/our-people/${person.slug}/`), `${person.name} should be linked from Our People`);
  const photoResponse = await fetchPath(`/assets/team/${person.image}`);
  assert.equal(photoResponse.status, 200, `${person.name}'s image should return 200`);
  assert.equal(photoResponse.headers.get("content-type"), "image/webp", `${person.name}'s image should be WebP`);
  assert.ok((await photoResponse.arrayBuffer()).byteLength > 1000, `${person.name}'s image should not be empty`);
  const profileHtml = htmlByPath.get(`/about-us/our-people/${person.slug}/`);
  assert.ok(profileHtml.includes(`"image":"https://housingconditionclaims.org/assets/team/${person.image}"`), `${person.name}'s Person schema should use a valid image URL`);
}

const homeHtml = htmlByPath.get("/");
assert.equal((homeHtml.match(/class="reviews-trust-badge"/g) || []).length, 2, "The ReviewSolicitors rail should include both trust badges");
assert.ok(homeHtml.includes('src="/assets/sra-regulated-badge.png"'), "The ReviewSolicitors rail should include the supplied SRA badge");
assert.ok(homeHtml.includes('src="/assets/hlpa-membership-badge.png"'), "The ReviewSolicitors rail should include the supplied HLPA badge");
assert.equal((homeHtml.match(/class="reviews-assessment"/g) || []).length, 1, "The trust rail should include one free-assessment button");
assert.ok(homeHtml.includes('class="reviews-assessment" href="#callback">Free Assessment</a>'), "The trust-rail assessment button should link to the enquiry form");
for (const badgePath of ["/assets/sra-regulated-badge.png", "/assets/hlpa-membership-badge.png"]) {
  const badgeResponse = await fetchPath(badgePath);
  assert.equal(badgeResponse.status, 200, `${badgePath} should return 200`);
  assert.equal(badgeResponse.headers.get("content-type"), "image/png", `${badgePath} should be served as PNG`);
  assert.ok((await badgeResponse.arrayBuffer()).byteLength > 10000, `${badgePath} should not be empty or truncated`);
}
const brandCssResponse = await fetchPath("/brand.css");
assert.equal(brandCssResponse.status, 200, "Brand CSS should return 200");
const brandCssText = await brandCssResponse.text();
assert.ok(brandCssText.includes(".reviews-widget{position:fixed;right:0;top:50%;z-index:48;width:100px"), "The desktop trust rail should use the reduced width");
assert.equal((homeHtml.match(/class="consent(?:\s|\")/g) || []).length, 1, "Home should use one concise form privacy notice");
assert.ok(homeHtml.includes('href="/privacy/"'), "Home form should link to the detailed privacy notice");
assert.ok(!homeHtml.includes("Your rights:</strong>"), "The previous long form privacy block should not remain");
const privacyResponse = await fetchPath("/privacy/");
assert.equal(privacyResponse.status, 200, "Privacy notice should return 200");
const privacyHtml = await privacyResponse.text();
assert.match(privacyHtml, /<meta name="robots" content="noindex,follow">/, "Privacy notice should stay out of search results");
for (const phrase of ["Data controller", "Lawful bases", "Who may receive it", "How long information is kept", "Your rights", "Information Commissioner’s Office"]) {
  assert.ok(privacyHtml.includes(phrase), `Privacy notice should include ${phrase}`);
}
assert.equal((homeHtml.match(/<article class="testimonial-slide/g) || []).length, 5, "Home should contain five non-traffic review slides");
assert.ok(!homeHtml.includes("Add approved client testimonial"), "Review placeholders should not remain");
assert.ok(homeHtml.includes("reviewsolicitors.co.uk/greater-manchester/manchester/sheldon-davidson-solicitors-ltd"), "Home reviews should link to the independent source");
assert.match(homeHtml, /id="testimonialCurrent">01<\/strong><span>\/ 05<\/span>/, "Home review counter should show five slides");
for (const phrase of ["car accident", "personal injury claim", "cycling incident", "physiotherapy", "replacement vehicle"]) {
  assert.ok(!homeHtml.toLowerCase().includes(phrase), `Home reviews should not include ${phrase}`);
}
assert.equal((homeHtml.match(/<article class="about-slide/g) || []).length, team.length, "Who we are should include every verified team profile");
assert.ok(!homeHtml.includes("__HOME_TEAM_"), "Who we are build placeholders should be replaced");
assert.ok(homeHtml.indexOf("Sheldon Davidson") < homeHtml.indexOf("Victoria McCormack"), "Sheldon and Victoria should lead the homepage team carousel");
for (const person of team) assert.ok(homeHtml.includes(`/about-us/our-people/${person.slug}/`), `${person.name} should be linked from the homepage carousel`);

const newsIndexHtml = htmlByPath.get("/about-us/news/");
assert.ok(newsIndexHtml.includes('class="news-card news-card-featured"'), "News index should feature the latest article");
assert.equal((newsIndexHtml.match(/<article class="news-card/g) || []).length, newsArticles.length, "News index should show every article");
for (const article of newsArticles) {
  const path = `/about-us/news/${article.slug}/`;
  const html = htmlByPath.get(path);
  assert.ok(html.includes('"@type":"NewsArticle"'), `${path} needs NewsArticle structured data`);
  assert.ok(html.includes("Publication context"), `${path} needs the legal-information and source note`);
  assert.ok(html.includes(article.sourceUrl), `${path} should link to its original SDS publication`);
  assert.ok((html.match(/<h2(?:\s|>)/g) || []).length >= 3, `${path} should contain substantive article sections`);
}

const oldProfile = await fetchPath("/our-experts/sheldon-davidson");
assert.equal(oldProfile.status, 301);
assert.equal(oldProfile.headers.get("location"), "https://housingconditionclaims.org/about-us/our-people/sheldon-davidson/");

const missing = await fetchPath("/this-page-does-not-exist/");
assert.equal(missing.status, 404);
assert.match(await missing.text(), /noindex,follow/);

console.log(`Worker validation passed: ${indexablePaths.length} indexable content pages, ${internalTargets.size} internal targets, sitemap, redirects, assets and 404 response`);
