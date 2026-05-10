import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const PROXY = 'http://localhost:3001';
const PER_PAGE = 12;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const stars = (r = 0) => {
  const full = Math.floor(r);
  const half = r % 1 >= 0.5;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - (half ? 1 : 0));
};
const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cls = (...args) => args.filter(Boolean).join(' ');

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
function Pill({ label, count, active, onClick }) {
  return (
    <button className={cls('pill', active && 'pill--active')} onClick={onClick}>
      <span>{label}</span>
      {count !== undefined && <span className="pill__count">{count}</span>}
    </button>
  );
}

function ProductCard({ product, highlight }) {
  const titleHtml = highlight?.title?.[0] || null;
  const descHtml = highlight?.description?.[0] || null;
  const rating = product.rating || 0;
  const isHot = rating >= 4.5;
  const isPopular = (product.reviews_count || 0) > 1000;

  return (
    <article className="card">
      <div className="card__badges">
        {isHot && <span className="badge badge--hot">🔥 Hot</span>}
        {isPopular && <span className="badge badge--pop">📈 Trending</span>}
      </div>

      <div className="card__category">{product.category}</div>

      <h3 className="card__title">
        {titleHtml
          ? <span dangerouslySetInnerHTML={{ __html: titleHtml }} />
          : product.title}
      </h3>

      <div className="card__brand">{product.brand || 'Generic'}</div>

      {(descHtml || product.description) && (
        <p className="card__desc">
          {descHtml
            ? <span dangerouslySetInnerHTML={{ __html: descHtml }} />
            : (product.description || '').slice(0, 100) + '…'}
        </p>
      )}

      <div className="card__footer">
        <div className="card__rating">
          <span className="stars" title={`${rating.toFixed(1)} stars`}>{stars(rating)}</span>
          <span className="card__reviews">({(product.reviews_count || 0).toLocaleString()})</span>
        </div>
        <div className="card__price">${fmt(product.price)}</div>
      </div>
    </article>
  );
}

