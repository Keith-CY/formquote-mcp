// The four tools: three quote comparisons and the catalogue. Each validates
// its input here first, sends the documented DigitalQuoteRequest to the
// Formquote API, and turns the (large) answer into a short, honest summary
// plus compact structured data.

import { UpstreamError } from './formquote.js';

const LANGS = ['en', 'zh', 'ja', 'fr', 'de'];
const GOALS = ['lowest_cash_now', 'lowest_job_cost', 'best_requirement_fit'];
const PAGES = { email_verification: 'email-verification', sound_effects: 'sound-effects', font_license: 'font-licenses' };
const EMAIL_SUPPLIERS = ['millionverifier', 'reoon', 'debounce', 'emailable'];

const annotations = (title) => ({ title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
const goal = (fallback) => ({
  type: 'string',
  enum: GOALS,
  default: fallback,
  description:
    'How to rank: lowest_cash_now = least money to pay now for whole packs or plans; lowest_job_cost = lowest cost allocated to this job (leftover credits keep their value); best_requirement_fit = best match to the stated use first.',
});
const lang = {
  type: 'string',
  enum: LANGS,
  default: 'en',
  description: 'Language of the Formquote page linked in the answer (en, zh, ja, fr, de). The figures are the same; notes recorded by Formquote stay in their original language (mostly Chinese).',
};
const int = (min, max, description, extra = {}) => ({ type: 'integer', minimum: min, maximum: max, description, ...extra });
const bool = (description, extra = {}) => ({ type: 'boolean', description, ...extra });

const DISCLAIMER =
  'Published prices observed by Formquote on the dates shown, not live checkout quotes. Taxes and checkout fees are not confirmed unless stated. Nothing is ordered, paid or reserved; check the seller’s page before buying.';

export function toolList() {
  return [
    {
      name: 'compare_email_verification_prices',
      title: 'Compare email verification prices',
      description:
        'Compare what it costs to verify (clean, validate) a list of email addresses with MillionVerifier, Reoon, DeBounce and Emailable, from their published credit packs and monthly plans. ' +
        'Use this when the user asks how much it costs to verify a number of emails, which email verification service is cheapest for their list size, or how many credit packs to buy. ' +
        'Give only the number of emails, never the addresses. Credits the user already holds with a supplier can be counted. ' +
        'Returns the packs ranked within comparable groups (one-time packs vs monthly plans, per currency), the price for this request, the cost allocated to this job, what is unconfirmed, the date each price was checked and the seller’s page. ' +
        'These are published list prices, not live checkout quotes; it does not verify emails or buy anything.',
      inputSchema: {
        type: 'object',
        properties: {
          emails: int(1, 10000000, 'How many email addresses need verifying (1 to 10,000,000). Only the count, never the addresses.'),
          existing_credits: {
            type: 'object',
            description: 'Unexpired verification credits the user already holds, by supplier (optional), e.g. {"reoon": 5000}.',
            properties: Object.fromEntries(EMAIL_SUPPLIERS.map((s) => [s, int(0, 1000000000, `Credits already held with ${s}.`)])),
            additionalProperties: false,
          },
          goal: goal('lowest_cash_now'),
          lang,
        },
        required: ['emails'],
        additionalProperties: false,
      },
      annotations: annotations('Compare email verification prices'),
      _meta: { 'openai/toolInvocation/invoking': 'Comparing email verification prices…', 'openai/toolInvocation/invoked': 'Prices compared' },
    },
    {
      name: 'compare_sound_effects_licenses',
      title: 'Compare sound effect pack licences',
      description:
        'Check prices and licence fit for a small, hand-checked set of sound effect packs: UI clicks and snaps, motion-graphics sounds, desert wind and train ambiences, and a kettle whistle, from SoundMorph, HISSandaROAR and Thomas Rex Beverly Audio (8 packs). ' +
        'Use this when the user wants sound effects for an app, game, video or interface and asks what a pack costs or whether its licence allows their use: commercial work, number of seats, AI training or generation, reselling the sounds, or a product where the sounds are a large share. ' +
        'Returns each pack’s price, whether it fits (eligible, conditional or not eligible) and which licence points still need the seller’s confirmation. ' +
        'It covers only these packs, not whole sound libraries; say so if none fits. Published prices; nothing is bought.',
      inputSchema: {
        type: 'object',
        properties: {
          intent: { type: 'string', enum: ['any', 'ui', 'motion', 'nature', 'train', 'kettle'], description: 'What the sounds are for: ui (interface clicks, snaps), motion (motion graphics), nature (ambiences such as wind), train, kettle, or any.' },
          seats: int(1, 1000, 'People or workstations that will use the sounds (default 1).', { default: 1 }),
          ai_use: bool('Will the audio itself be used to train or generate with AI? (Asking an AI chat for prices is not AI use.) Default false.', { default: false }),
          commercial_use: bool('Will the sounds be used in commercial work? Default true.', { default: true }),
          standalone_resale: bool('Will the sounds be resold or redistributed on their own (as a sound pack)? Default false.', { default: false }),
          pure_sfx_percent: { type: 'number', minimum: 0, maximum: 100, description: 'Optional: the share (0–100) of the finished product’s total duration that is this supplier’s sound effects alone, with no voice or music. Some licences restrict products where it reaches 25%.' },
          goal: goal('best_requirement_fit'),
          lang,
        },
        required: ['intent'],
        additionalProperties: false,
      },
      annotations: annotations('Compare sound effect pack licences'),
      _meta: { 'openai/toolInvocation/invoking': 'Checking sound effect licences…', 'openai/toolInvocation/invoked': 'Licences checked' },
    },
    {
      name: 'compare_font_licenses',
      title: 'Compare font licences',
      description:
        'Check which licence a use needs, and what it costs, for a small, hand-checked set of fonts: Pangram Pangram’s Font Starter Packs, Fontwerk Push, Grilli Type GT Cinetype and Fontfabric Nexa (6 offers). ' +
        'Use this when the user asks whether one of these fonts can be used on a website, on desktop, in print, in an app or game, in a logo or in paid ads, and what licence and price that needs: users, websites, monthly pageviews or unique visitors per site, years of use. ' +
        'Returns each offer’s published price where one applies, which requirements fail or are unconfirmed (for example pageview caps, PV versus UV, styles chosen at the foundry) and the foundry’s page. ' +
        'Other typefaces are not covered; say so instead of guessing. Published prices; nothing is bought.',
      inputSchema: {
        type: 'object',
        properties: {
          license_use: { type: 'string', enum: ['web', 'desktop', 'both'], description: 'web (webfonts on a site), desktop (installed for design work) or both.' },
          seats: int(1, 1000, 'People who will use the font (default 1).', { default: 1 }),
          websites: int(1, 10000, 'Websites the font will be used on (default 1).', { default: 1 }),
          monthly_pageviews: int(0, 1000000000, 'Traffic cap needed per website per month, in the unit of traffic_metric (default 5,000).', { default: 5000 }),
          traffic_metric: { type: 'string', enum: ['pv', 'uv'], default: 'pv', description: 'pv = pageviews, uv = unique visitors. They are not converted into each other.' },
          term_years: int(1, 20, 'Years the font will be used (default 1). Yearly plans only confirm the first year’s price.', { default: 1 }),
          medium: { type: 'string', enum: ['website', 'print', 'app', 'web_app', 'game', 'logo', 'paid_ad'], description: 'Where it is used. A plain website licence does not cover a web app, app, game, logo or paid ads.' },
          commercial_use: bool('Commercial use? (optional)'),
          commercial_projects: int(0, 1000000000, 'Commercial projects per year (optional).'),
          print_projects: int(0, 1000000000, 'Print projects (optional).'),
          print_units: int(0, 1000000000, 'Printed units (optional).'),
          requires_all_styles: bool('Does the user need every weight and style of the family? (optional)'),
          goal: goal('best_requirement_fit'),
          lang,
        },
        required: ['license_use'],
        additionalProperties: false,
      },
      annotations: annotations('Compare font licences'),
      _meta: { 'openai/toolInvocation/invoking': 'Checking font licences…', 'openai/toolInvocation/invoked': 'Licences checked' },
    },
    {
      name: 'list_formquote_catalog',
      title: 'List the Formquote catalogue',
      description:
        'List everything Formquote has price evidence for: email verification credit packs and plans (MillionVerifier, Reoon, DeBounce, Emailable), sound effect packs (SoundMorph, HISSandaROAR, Thomas Rex Beverly Audio) and font licences (Pangram Pangram, Fontwerk, Grilli Type, Fontfabric), with each listed price, billing period, the date it was checked and the seller’s page. ' +
        'Use this to see what is covered, or when the user asks for one of these suppliers’ listed prices. To price a specific need, use the compare_* tools instead.',
      inputSchema: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['email_verification', 'sound_effects', 'font_license'], description: 'Only this category (optional; default all three).' },
          lang,
        },
        additionalProperties: false,
      },
      annotations: annotations('List the Formquote catalogue'),
      _meta: { 'openai/toolInvocation/invoking': 'Reading the catalogue…', 'openai/toolInvocation/invoked': 'Catalogue ready' },
    },
  ];
}

