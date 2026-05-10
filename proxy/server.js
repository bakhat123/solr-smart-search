const express = require('express');
const axios   = require('axios');
const cors    = require('cors');

const app = express();

// ── CHANGE THIS if your Solr core is named differently ──────────────────────
const SOLR_BASE = 'http://localhost:8983/solr/products';
// ────────────────────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// ── Helper: ask Solr which fields actually exist in this core ───────────────
let knownFields = null;

async function getKnownFields() {
  if (knownFields) return knownFields;
  try {
    const { data } = await axios.get(`${SOLR_BASE}/schema/fields`, { timeout: 4000 });
    knownFields = new Set((data.fields || []).map(f => f.name));
    console.log('[Schema] Fields found:', [...knownFields].join(', '));
  } catch (e) {
    console.warn('[Schema] Could not read schema, will use safe defaults:', e.message);
    // Use your actual field names as defaults
    knownFields = new Set(['id', 'title', 'name', 'category', 'brand', 'price', 'rating', 'reviews_count', 'description', 'nest_path', 'root', 'text', 'version']);
  }
  return knownFields;
}

// ── SEARCH ──────────────────────────────────────────────────────────────────
app.get('/search', async (req, res) => {
  try {
    const fields = await getKnownFields();

    const {
      q     = '*:*',
      fq,
      sort,
      start = 0,
      rows  = 12,
    } = req.query;

    const params = new URLSearchParams();
    params.set('q',     q === '' ? '*:*' : q);
    params.set('wt',    'json');
    params.set('start', String(start));
    params.set('rows',  String(rows));

    // Filter queries
    if (fq) {
      const list = Array.isArray(fq) ? fq : [fq];
      list.forEach(f => { if (f) params.append('fq', f); });
    }

    // Sort (only if field exists in schema)
    if (sort) {
      const sortField = sort.split(' ')[0];
      if (fields.has(sortField)) {
        params.set('sort', sort);
      } else {
        console.warn(`[Sort] Field "${sortField}" not in schema – sort ignored`);
      }
    }
    
    // Check for your actual facet fields
    const facetCandidates = ['category', 'brand', 'nest_path', 'root'];
    const facetFields     = facetCandidates.filter(f => fields.has(f));

    if (facetFields.length > 0) {
      params.set('facet', 'true');
      params.set('facet.mincount', '1');
      params.set('facet.limit', '20');
      facetFields.forEach(f => params.append('facet.field', f));
    }

    // Highlighting – only on fields that actually exist
    const hlCandidates = ['title', 'name', 'text', 'description'];
    const hlFields     = hlCandidates.filter(f => fields.has(f));

    if (hlFields.length > 0) {
      params.set('hl',             'true');
      params.set('hl.fl',          hlFields.join(','));
      params.set('hl.simple.pre',  '<mark>');
      params.set('hl.simple.post', '</mark>');
      params.set('hl.snippets',    '2');
    }

    const solrUrl = `${SOLR_BASE}/select?${params.toString()}`;
    console.log('[Solr →]', solrUrl);

    const { data } = await axios.get(solrUrl, { timeout: 8000 });

    // Attach meta so the UI knows which fields were actually used
    data._meta = { facetFields, hlFields, allFields: [...fields] };

    res.json(data);

  } catch (err) {
    // Expose the REAL Solr error message so you can debug it
    const solrMsg = err.response?.data?.error?.msg
                 || err.response?.data
                 || err.message;

    console.error('[Search ERROR]', JSON.stringify(solrMsg, null, 2));
    res.status(500).json({
      error:    'Solr search failed',
      details:  solrMsg,
      solrBase: SOLR_BASE,
      hint:     'Check proxy terminal for the exact Solr URL attempted.',
    });
  }
});

// ── AUTOCOMPLETE ─────────────────────────────────────────────────────────────
app.get('/suggest', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ suggestions: [] });

    const fields = await getKnownFields();

    // Try your actual text fields first
    const textField = ['title', 'name', 'text'].find(f => fields.has(f)) || 'text';
    const safeQ     = q.replace(/[+\-!(){}[\]^"~*?:\\/]/g, '\\$&');

    const params = new URLSearchParams({
      q:    `${textField}:*${safeQ}*`,
      wt:   'json',
      rows: '8',
      fl:   ['id', textField].join(','),
    });

    const { data } = await axios.get(`${SOLR_BASE}/select?${params.toString()}`, { timeout: 3000 });
    const docs = data.response?.docs || [];
    const seen = new Set();
    const suggestions = [];

    for (const doc of docs) {
      const val = doc[textField] || doc.title || doc.name;
      if (val && !seen.has(val)) {
        seen.add(val);
        suggestions.push(val);
        if (suggestions.length >= 6) break;
      }
    }
    res.json({ suggestions });

  } catch (err) {
    console.error('[Suggest ERROR]', err.message);
    res.json({ suggestions: [] });
  }
});

// ── SCHEMA DEBUG (open in browser to see your fields) ────────────────────────
app.get('/schema', async (req, res) => {
  try {
    const { data } = await axios.get(`${SOLR_BASE}/schema/fields`, { timeout: 4000 });
    res.json({ fields: (data.fields || []).map(f => f.name).sort() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── HEALTH ───────────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await axios.get(`${SOLR_BASE}/select?q=*:*&rows=0&wt=json`, { timeout: 3000 });
    res.json({ status: 'ok', solr: SOLR_BASE });
  } catch (err) {
    res.status(503).json({ status: 'error', solr: SOLR_BASE, details: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n✅  Proxy running  →  http://localhost:${PORT}`);
  console.log(`📡  Solr target    →  ${SOLR_BASE}`);
  console.log(`\n🔍  Paste these in your browser to debug:`);
  console.log(`    Health : http://localhost:${PORT}/health`);
  console.log(`    Schema : http://localhost:${PORT}/schema`);
  console.log(`    Search : http://localhost:${PORT}/search?q=*:*\n`);
});