function Pagination({ current, total, onChange }) {
  if (total <= 1) return null;
  const pages = [];
  let start = Math.max(0, current - 2);
  let end = Math.min(total - 1, start + 4);
  if (end - start < 4) start = Math.max(0, end - 4);

  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <nav className="pagination" aria-label="Search results pages">
      <button className="pg-btn" onClick={() => onChange(0)} disabled={current === 0} title="First">«</button>
      <button className="pg-btn" onClick={() => onChange(current - 1)} disabled={current === 0} title="Previous">‹</button>
      {start > 0 && <span className="pg-ellipsis">…</span>}
      {pages.map(p => (
        <button
          key={p}
          className={cls('pg-btn', p === current && 'pg-btn--active')}
          onClick={() => onChange(p)}
        >
          {p + 1}
        </button>
      ))}
      {end < total - 1 && <span className="pg-ellipsis">…</span>}
      <button className="pg-btn" onClick={() => onChange(current + 1)} disabled={current === total - 1} title="Next">›</button>
      <button className="pg-btn" onClick={() => onChange(total - 1)} disabled={current === total - 1} title="Last">»</button>
    </nav>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [ratingMin, setRatingMin] = useState('');

  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [highlights, setHighlights] = useState({});
  const [cats, setCats] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const [history, setHistory] = useState([]);

  const debounceRef = useRef(null);
  const sugDebounceRef = useRef(null);
  const inputRef = useRef(null);

  // ── Search ──────────────────────────────────────────────────────────────────
  const search = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const fq = [];
      if (catFilter) fq.push(`category:${catFilter}`);
      if (brandFilter) fq.push(`brand:${brandFilter}`);
      if (priceMin || priceMax) fq.push(`price:[${priceMin || '*'} TO ${priceMax || '*'}]`);
      if (ratingMin) fq.push(`rating:[${ratingMin} TO 5]`);

      const params = {
        q: query || '*:*',
        start: page * PER_PAGE,
        rows: PER_PAGE,
        ...(sort && { sort }),
        ...(fq.length && { fq }),
      };

      const { data } = await axios.get(`${PROXY}/search`, { params });

      setResults(data.response?.docs || []);
      setTotal(data.response?.numFound || 0);
      setHighlights(data.highlighting || {});

      const ff = data.facet_counts?.facet_fields || {};
      const parseFacet = (arr = []) => {
        const out = [];
        for (let i = 0; i < arr.length; i += 2) out.push({ name: arr[i], count: arr[i + 1] });
        return out;
      };
      setCats(parseFacet(ff.category));
      setBrands(parseFacet(ff.brand));
    } catch (e) {
      const solrDetail = e.response?.data?.details?.msg
                      || e.response?.data?.details
                      || e.response?.data?.error
                      || e.message;
      const hint = e.response?.data?.hint || '';
      setError(typeof solrDetail === 'object' ? JSON.stringify(solrDetail) : `${solrDetail}${hint ? ' — ' + hint : ''}`);
      setResults([]);
    }
    setLoading(false);
  }, [query, page, sort, catFilter, brandFilter, priceMin, priceMax, ratingMin]);

  // Debounced real-time search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(search, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // ── Autocomplete ─────────────────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (val) => {
    if (val.length < 2) { setSuggestions([]); return; }
    try {
      const { data } = await axios.get(`${PROXY}/suggest`, { params: { q: val } });
      setSuggestions(data.suggestions || []);
      if ((data.suggestions || []).length) setShowSug(true);
    } catch { setSuggestions([]); }
  }, []);

  const onInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    clearTimeout(sugDebounceRef.current);
    sugDebounceRef.current = setTimeout(() => fetchSuggestions(val), 250);
  };

  const commit = (term) => {
    const t = term.trim();
    setInput(t);
    setQuery(t);
    setPage(0);
    setShowSug(false);
    if (t) setHistory(prev => [t, ...prev.filter(x => x !== t)].slice(0, 6));
  };

  const onKey = (e) => {
    if (e.key === 'Enter') commit(input);
    if (e.key === 'Escape') setShowSug(false);
  };

  const clearAll = () => {
    setInput(''); setQuery(''); setPage(0); setSort('');
    setCatFilter(''); setBrandFilter('');
    setPriceMin(''); setPriceMax(''); setRatingMin('');
    setSuggestions([]); setShowSug(false);
    inputRef.current?.focus();
  };

  const totalPages = Math.ceil(total / PER_PAGE);
  const hasFilters = catFilter || brandFilter || priceMin || priceMax || ratingMin;

  return (
    <>
      {/* ── Global Styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:        #0a0c12;
          --surface:   #111420;
          --surface2:  #191d2e;
          --surface3:  #1f2438;
          --border:    rgba(255,255,255,0.07);
          --border2:   rgba(255,255,255,0.13);
          --accent:    #6d78ff;
          --accent2:   #a78bfa;
          --glow:      rgba(109,120,255,0.25);
          --text:      #e8eaf6;
          --muted:     #8b92b8;
          --faint:     #4a5080;
          --hot:       #ff6b6b;
          --pop:       #fbbf24;
          --green:     #34d399;
          --font-head: 'Space Grotesk', sans-serif;
          --font-body: 'DM Sans', sans-serif;
          --radius:    12px;
          --radius-sm: 8px;
          --radius-xs: 5px;
          --trans:     all 0.18s ease;
        }

        body {
          background: var(--bg);
          color: var(--text);
          font-family: var(--font-body);
          font-size: 15px;
          line-height: 1.6;
          min-height: 100vh;
        }

        /* ── Layout ── */
        .app { max-width: 1440px; margin: 0 auto; padding: 0 24px 60px; }

        /* ── Header ── */
        .header {
          padding: 48px 0 36px;
          text-align: center;
          position: relative;
        }
        .header::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 60% 50% at 50% 0%, rgba(109,120,255,0.12) 0%, transparent 70%);
          pointer-events: none;
        }
        .header__eyebrow {
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--accent);
          font-weight: 600;
          margin-bottom: 12px;
        }
        .header__title {
          font-family: var(--font-head);
          font-size: clamp(2rem, 5vw, 3.2rem);
          font-weight: 700;
          background: linear-gradient(135deg, #fff 30%, var(--accent2));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1.15;
          margin-bottom: 12px;
        }
        .header__sub { color: var(--muted); font-size: 15px; }

        /* ── Search shell ── */
        .search-shell {
          background: var(--surface);
          border: 1px solid var(--border2);
          border-radius: 18px;
          padding: 20px 20px 16px;
          margin-bottom: 28px;
          box-shadow: 0 0 0 1px transparent, 0 4px 40px rgba(0,0,0,0.5);
          transition: var(--trans);
        }
        .search-shell:focus-within {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--glow), 0 4px 40px rgba(0,0,0,0.5);
        }

        /* ── Search bar ── */
        .search-bar {
          display: flex;
          gap: 10px;
          align-items: center;
          position: relative;
        }
        .search-icon {
          color: var(--muted);
          font-size: 18px;
          flex-shrink: 0;
          margin-left: 4px;
        }
        .search-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-family: var(--font-body);
          font-size: 17px;
          color: var(--text);
          padding: 6px 0;
          caret-color: var(--accent);
        }
        .search-input::placeholder { color: var(--faint); }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 18px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border2);
          cursor: pointer;
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 500;
          transition: var(--trans);
          white-space: nowrap;
        }
        .btn--primary {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
          box-shadow: 0 0 16px var(--glow);
        }
        .btn--primary:hover { background: #7d87ff; box-shadow: 0 0 24px var(--glow); }
        .btn--ghost {
          background: transparent;
          color: var(--muted);
        }
        .btn--ghost:hover { color: var(--text); background: var(--surface2); }

        /* ── Suggestions ── */
        .sug-wrap {
          position: relative;
        }
        .suggestions {
          position: absolute;
          left: 0; right: 0;
          top: calc(100% + 8px);
          background: var(--surface2);
          border: 1px solid var(--border2);
          border-radius: var(--radius);
          overflow: hidden;
          z-index: 200;
          box-shadow: 0 8px 40px rgba(0,0,0,0.6);
        }
        .sug-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 16px;
          cursor: pointer;
          color: var(--text);
          transition: background 0.12s;
          font-size: 14px;
          border-bottom: 1px solid var(--border);
        }
        .sug-item:last-child { border-bottom: none; }
        .sug-item:hover { background: var(--surface3); }
        .sug-item__icon { color: var(--accent); font-size: 13px; }

        /* ── History chips ── */
        .history {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid var(--border);
          align-items: center;
        }
        .history__label { font-size: 12px; color: var(--faint); }
        .chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 20px;
          background: var(--surface2);
          border: 1px solid var(--border);
          font-size: 12px;
          color: var(--muted);
          cursor: pointer;
          transition: var(--trans);
        }
        .chip:hover { border-color: var(--accent); color: var(--text); }

        /* ── Controls bar ── */
        .controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          padding: 12px 0 4px;
          border-top: 1px solid var(--border);
          margin-top: 14px;
        }
        .results-meta { font-size: 13px; color: var(--muted); }
        .results-meta strong { color: var(--text); }
        .results-meta .qterm { color: var(--accent); }

        .sort-select {
          background: var(--surface2);
          border: 1px solid var(--border2);
          border-radius: var(--radius-sm);
          color: var(--text);
          padding: 7px 12px;
          font-family: var(--font-body);
          font-size: 13px;
          cursor: pointer;
          outline: none;
          transition: var(--trans);
        }
        .sort-select:hover, .sort-select:focus { border-color: var(--accent); }

        /* ── Main layout ── */
        .main { display: flex; gap: 28px; align-items: flex-start; }

        /* ── Sidebar ── */
        .sidebar {
          width: 240px;
          flex-shrink: 0;
          position: sticky;
          top: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .panel {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 16px;
          overflow: hidden;
        }
        .panel__title {
          font-family: var(--font-head);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--faint);
          margin-bottom: 12px;
        }

        .pill {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          width: 100%;
          padding: 7px 10px;
          margin-bottom: 4px;
          border-radius: var(--radius-xs);
          border: 1px solid transparent;
          background: transparent;
          color: var(--muted);
          font-family: var(--font-body);
          font-size: 13px;
          cursor: pointer;
          text-align: left;
          transition: var(--trans);
        }
        .pill:hover { background: var(--surface2); color: var(--text); border-color: var(--border); }
        .pill--active {
          background: rgba(109,120,255,0.15);
          border-color: rgba(109,120,255,0.4);
          color: #a5aaff;
        }
        .pill__count {
          font-size: 11px;
          background: var(--surface3);
          border-radius: 20px;
          padding: 1px 7px;
          color: var(--faint);
        }
        .pill--active .pill__count {
          background: rgba(109,120,255,0.25);
          color: var(--accent);
        }

        /* Price range */
        .price-row { display: flex; gap: 8px; align-items: center; }
        .price-input {
          flex: 1;
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: var(--radius-xs);
          color: var(--text);
          padding: 7px 10px;
          font-family: var(--font-body);
          font-size: 13px;
          outline: none;
          min-width: 0;
          transition: var(--trans);
        }
        .price-input:focus { border-color: var(--accent); }
        .price-input::placeholder { color: var(--faint); }
        .price-sep { color: var(--faint); font-size: 13px; flex-shrink: 0; }

        /* Star rating filter */
        .star-option {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
          border-radius: var(--radius-xs);
          border: 1px solid transparent;
          background: transparent;
          color: var(--muted);
          font-size: 13px;
          cursor: pointer;
          width: 100%;
          transition: var(--trans);
          margin-bottom: 3px;
        }
        .star-option:hover { background: var(--surface2); }
        .star-option--active { background: rgba(251,191,36,0.1); border-color: rgba(251,191,36,0.3); color: #fbbf24; }
        .star-option .stars { font-size: 12px; color: var(--pop); }

        /* Active filter tags */
        .active-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 4px;
        }
        .filter-tag {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px 3px 8px;
          background: rgba(109,120,255,0.12);
          border: 1px solid rgba(109,120,255,0.3);
          border-radius: 20px;
          font-size: 12px;
          color: #a5aaff;
          cursor: pointer;
        }
        .filter-tag:hover { background: rgba(109,120,255,0.2); }
        .filter-tag__x { font-size: 14px; line-height: 1; }

        /* ── Results ── */
        .results { flex: 1; min-width: 0; }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 18px;
          margin-bottom: 32px;
        }

        /* ── Card ── */
        .card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: var(--trans);
          position: relative;
          overflow: hidden;
        }
        .card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(135deg, rgba(109,120,255,0.04) 0%, transparent 60%);
          opacity: 0;
          transition: opacity 0.18s;
          pointer-events: none;
        }
        .card:hover {
          border-color: var(--border2);
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .card:hover::before { opacity: 1; }

        .card__badges { display: flex; gap: 6px; }
        .badge {
          font-size: 10px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 20px;
          letter-spacing: 0.04em;
        }
        .badge--hot { background: rgba(255,107,107,0.15); color: var(--hot); border: 1px solid rgba(255,107,107,0.3); }
        .badge--pop { background: rgba(251,191,36,0.15); color: var(--pop); border: 1px solid rgba(251,191,36,0.3); }

        .card__category {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--accent2);
          font-weight: 500;
        }
        .card__title {
          font-family: var(--font-head);
          font-size: 15px;
          font-weight: 600;
          color: var(--text);
          line-height: 1.4;
          flex: 1;
        }
        .card__title mark {
          background: rgba(109,120,255,0.25);
          color: #b5baff;
          border-radius: 3px;
          padding: 0 2px;
        }
        .card__brand { font-size: 12px; color: var(--faint); }
        .card__desc {
          font-size: 13px;
          color: var(--muted);
          line-height: 1.55;
          flex: 1;
        }
        .card__desc mark {
          background: rgba(109,120,255,0.2);
          color: #b5baff;
          border-radius: 2px;
          padding: 0 2px;
        }
        .card__footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: 4px;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }
        .card__rating { display: flex; align-items: center; gap: 6px; }
        .stars { color: var(--pop); font-size: 12px; letter-spacing: 1px; }
        .card__reviews { font-size: 11px; color: var(--faint); }
        .card__price {
          font-family: var(--font-head);
          font-size: 18px;
          font-weight: 700;
          color: var(--accent2);
        }

        /* ── States ── */
        .state-box {
          text-align: center;
          padding: 80px 20px;
          color: var(--faint);
        }
        .state-box__icon { font-size: 48px; margin-bottom: 16px; }
        .state-box__title { font-family: var(--font-head); font-size: 20px; color: var(--muted); margin-bottom: 8px; }
        .state-box__sub { font-size: 14px; }
        .error-box {
          background: rgba(255,107,107,0.08);
          border: 1px solid rgba(255,107,107,0.25);
          border-radius: var(--radius);
          padding: 16px 20px;
          color: var(--hot);
          font-size: 14px;
          margin-bottom: 20px;
        }

        /* ── Spinner ── */
        .spinner {
          display: inline-block;
          width: 36px; height: 36px;
          border: 3px solid var(--border2);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.75s linear infinite;
          margin: 0 auto 16px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Pagination ── */
        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .pg-btn {
          min-width: 36px; height: 36px;
          padding: 0 10px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--muted);
          font-family: var(--font-body);
          font-size: 14px;
          cursor: pointer;
          transition: var(--trans);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .pg-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--text); }
        .pg-btn:disabled { opacity: 0.3; cursor: default; }
        .pg-btn--active {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
          box-shadow: 0 0 12px var(--glow);
        }
        .pg-ellipsis { color: var(--faint); font-size: 14px; padding: 0 4px; }

        /* ── Divider ── */
        .divider { height: 1px; background: var(--border); margin: 10px 0; }

        /* ── Footer credit ── */
        .footer {
          text-align: center;
          margin-top: 60px;
          padding-top: 24px;
          border-top: 1px solid var(--border);
          color: var(--faint);
          font-size: 12px;
          letter-spacing: 0.04em;
        }
        .footer span { color: var(--accent); }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .main { flex-direction: column; }
          .sidebar { width: 100%; position: static; }
          .panel { display: none; }
          .panel.panel--mobile { display: block; }
        }
        @media (max-width: 600px) {
          .app { padding: 0 14px 40px; }
          .header { padding: 30px 0 24px; }
          .search-shell { padding: 14px; }
          .controls { flex-direction: column; align-items: flex-start; }
          .grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="app">
        {/* ── HEADER ── */}
        <header className="header">
          <p className="header__eyebrow">Apache Solr · Lab 13</p>
          <h1 className="header__title">Smart Product Search</h1>
          <p className="header__sub">Real-time · Faceted · Autocomplete · Highlighted</p>
        </header>

        {/* ── SEARCH SHELL ── */}
        <div className="search-shell">
          <div className="sug-wrap">
            <div className="search-bar">
              <span className="search-icon">⌕</span>
              <input
                ref={inputRef}
                className="search-input"
                type="text"
                value={input}
                placeholder="Search products — e.g. wireless headphones, laptop…"
                onChange={onInputChange}
                onKeyDown={onKey}
                onFocus={() => input.length >= 2 && suggestions.length && setShowSug(true)}
                onBlur={() => setTimeout(() => setShowSug(false), 180)}
                autoComplete="off"
                spellCheck="false"
              />
              <button className="btn btn--primary" onClick={() => commit(input)}>Search</button>
              {(input || hasFilters) && (
                <button className="btn btn--ghost" onClick={clearAll} title="Clear all">✕ Clear</button>
              )}
            </div>

            {showSug && suggestions.length > 0 && (
              <div className="suggestions" role="listbox">
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="sug-item"
                    role="option"
                    onMouseDown={() => commit(s)}
                  >
                    <span className="sug-item__icon">↗</span>
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History */}
          {history.length > 0 && !showSug && (
            <div className="history">
              <span className="history__label">Recent:</span>
              {history.map((h, i) => (
                <button key={i} className="chip" onClick={() => commit(h)}>⌛ {h}</button>
              ))}
            </div>
          )}

          {/* Controls bar */}
          <div className="controls">
            <div className="results-meta">
              {loading
                ? 'Searching…'
                : <>Found <strong>{total.toLocaleString()}</strong> results
                    {query && query !== '*:*' && <> for <span className="qterm">"{query}"</span></>}
                  </>
              }
            </div>
            <select
              className="sort-select"
              value={sort}
              onChange={e => { setSort(e.target.value); setPage(0); }}
            >
              <option value="">↕ Sort: Relevance</option>
              <option value="price asc">↑ Price: Low → High</option>
              <option value="price desc">↓ Price: High → Low</option>
              <option value="rating desc">★ Rating: Best first</option>
              <option value="reviews_count desc">💬 Most Reviewed</option>
            </select>
          </div>
        </div>

        {/* ── ACTIVE FILTERS ── */}
        {hasFilters && (
          <div className="active-filters" style={{ marginBottom: 16 }}>
            {catFilter && <button className="filter-tag" onClick={() => { setCatFilter(''); setPage(0); }}>📁 {catFilter} <span className="filter-tag__x">×</span></button>}
            {brandFilter && <button className="filter-tag" onClick={() => { setBrandFilter(''); setPage(0); }}>🏷 {brandFilter} <span className="filter-tag__x">×</span></button>}
            {(priceMin || priceMax) && <button className="filter-tag" onClick={() => { setPriceMin(''); setPriceMax(''); setPage(0); }}>${priceMin || '0'} – ${priceMax || '∞'} <span className="filter-tag__x">×</span></button>}
            {ratingMin && <button className="filter-tag" onClick={() => { setRatingMin(''); setPage(0); }}>★ {ratingMin}+ stars <span className="filter-tag__x">×</span></button>}
          </div>
        )}

        {/* ── MAIN ── */}
        <div className="main">
          {/* SIDEBAR */}
          <aside className="sidebar">
            {/* Categories */}
            {cats.length > 0 && (
              <div className="panel">
                <div className="panel__title">Categories</div>
                <Pill label="All" active={!catFilter} onClick={() => { setCatFilter(''); setPage(0); }} />
                {cats.map(c => (
                  <Pill key={c.name} label={c.name} count={c.count}
                    active={catFilter === c.name}
                    onClick={() => { setCatFilter(catFilter === c.name ? '' : c.name); setPage(0); }}
                  />
                ))}
              </div>
            )}

            {/* Brands */}
            {brands.length > 0 && (
              <div className="panel">
                <div className="panel__title">Brands</div>
                <Pill label="All" active={!brandFilter} onClick={() => { setBrandFilter(''); setPage(0); }} />
                {brands.slice(0, 10).map(b => (
                  <Pill key={b.name} label={b.name} count={b.count}
                    active={brandFilter === b.name}
                    onClick={() => { setBrandFilter(brandFilter === b.name ? '' : b.name); setPage(0); }}
                  />
                ))}
              </div>
            )}

            {/* Price */}
            <div className="panel">
              <div className="panel__title">Price Range</div>
              <div className="price-row">
                <input className="price-input" type="number" placeholder="Min $" value={priceMin}
                  onChange={e => { setPriceMin(e.target.value); setPage(0); }} />
                <span className="price-sep">–</span>
                <input className="price-input" type="number" placeholder="Max $" value={priceMax}
                  onChange={e => { setPriceMax(e.target.value); setPage(0); }} />
              </div>
            </div>

            {/* Rating */}
            <div className="panel">
              <div className="panel__title">Min Rating</div>
              <button className={cls('star-option', !ratingMin && 'star-option--active')}
                onClick={() => { setRatingMin(''); setPage(0); }}>Any rating</button>
              {[4, 3, 2, 1].map(r => (
                <button key={r}
                  className={cls('star-option', ratingMin === String(r) && 'star-option--active')}
                  onClick={() => { setRatingMin(ratingMin === String(r) ? '' : String(r)); setPage(0); }}>
                  <span className="stars">{'★'.repeat(r)}</span> {r}+ stars
                </button>
              ))}
            </div>
          </aside>

          {/* RESULTS */}
          <section className="results">
            {error && (
              <div className="error-box">
                <strong>⚠ Search error</strong><br />
                <span style={{fontSize:13,opacity:0.85}}>{error}</span><br /><br />
                <span style={{fontSize:12,opacity:0.7}}>
                  Debug steps:<br />
                  1. Open <code>http://localhost:3001/health</code> — should say "ok"<br />
                  2. Open <code>http://localhost:3001/schema</code> — lists your Solr fields<br />
                  3. Open <code>http://localhost:3001/search?q=*:*</code> — raw Solr response<br />
                  4. Check the proxy terminal window for the exact error
                </span>
              </div>
            )}

            {loading ? (
              <div className="state-box">
                <div className="spinner" />
                <div style={{ color: 'var(--muted)', fontSize: 14 }}>Searching Solr…</div>
              </div>
            ) : results.length === 0 ? (
              <div className="state-box">
                <div className="state-box__icon">🔍</div>
                <div className="state-box__title">No products found</div>
                <div className="state-box__sub">Try a different search term or adjust your filters</div>
              </div>
            ) : (
              <>
                <div className="grid">
                  {results.map(p => (
                    <ProductCard key={p.id} product={p} highlight={highlights[p.id]} />
                  ))}
                </div>
                <Pagination current={page} total={totalPages} onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
              </>
            )}
          </section>
        </div>

        {/* ── FOOTER ── */}
        <footer className="footer">
          Lab 13 · Open Ended Lab · Solr Search UI · Built with <span>React + Vite + Axios</span>
        </footer>
      </div>
    </>
  );
}