// ---------- Input validation (the subset of JSON Schema used above) ----------
// Integer-valued strings such as "25000" are accepted for integer fields.
// Numbers clients often send as text: "10,000", "10 000", "10_000", "10k", "2.5M".
export function parseLooseNumber(v) {
  if (typeof v !== 'string') return v;
  const m = /^\s*(-?\d[\d,_ ]*(?:\.\d+)?)\s*([kKmM])?\s*$/.exec(v);
  if (!m) return v;
  const n = Number(m[1].replace(/[,_ ]/g, ''));
  if (!Number.isFinite(n)) return v;
  const mult = m[2] ? (m[2].toLowerCase() === 'k' ? 1e3 : 1e6) : 1;
  return Math.round(n * mult * 1e6) / 1e6;
}

// Other names clients use for the required count (top level only).
const ALIASES = { emails: ['email_count', 'emails_count', 'num_emails', 'number_of_emails', 'count', 'quantity', 'list_size'] };

export function validate(schema, args, top = true) {
  const out = {};
  const ignored = [];
  const props = schema.properties || {};
  args = { ...args };
  if (top) for (const [key, names] of Object.entries(ALIASES)) {
    if (!(key in props) || args[key] !== undefined) continue;
    const alias = names.find((n) => args[n] !== undefined);
    if (alias) { args[key] = args[alias]; delete args[alias]; }
  }
  for (const key of Object.keys(args)) {
    if (key in props) continue;
    // Nested objects stay strict, and so does anything that could carry addresses or a list.
    const v = args[key];
    const risky = Array.isArray(v) || (v && typeof v === 'object') || (typeof v === 'string' && v.includes('@'));
    if (!top || risky) return { error: `Unknown argument "${String(key).slice(0, 40)}". Allowed: ${Object.keys(props).join(', ')}.` };
    ignored.push(String(key).slice(0, 40)); delete args[key];
  }
  for (const key of schema.required || []) if (args[key] === undefined || args[key] === null) return { error: `"${key}" is required.` };
  for (const [key, p] of Object.entries(props)) {
    let v = args[key];
    if (v === undefined || v === null) continue;
    const where = `"${key}"`;
    if (p.type === 'integer' || p.type === 'number') {
      v = parseLooseNumber(v);
      if (typeof v !== 'number' || !Number.isFinite(v)) return { error: `${where} must be a number.` };
      if (p.type === 'integer' && !Number.isInteger(v)) return { error: `${where} must be a whole number.` };
      if (p.minimum !== undefined && v < p.minimum) return { error: `${where} must be at least ${p.minimum}.` };
      if (p.maximum !== undefined && v > p.maximum) return { error: `${where} must be at most ${p.maximum.toLocaleString('en-US')}.` };
    } else if (p.type === 'boolean') {
      if (v === 'true' || v === 'false') v = v === 'true';
      if (typeof v !== 'boolean') return { error: `${where} must be true or false.` };
    } else if (p.type === 'string') {
      if (typeof v !== 'string') return { error: `${where} must be a string.` };
      if (p.enum && !p.enum.includes(v)) {
        const norm = (x) => String(x).trim().toLowerCase().replace(/[\s-]+/g, '_');
        const hit = p.enum.find((e) => norm(e) === norm(v));
        if (!hit) return { error: `${where} must be one of: ${p.enum.join(', ')}.` };
        v = hit;
      }
    } else if (p.type === 'object') {
      if (typeof v !== 'object' || Array.isArray(v)) return { error: `${where} must be an object.` };
      const inner = validate(p, v, false);
      if (inner.error) return { error: `${where}: ${inner.error}` };
      v = inner.value;
    }
    out[key] = v;
  }
  return { value: out, ignored };
}

// ---------- Tool input → DigitalQuoteRequest ----------
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const nonEmpty = (o) => (Object.keys(o).length ? o : undefined);

export function quoteRequest(name, a) {
  if (name === 'compare_email_verification_prices') {
    return compact({
      schemaVersion: 1,
      categoryId: 'email_verification',
      specifications: { count: a.emails },
      purchaseContext: a.existing_credits && Object.keys(a.existing_credits).length ? { creditsBySupplier: a.existing_credits } : undefined,
      comparisonGoal: a.goal ?? 'lowest_cash_now',
    });
  }
  if (name === 'compare_sound_effects_licenses') {
    return compact({
      schemaVersion: 1,
      categoryId: 'sound_effects',
      specifications: compact({ intent: a.intent, seats: a.seats ?? 1, aiUse: a.ai_use ?? false }),
      usageContext: nonEmpty(compact({ commercialUse: a.commercial_use ?? true, standaloneResale: a.standalone_resale ?? false, supplierPureSfxTimePercent: a.pure_sfx_percent })),
      comparisonGoal: a.goal ?? 'best_requirement_fit',
    });
  }
  if (name === 'compare_font_licenses') {
    return compact({
      schemaVersion: 1,
      categoryId: 'font_license',
      specifications: compact({
        licenseUse: a.license_use,
        seats: a.seats ?? 1,
        websites: a.websites ?? 1,
        monthlyPageviews: a.monthly_pageviews ?? 5000,
        trafficMetric: a.traffic_metric ?? 'pv',
        termYears: a.term_years ?? 1,
      }),
      usageContext: nonEmpty(
        compact({
          medium: a.medium,
          commercialUse: a.commercial_use,
          commercialProjects: a.commercial_projects,
          printProjects: a.print_projects,
          printUnits: a.print_units,
          requiresAllStyles: a.requires_all_styles,
        }),
      ),
      comparisonGoal: a.goal ?? 'best_requirement_fit',
    });
  }
  throw new Error(`not a quote tool: ${name}`);
}

// ---------- Formatting ----------
const PERIOD = { one_time: 'One-time', month: 'Monthly', year: 'Yearly' };
const PER = { month: '/month', year: '/year' };
const RANK = { quotedSubtotal: 'ranked by price for this request, lowest first', allocatedJobCost: 'ranked by cost allocated to this job, lowest first', fit: 'ranked by fit to the stated use' };
const ELIGIBILITY = { eligible: 'eligible', conditional: 'conditional (needs confirmation)', ineligible: 'not eligible' };
const GOAL_LABEL = { lowest_cash_now: 'lowest cash now', lowest_job_cost: 'lowest job cost', best_requirement_fit: 'best fit' };
const money = (currency, amount) => (amount == null ? null : `${currency || ''} ${amount}`.trim());
const day = (s) => (typeof s === 'string' ? s.slice(0, 10) : null);
const str = (v, n = 400) => (typeof v === 'string' ? v.slice(0, n) : null);
// Titles are English except a Chinese period mark on monthly plans ("/ 月").
const cleanTitle = (t) => str(t, 200)?.replace(/\s*\/\s*月$/, ' / month') ?? null;

export function pageUrl(base, category, lng) {
  const l = LANGS.includes(lng) ? lng : 'en';
  return category && PAGES[category] ? `${base}/${l}/${PAGES[category]}` : `${base}/${l}/`;
}

export function offerView(o) {
  const p = o.pricing || {};
  const sources = [...new Set((o.evidence || []).map((e) => e?.sourceUrl).filter((u) => typeof u === 'string'))].slice(0, 3);
  const f = (o.fulfillment || []).find((x) => typeof x?.url === 'string');
  return {
    id: str(o.catalogItemId, 120),
    title: cleanTitle(o.title),
    supplier: str(o.supplier?.name, 120),
    eligibility: str(o.eligibility, 20),
    currency: str(p.currency, 8),
    referencePrice: str(p.referencePrice, 32),
    priceForRequest: str(p.quotedSubtotal, 32),
    cashRequiredNow: str(p.cashRequiredNow, 32),
    allocatedJobCost: str(p.allocatedJobCost, 32),
    recurring: p.recurringCharge ? { amount: str(p.recurringCharge.amount, 32), currency: str(p.recurringCharge.currency, 8), interval: str(p.recurringCharge.interval, 16) } : null,
    requestedTermCost: str(p.requestedTermCost, 32),
    packageCount: Number.isInteger(p.packageCount) ? p.packageCount : null,
    priceAppliesToRequest: str(p.pricingAppliesToRequest, 16),
    taxes: str(p.taxTreatment, 16),
    checkedAt: day(o.checkedAt),
    freshness: str(o.freshness, 16),
    sellerUrl: f?.url ?? str(o.productUrl, 500),
    nextStep: str(f?.mode, 40),
    sources,
    unmet: (o.requirementMatches || [])
      .filter((r) => r && r.result !== 'yes')
      .map((r) => ({ requirement: str(r.requirementId, 60), result: str(r.result, 16), required: !!r.required, note: str(r.explanation, 300) })),
  };
}

function offerLines(v, rank) {
  const lines = [`${rank}. ${v.title}${v.supplier && !v.title?.startsWith(v.supplier) ? ` (${v.supplier})` : ''} — ${ELIGIBILITY[v.eligibility] || v.eligibility}`];
  const price = [];
  if (v.priceForRequest != null) price.push(`${money(v.currency, v.priceForRequest)} for this request${v.packageCount > 1 ? ` (${v.packageCount} packs)` : v.packageCount === 1 ? ' (1 pack)' : ''}`);
  else if (v.referencePrice != null) price.push(`listed at ${money(v.currency, v.referencePrice)}${v.recurring ? PER[v.recurring.interval] || '' : ''}${v.priceAppliesToRequest === 'no' ? ', but that listing does not cover this request' : ', not confirmed for this request'}`);
  else price.push('no published price for this configuration');
  if (v.allocatedJobCost != null && v.allocatedJobCost !== v.priceForRequest) price.push(`cost allocated to this job ${money(v.currency, v.allocatedJobCost)}`);
  if (v.cashRequiredNow != null) price.push(`cash needed now ${money(v.currency, v.cashRequiredNow)}`);
  if (v.recurring && v.priceForRequest != null) price.push(`renews at ${money(v.recurring.currency, v.recurring.amount)}${PER[v.recurring.interval] || ''}, not locked`);
  if (v.requestedTermCost != null) price.push(`for the requested term ${money(v.currency, v.requestedTermCost)}`);
  if (v.taxes === 'included') price.push('taxes included');
  lines.push(`   ${price.join(' · ')}`);
  for (const u of v.unmet.slice(0, 5)) lines.push(`   ${u.result === 'no' ? '✗' : '?'} ${u.requirement} (${u.result})${u.note ? `: ${u.note}` : ''}`);
  lines.push(`   checked ${v.checkedAt || 'unknown'}${v.freshness && v.freshness !== 'fresh' ? ` (${v.freshness})` : ''} · ${v.sellerUrl || ''}`.trimEnd());
  return lines;
}

function headline(category, request) {
  const s = request?.specifications || {};
  if (category === 'email_verification') return `email verification for ${Number(s.count).toLocaleString('en-US')} emails`;
  if (category === 'sound_effects') return `sound effect packs for ${s.intent === 'any' ? 'any use' : `${s.intent} sounds`}, ${s.seats} seat${s.seats === 1 ? '' : 's'}`;
  if (category === 'font_license') {
    const traffic = s.licenseUse === 'desktop' ? '' : `, ${Number(s.monthlyPageviews).toLocaleString('en-US')} ${s.trafficMetric === 'uv' ? 'unique visitors' : 'pageviews'}/month per site, ${s.websites} site${s.websites === 1 ? '' : 's'}`;
    return `font licences for ${s.licenseUse} use, ${s.seats} user${s.seats === 1 ? '' : 's'}${traffic}, ${s.termYears} year${s.termYears === 1 ? '' : 's'}`;
  }
  return category;
}

export function summarizeQuote(q, sent, { base, lang: lng }) {
  const category = q.categoryId || sent.categoryId;
  const offers = new Map((q.offers || []).map((o) => [o.id, o]));
  const used = new Set();
  const groups = [];
  const text = [];
  const sum = q.summary || {};
  text.push(`Formquote · ${headline(category, sent)} · goal: ${GOAL_LABEL[sent.comparisonGoal] || sent.comparisonGoal}`);
  text.push(
    `${sum.offerCount ?? offers.size} offers from ${sum.supplierCount ?? '?'} suppliers: ${sum.eligibleCount ?? 0} eligible, ${sum.conditionalCount ?? 0} conditional, ${sum.ineligibleCount ?? 0} not eligible. Result: ${q.status}.`,
  );
  text.push(DISCLAIMER);
  const ineligible = [];
  for (const g of q.groups || []) {
    const ids = (g.offerIds || []).filter((id) => offers.has(id));
    ids.forEach((id) => used.add(id));
    const views = ids.map((id) => offerView(offers.get(id)));
    groups.push({
      key: str(g.key, 120),
      currency: str(g.currency, 8),
      billingPeriod: str(g.billingPeriod, 16),
      ranking: str(g.rankingMetric, 32),
      comparableFinalTotal: !!g.comparableFinalTotal,
      offerIds: views.map((v) => v.id),
    });
    const shown = views.filter((v) => v.eligibility !== 'ineligible');
    ineligible.push(...views.filter((v) => v.eligibility === 'ineligible'));
    if (!shown.length) continue;
    text.push('');
    text.push(`${PERIOD[g.billingPeriod] || 'Billing period unconfirmed'} · ${g.currency && g.currency !== 'unknown' ? g.currency : 'currency unconfirmed'} · ${RANK[g.rankingMetric] || g.rankingMetric}`);
    shown.forEach((v, i) => text.push(...offerLines(v, i + 1)));
  }
  const rest = [...offers.keys()].filter((id) => !used.has(id)).map((id) => offerView(offers.get(id)));
  const restShown = rest.filter((v) => v.eligibility !== 'ineligible');
  ineligible.push(...rest.filter((v) => v.eligibility === 'ineligible'));
  if (restShown.length) {
    text.push('', 'Other offers');
    restShown.forEach((v, i) => text.push(...offerLines(v, i + 1)));
  }
  if (ineligible.length) {
    text.push('', 'Not eligible for this request:');
    for (const v of ineligible) {
      const no = v.unmet.filter((u) => u.result === 'no');
      const why = no.find((u) => u.note)?.note;
      text.push(`- ${v.title}${v.supplier && !v.title?.startsWith(v.supplier) ? ` (${v.supplier})` : ''}: ${no.map((u) => u.requirement).join(', ') || 'see notes'}${why ? ` — ${why.slice(0, 160)}` : ''}`);
    }
  }
  if (!(sum.eligibleCount ?? 0) && !(sum.conditionalCount ?? 0)) {
    text.push('', 'None of the offers Formquote lists fits this request. Formquote covers only the items in list_formquote_catalog, so say that plainly rather than suggesting one of these.');
  }
  if ((q.missingInputs || []).length) text.push('', `Missing inputs: ${q.missingInputs.map((x) => str(x, 60)).join(', ')}`);
  if ((q.supplierErrors || []).length) text.push('', `Some suppliers could not be evaluated (${q.supplierErrors.length}).`);
  const link = pageUrl(base, category, lng);
  text.push('', `Notes marked ✗/? are Formquote’s own (often in Chinese). Groups in different currencies or billing periods are not comparable totals.`);
  text.push(`Compare on Formquote: ${link}`);

  const views = [...offers.values()].map(offerView);
  const structured = {
    category,
    status: str(q.status, 16),
    generatedAt: str(q.generatedAt, 40),
    request: { specifications: sent.specifications, usageContext: sent.usageContext, purchaseContext: sent.purchaseContext, comparisonGoal: sent.comparisonGoal },
    summary: { offers: sum.offerCount, suppliers: sum.supplierCount, eligible: sum.eligibleCount, conditional: sum.conditionalCount, ineligible: sum.ineligibleCount },
    groups,
    offers: views,
    missingInputs: (q.missingInputs || []).map((x) => str(x, 60)),
    supplierErrors: (q.supplierErrors || []).length,
    formquoteUrl: link,
    notice: DISCLAIMER,
  };
  return { text: text.join('\n'), structured, hasMatch: (sum.eligibleCount ?? 0) + (sum.conditionalCount ?? 0) > 0 };
}

export function summarizeCatalog(c, { base, lang: lng, category }) {
  const items = Array.isArray(c.items) ? c.items : [];
  const byCat = new Map();
  for (const it of items) {
    const k = it.categoryId;
    if (!byCat.has(k)) byCat.set(k, []);
    byCat.get(k).push({
      id: str(it.id, 120),
      title: cleanTitle(it.title),
      supplier: str(it.supplier?.name, 120),
      price: it.price?.amount != null ? str(it.price.amount, 32) : null,
      currency: str(it.price?.currency, 8),
      billingPeriod: str(it.price?.billingPeriod, 16),
      taxes: str(it.price?.taxTreatment, 16),
      checkedAt: day(it.checkedAt),
      url: str(it.productUrl, 500),
    });
  }
  const NAMES = { email_verification: 'Email verification', sound_effects: 'Sound effect packs', font_license: 'Font licences' };
  const text = [`Formquote catalogue: ${items.length} items from ${c.supplierCount ?? '?'} suppliers. ${DISCLAIMER}`];
  for (const [k, list] of byCat) {
    text.push('', `${NAMES[k] || k} — ${pageUrl(base, k, lng)}`);
    for (const v of list) {
      const price = v.price != null ? `${v.currency} ${v.price}${PER[v.billingPeriod] || (v.billingPeriod === 'one_time' ? ' one-time' : '')}` : 'price depends on the configuration chosen at the seller';
      text.push(`- ${v.title}${v.supplier && !v.title?.startsWith(v.supplier) ? ` (${v.supplier})` : ''}: ${price} · checked ${v.checkedAt || 'unknown'} · ${v.url || ''}`.trimEnd());
    }
  }
  return {
    text: text.join('\n'),
    structured: { category: category || null, itemCount: items.length, suppliers: c.supplierCount ?? null, categories: Object.fromEntries(byCat), formquoteUrl: pageUrl(base, category, lng), notice: DISCLAIMER },
  };
}

// ---------- Calling ----------
export const CATEGORY_OF = {
  compare_email_verification_prices: 'email_verification',
  compare_sound_effects_licenses: 'sound_effects',
  compare_font_licenses: 'font_license',
  list_formquote_catalog: 'catalog',
};
const fail = (message, category, outcome) => ({ content: [{ type: 'text', text: message }], isError: true, _count: { category, outcome } });

export async function callTool(client, name, args) {
  const def = toolList().find((t) => t.name === name);
  const category = CATEGORY_OF[name];
  const checked = validate(def.inputSchema, args);
  if (checked.error) return fail(`Invalid input: ${checked.error}`, category, 'invalid_input');
  const a = checked.value;
  const note = checked.ignored?.length ? `\n\n(Ignored unknown argument${checked.ignored.length > 1 ? 's' : ''}: ${checked.ignored.join(', ')}.)` : '';
  try {
    if (name === 'list_formquote_catalog') {
      const c = await client.catalog(a.category);
      const s = summarizeCatalog(c, { base: client.base, lang: a.lang, category: a.category });
      return { content: [{ type: 'text', text: s.text + note }], structuredContent: s.structured, _count: { category, outcome: 'ok' } };
    }
    const sent = quoteRequest(name, a);
    const q = await client.quote(sent);
    const s = summarizeQuote(q, sent, { base: client.base, lang: a.lang });
    return { content: [{ type: 'text', text: s.text + note }], structuredContent: s.structured, _count: { category, outcome: s.hasMatch ? 'ok' : 'no_match' } };
  } catch (e) {
    if (e instanceof UpstreamError) return fail(e.message, category, e.kind);
    return fail('Something went wrong while reading the Formquote answer. Try again later.', category, 'error');
  }
}
