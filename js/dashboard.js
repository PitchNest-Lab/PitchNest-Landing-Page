// Premium analytics dashboard for PitchNest
// Uses existing Supabase anon client setup approach from survey.html

(() => {
  // =========================================================
  // CONFIG (edit these values only)
  // =========================================================
  const CONFIG = {
    supabaseUrl: 'https://oyztdulmyuklorbudcgb.supabase.co',
    supabaseAnonKey: 'sb_publishable_CaLHgxSy5OIXZWdYmViKkw_VGopUFjN',

    // Database targets
    table: 'waitlist',
    jsonField: 'frustration',

    // Admin access (Supabase Auth + admin_users verification)
    // NOTE: without Supabase RLS, you may still see unauthorized data.
    admin: {
      enabled: true
    }
  };


  const SUPABASE_URL = CONFIG.supabaseUrl;
  const SUPABASE_ANON_KEY = CONFIG.supabaseAnonKey;


  const supabaseClient = window.supabase?.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  // Supabase Auth gate elements (dashboard access)
  const root = document.getElementById('dashboardShell');
  const authGate = document.getElementById('authGate');
  const authStatusPill = document.getElementById('authStatusPill');
  const loginPanel = document.getElementById('loginPanel');
  const accessDeniedPanel = document.getElementById('accessDeniedPanel');
  const loggedInPanel = document.getElementById('loggedInPanel');
  const adminEmailLabel = document.getElementById('adminEmailLabel');
  const loginEmail = document.getElementById('loginEmail');
  const sendMagicLinkBtn = document.getElementById('sendMagicLinkBtn');
  const logoutBtn = document.getElementById('logoutBtn');


  const statusPill = document.getElementById('statusPill');
  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const emptyState = document.getElementById('emptyState');
  const responsesTbody = document.getElementById('responsesTbody');

  const metricTotal = document.getElementById('metricTotal');
  const metricToday = document.getElementById('metricToday');
  const metricWeek = document.getElementById('metricWeek');
  const metricConversion = document.getElementById('metricConversion');
  const metricConversionHint = document.getElementById('metricConversionHint');
  const metricRecent = document.getElementById('metricRecent');

  const dateRange = document.getElementById('dateRange');
  const searchText = document.getElementById('searchText');
  const filterPitchedBefore = document.getElementById('filterPitchedBefore');
  const filterWillPay = document.getElementById('filterWillPay');
  const applyFiltersBtn = document.getElementById('applyFiltersBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');

  const responseModal = document.getElementById('responseModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalTitle = document.getElementById('modalTitle');
  const modalSubtitle = document.getElementById('modalSubtitle');
  const modalContact = document.getElementById('modalContact');
  const modalFrustration = document.getElementById('modalFrustration');

  const chartIds = {
    submissions: 'chartSubmissions',
    biggestChallenge: 'chartBiggestChallenge',
    favoriteFeatures: 'chartFavoriteFeatures',
    splits: 'chartSplits',
    leadQuality: 'chartLeadQuality'
  };

  const charts = {};
  const subscriptions = [];

  const state = {
    unlocked: false,
    dateRange: '30d',
    search: '',
    filterPitchedBefore: 'all',
    filterWillPay: 'all',
    // Timestamp column detection will be done at runtime.
    // Common candidates:
    // - created_at (Postgres default)
    // - inserted_at
    // - submitted_at
    // If none exist, we will fall back to ordering by primary key (assumed id) but will note it.
    timestampColumn: 'created_at',
    lastFetchedAt: null,
    rows: []
  };

  function fmtNumber(n) {
    if (n === null || n === undefined) return '—';
    const num = Number(n);
    if (Number.isNaN(num)) return '—';
    return num.toLocaleString();
  }

  function fmtDateTime(isoOrDate) {
    if (!isoOrDate) return '—';
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  }

  function parseFrustration(frustrationStr) {
    if (!frustrationStr) return {};
    if (typeof frustrationStr === 'object') return frustrationStr;
    try {
      return JSON.parse(frustrationStr);
    } catch {
      return { raw: frustrationStr };
    }
  }

  function arrayify(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    return [v];
  }

  function getRangeStart(range) {
    const now = new Date();
    if (range === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (range === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (range === '90d') return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    return null; // all time
  }

  function normalizeFilters() {
    state.dateRange = dateRange?.value || '30d';
    state.search = (searchText?.value || '').trim();
    state.filterPitchedBefore = filterPitchedBefore?.value || 'all';
    state.filterWillPay = filterWillPay?.value || 'all';
  }

  function setLoading(on) {
    if (!loadingState || !errorState || !emptyState) return;
    loadingState.style.display = on ? 'block' : 'none';
  }

  function setError(msg) {
    if (!errorState) return;
    errorState.style.display = 'block';
    errorState.textContent = msg;
  }

  function clearError() {
    if (!errorState) return;
    errorState.style.display = 'none';
    errorState.textContent = '';
  }

  function setEmpty(on) {
    if (!emptyState) return;
    emptyState.style.display = on ? 'block' : 'none';
  }

  function destroyCharts() {
    for (const k of Object.keys(charts)) {
      try {
        charts[k]?.destroy?.();
      } catch {}
      charts[k] = null;
    }
  }

  function ensureCharts() {
    // Ensure canvases exist
    const Chart = window.Chart;
    if (!Chart) return;

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8' }
        },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.95)',
          titleColor: '#f8fafc',
          bodyColor: '#f8fafc'
        }
      },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(148,163,184,0.08)' } },
        y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(148,163,184,0.08)' } }
      }
    };

    // Submissions over time
    charts.submissions = new Chart(document.getElementById(chartIds.submissions), {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Submissions', data: [], borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,0.15)', tension: 0.25, fill: true }] },
      options: commonOptions
    });

    // Biggest challenge
    charts.biggestChallenge = new Chart(document.getElementById(chartIds.biggestChallenge), {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Count', data: [], backgroundColor: 'rgba(14,165,233,0.35)', borderColor: '#0ea5e9', borderWidth: 1 }] },
      options: commonOptions
    });

    // Favorite features
    charts.favoriteFeatures = new Chart(document.getElementById(chartIds.favoriteFeatures), {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Count', data: [], backgroundColor: 'rgba(99,102,241,0.35)', borderColor: '#6366f1', borderWidth: 1 }] },
      options: commonOptions
    });

    // Yes/no splits
    charts.splits = new Chart(document.getElementById(chartIds.splits), {
      type: 'doughnut',
      data: { labels: [], datasets: [{ data: [], backgroundColor: ['rgba(16,185,129,0.65)', 'rgba(239,68,68,0.65)', 'rgba(245,158,11,0.65)'] }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8' } },
          tooltip: { backgroundColor: 'rgba(15,23,42,0.95)', titleColor: '#f8fafc', bodyColor: '#f8fafc' }
        }
      }
    });

    // Lead quality proxy
    charts.leadQuality = new Chart(document.getElementById(chartIds.leadQuality), {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Count', data: [], backgroundColor: 'rgba(245,158,11,0.35)', borderColor: '#f59e0b', borderWidth: 1 }] },
      options: commonOptions
    });
  }

  function updateChartsFromRows(rows) {
    if (!rows?.length) {
      destroyCharts();
      ensureCharts();
      return;
    }

    // Submissions over time (daily buckets)
    const buckets = new Map();
    for (const r of rows) {
      const ts = r[state.timestampColumn];
      if (!ts) continue;
      const d = new Date(ts);
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    const labels = Array.from(buckets.keys()).sort();
    const data = labels.map(l => buckets.get(l) || 0);

    charts.submissions.data.labels = labels;
    charts.submissions.data.datasets[0].data = data;
    charts.submissions.update();

    // Biggest challenge
    const challengeCounts = new Map();
    for (const r of rows) {
      const f = parseFrustration(r.frustration);
      for (const val of arrayify(f.biggest_challenge)) {
        challengeCounts.set(val, (challengeCounts.get(val) || 0) + 1);
      }
    }
    const challengeSorted = Array.from(challengeCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
    charts.biggestChallenge.data.labels = challengeSorted.map(x => x[0]);
    charts.biggestChallenge.data.datasets[0].data = challengeSorted.map(x => x[1]);
    charts.biggestChallenge.update();

    // Favorite features
    const featureCounts = new Map();
    for (const r of rows) {
      const f = parseFrustration(r.frustration);
      for (const val of arrayify(f.favorite_feature)) {
        featureCounts.set(val, (featureCounts.get(val) || 0) + 1);
      }
    }
    const featureSorted = Array.from(featureCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
    charts.favoriteFeatures.data.labels = featureSorted.map(x => x[0]);
    charts.favoriteFeatures.data.datasets[0].data = featureSorted.map(x => x[1]);
    charts.favoriteFeatures.update();

    // Splits: pitched_before and will_pay (aggregate 3 slices)
    const splitCounts = {
      yes: 0,
      no: 0,
      willPay: 0
    };

    for (const r of rows) {
      const f = parseFrustration(r.frustration);
      const pitchedBefore = f.pitched_before;
      const willPay = f.will_pay;

      if (pitchedBefore === 'Yes') splitCounts.yes++;
      else if (pitchedBefore === 'No') splitCounts.no++;

      if (willPay === 'Yes') splitCounts.willPay++;
    }

    const splitLabels = ['Pitched before: Yes', 'Pitched before: No', 'Will pay: Yes'];
    const splitData = [splitCounts.yes, splitCounts.no, splitCounts.willPay];

    charts.splits.data.labels = splitLabels;
    charts.splits.data.datasets[0].data = splitData;
    charts.splits.update();

    // Lead quality proxy: valuable_rating distribution (1-5)
    const leadCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of rows) {
      const f = parseFrustration(r.frustration);
      const v = f.valuable_rating;
      const num = ({
        'Not Valuable': 1,
        'Slightly Valuable': 2,
        'Valuable': 3,
        'Very Valuable': 4,
        'Extremely Valuable': 5
      })[v];
      if (num) leadCounts[num]++;
    }
    const leadLabels = ['1', '2', '3', '4', '5'];
    const leadData = [1, 2, 3, 4, 5].map(n => leadCounts[n]);

    charts.leadQuality.data.labels = leadLabels;
    charts.leadQuality.data.datasets[0].data = leadData;
    charts.leadQuality.update();
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '<')
      .replaceAll('>', '>')
      .replaceAll('"', '"')
      .replaceAll("'", '&#039;');
  }

  function renderTableRows(rows) {
    if (!responsesTbody) return;
    responsesTbody.innerHTML = '';

    for (const r of rows) {
      const f = parseFrustration(r.frustration);
      const name = f.full_name || '—';
      const email = r.email || '—';
      const country = f.country || '—';
      const biggest = (arrayify(f.biggest_challenge) || []).join(', ');
      const willPay = f.will_pay || '—';
      const valuable = f.valuable_rating || '—';

      const tr = document.createElement('tr');
      tr.style.background = 'transparent';
      tr.innerHTML = `
        <td style="padding: 0.9rem 1rem; color: var(--text-secondary); font-weight:700; font-size:0.85rem;">${escapeHtml(fmtDateTime(r[state.timestampColumn]))}</td>
        <td style="padding: 0.9rem 1rem; color: var(--text-primary); font-weight:800; font-size:0.85rem;">${escapeHtml(name)}</td>
        <td style="padding: 0.9rem 1rem; color: var(--text-secondary); font-weight:700; font-size:0.85rem;">${escapeHtml(email)}</td>
        <td style="padding: 0.9rem 1rem; color: var(--text-secondary); font-weight:700; font-size:0.85rem;">${escapeHtml(country)}</td>
        <td style="padding: 0.9rem 1rem; color: var(--text-secondary); font-weight:700; font-size:0.85rem;">${escapeHtml(biggest)}</td>
        <td style="padding: 0.9rem 1rem; color: var(--text-secondary); font-weight:700; font-size:0.85rem;">${escapeHtml(willPay)}</td>
        <td style="padding: 0.9rem 1rem; color: var(--primary); font-weight:900; font-size:0.85rem;">${escapeHtml(valuable)}</td>
        <td style="padding: 0.9rem 1rem; text-align:right;">
          <button class="btn btn-outline" data-response-id="${escapeHtml(r.id ?? r.email)}" data-response-payload='${escapeHtml(JSON.stringify(r))}' style="padding:0.55rem 0.75rem; font-size:0.85rem;">View</button>
        </td>
      `;

      const btn = tr.querySelector('button[data-response-id]');
      btn.addEventListener('click', () => {
        openResponseModal(r);
      });

      responsesTbody.appendChild(tr);
    }
  }

  function openResponseModal(row) {
    if (!responseModal) return;
    const f = parseFrustration(row.frustration);

    modalTitle.textContent = f.full_name || '—';
    modalSubtitle.textContent = row.email || '—';
    modalContact.textContent = `${f.country || ''}`;
    modalFrustration.textContent = JSON.stringify(f, null, 2);

    responseModal.style.display = 'flex';
  }

  function closeResponseModal() {
    if (!responseModal) return;
    responseModal.style.display = 'none';
  }

  if (closeModalBtn) closeModalBtn.addEventListener('click', closeResponseModal);
  if (responseModal) {
    responseModal.addEventListener('click', (e) => {
      if (e.target === responseModal) closeResponseModal();
    });
  }

  function pickTimestampColumnFromRowKeys(row) {
    if (!row) return;
    const candidates = ['created_at', 'inserted_at', 'submitted_at', 'updated_at'];
    for (const c of candidates) {
      if (row[c]) {
        state.timestampColumn = c;
        return;
      }
    }
  }

  async function fetchRows() {
    if (!supabaseClient) throw new Error('Supabase client not available. Ensure supabase-js CDN is loaded.');

    normalizeFilters();
    clearError();
    setLoading(true);

    const rangeStart = getRangeStart(state.dateRange);

    // NOTE: We fetch a manageable recent window then apply some filters client-side.
    // This avoids having to know JSONB querying syntax.
    // If your table has many rows, add proper indexes + RLS.
    let query = supabaseClient
      .from('waitlist')
      .select('*')
      .order(state.timestampColumn, { ascending: false })
      .limit(500);

    if (rangeStart) {
      // We apply range on the detected timestamp column.
      query = query.gte(state.timestampColumn, rangeStart.toISOString());
    }

    // Search/filter by pitcher/will-pay in frustration JSON is done client-side.
    const { data, error } = await query;
    if (error) throw error;

    // Detect timestamp column from first row keys (best-effort)
    if (data?.length) {
      pickTimestampColumnFromRowKeys(data[0]);
    }

    let rows = data || [];

    // Client-side filters
    const q = state.search.toLowerCase();
    if (q) {
      rows = rows.filter(r => {
        const f = parseFrustration(r.frustration);
        const email = (r.email || '').toLowerCase();
        const name = (f.full_name || '').toLowerCase();
        const linkedin = (f.linkedin || '').toLowerCase();
        const country = (f.country || '').toLowerCase();
        return [email, name, linkedin, country].some(s => s.includes(q));
      });
    }

    if (state.filterPitchedBefore !== 'all') {
      rows = rows.filter(r => {
        const f = parseFrustration(r.frustration);
        return f.pitched_before === state.filterPitchedBefore;
      });
    }

    if (state.filterWillPay !== 'all') {
      rows = rows.filter(r => {
        const f = parseFrustration(r.frustration);
        return f.will_pay === state.filterWillPay;
      });
    }

    // Sort again by timestamp column (client-side) after filters
    rows.sort((a, b) => {
      const ta = new Date(a[state.timestampColumn] || 0).getTime();
      const tb = new Date(b[state.timestampColumn] || 0).getTime();
      return tb - ta;
    });

    return rows;
  }

  function computeAggregatesFromRows(rows) {
    const total = rows.length;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let today = 0;
    let week = 0;
    let mostRecent = null;

    for (const r of rows) {
      const ts = r[state.timestampColumn];
      if (!ts) continue;
      const d = new Date(ts);

      if (d >= todayStart) today++;
      if (d >= weekStart) week++;

      if (!mostRecent || d > new Date(mostRecent)) mostRecent = ts;
    }

    // Conversion rate: requires visit/form-start data.
    // This codebase currently only stores waitlist submissions.
    // We'll compute conversion as:
    // - If the same table contains fields that look like 'form_started' or similar, use them.
    // - Otherwise show N/A.
    let conversion = null;
    let conversionHint = '';

    const sample = rows[0] || {};
    const possible = ['form_start', 'started_at', 'visit_started', 'form_started', 'conversion_base'];
    const found = possible.find(k => sample[k] !== undefined);

    if (found) {
      // Placeholder: we’ll compute conversion = submissions / starts when starts exist.
      // Need consistent schema; leaving as derived best-effort.
      const startCount = rows.filter(r => r[found]).length;
      conversion = startCount ? (total / startCount) * 100 : null;
      conversionHint = `Derived from ${found}.`;
    } else {
      conversionHint = 'Conversion rate requires visit/form-start data (not found in current waitlist submission schema).';
    }

    return { total, today, week, mostRecent, conversion, conversionHint };
  }

  async function refreshDashboard() {
    if (!state.unlocked) return;
    setLoading(true);
    statusPill.textContent = 'Refreshing…';
    statusPill.style.color = 'var(--text-secondary)';
    clearError();

    try {
      const rows = await fetchRows();
      state.rows = rows;

      setEmpty(!rows.length);
      renderTableRows(rows);
      updateChartsFromRows(rows);

      const agg = computeAggregatesFromRows(rows);
      metricTotal.textContent = fmtNumber(agg.total);
      metricToday.textContent = fmtNumber(agg.today);
      metricWeek.textContent = fmtNumber(agg.week);
      metricRecent.textContent = fmtDateTime(agg.mostRecent);

      if (agg.conversion == null) {
        metricConversion.textContent = '—';
        metricConversionHint.textContent = agg.conversionHint;
      } else {
        metricConversion.textContent = `${agg.conversion.toFixed(1)}%`;
        metricConversionHint.textContent = agg.conversionHint;
      }

      setLoading(false);
      statusPill.textContent = rows.length ? 'Live' : 'Live (empty)';
      statusPill.style.color = rows.length ? '#10b981' : 'var(--text-secondary)';
    } catch (e) {
      setLoading(false);
      statusPill.textContent = 'Error';
      statusPill.style.color = '#ef4444';
      setError(e?.message || 'Failed to load analytics.');
    }
  }

  async function exportCsv() {
    if (!state.unlocked) return;

    try {
      exportCsvBtn.disabled = true;
      exportCsvBtn.textContent = 'Exporting…';

      const rows = await fetchRows();
      if (!rows.length) {
        alert('No rows to export for the selected filters.');
        return;
      }

      // Flatten frustration JSON.
      const flatRows = rows.map((r) => {
        const f = parseFrustration(r.frustration);
        return {
          id: r.id ?? '',
          email: r.email ?? '',
          pitch_type: r.pitch_type ?? '',
          next_pitch: r.next_pitch ?? '',
          submitted_at: r[state.timestampColumn] ?? '',

          full_name: f.full_name ?? '',
          country: f.country ?? '',
          linkedin: f.linkedin ?? '',
          pitched_before: f.pitched_before ?? '',
          confidence: f.confidence ?? '',
          biggest_challenge: arrayify(f.biggest_challenge).join('|'),
          valuable_rating: f.valuable_rating ?? '',
          favorite_feature: arrayify(f.favorite_feature).join('|'),
          will_pay: f.will_pay ?? '',
          expected_pay: f.expected_pay ?? '',
          startup_one_liner: f.startup_one_liner ?? ''
        };
      });

      const headers = Object.keys(flatRows[0]);
      const csvLines = [headers.join(',')];
      for (const row of flatRows) {
        const values = headers.map(h => {
          const v = row[h];
          const s = v == null ? '' : String(v);
          // Escape commas/quotes
          if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return '"' + s.replaceAll('"', '""') + '"';
          }
          return s;
        });
        csvLines.push(values.join(','));
      }

      const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().slice(0, 19).replaceAll(':', '-');
      a.href = url;
      a.download = `pitchnest_waitlist_export_${ts}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      exportCsvBtn.disabled = false;
      exportCsvBtn.textContent = 'Export CSV';
    }
  }

  function setupRealtime() {
    if (!supabaseClient) return;

    // Clean previous subs
    subscriptions.splice(0).forEach(sub => {
      try { supabaseClient.removeChannel(sub); } catch {}
    });

    const channel = supabaseClient
      .channel('waitlist-analytics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waitlist' }, (payload) => {
        // For performance, simply refresh aggregates/table.
        // You can optimize further by patching rows, but correctness > micro perf.
        refreshDashboard();
      });

    channel.subscribe((status) => {
      statusPill.textContent = status === 'SUBSCRIBED' ? 'Live' : 'Connecting…';
    });

    subscriptions.push(channel);
  }

  function initUI() {
    if (!dateRange || !searchText || !filterPitchedBefore || !filterWillPay) return;

    // Default values
    state.dateRange = dateRange.value || '30d';

    applyFiltersBtn?.addEventListener('click', () => {
      refreshDashboard();
    });

    searchText?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') refreshDashboard();
    });

    // Live refresh when dropdown changes (optional)
    dateRange?.addEventListener('change', refreshDashboard);
    filterPitchedBefore?.addEventListener('change', refreshDashboard);
    filterWillPay?.addEventListener('change', refreshDashboard);

    exportCsvBtn?.addEventListener('click', exportCsv);

    closeModalBtn?.addEventListener('click', closeResponseModal);
  }

  function showGateLoading(msg) {
    if (authStatusPill) authStatusPill.textContent = msg || 'Checking…';
  }

  function showGateAccessDenied(msg) {
    if (!accessDeniedPanel) return;
    accessDeniedPanel.style.display = 'block';
    loginPanel && (loginPanel.style.display = 'none');
    loggedInPanel && (loggedInPanel.style.display = 'none');
    if (authStatusPill) authStatusPill.textContent = msg || 'Access Denied';
  }

  function showGateLoggedIn(email) {
    if (!loggedInPanel) return;
    loginPanel && (loginPanel.style.display = 'none');
    accessDeniedPanel && (accessDeniedPanel.style.display = 'none');
    loggedInPanel.style.display = 'block';
    if (adminEmailLabel) adminEmailLabel.textContent = email || '—';
    showGateLoading('');
  }

  function setDashboardVisible(on) {
    if (!root) return;
    root.style.display = on ? 'block' : 'none';
  }

  async function verifyAdminUser(user) {
    // Verify against admin_users by email.
    // Assumes RLS is configured to allow authenticated clients to read their own admin_users row.
    if (!user?.email) return { ok: false, reason: 'missing_email' };

    const { data, error } = await supabaseClient
      .from('admin_users')
      .select('email, role')
      .eq('email', user.email)
      .maybeSingle();

    if (error) {
      return { ok: false, reason: error.message || 'admin_lookup_failed' };
    }

    if (!data) return { ok: false, reason: 'not_in_admin_users' };
    return { ok: true, role: data.role };
  }

  function setupAuthGate() {
    // Supabase Auth gate (magic link) + admin verification.
    if (!authGate || !supabaseClient) return;

    authGate.style.display = 'block';

    const { auth } = supabaseClient;

    // Login: send magic link
    if (sendMagicLinkBtn && loginEmail) {
      sendMagicLinkBtn.addEventListener('click', async () => {
        const email = (loginEmail.value || '').trim();
        if (!email) {
          alert('Enter an admin email address.');
          return;
        }
        showGateLoading('Sending magic link…');
        try {
          const { error } = await auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
          if (error) throw error;
          showGateLoading('Check your inbox for the sign-in link.');
        } catch (e) {
          showGateAccessDenied(e?.message || 'Failed to send magic link');
        }
      });
    }

    // Logout
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await auth.signOut();
        } finally {
          state.unlocked = false;
          setDashboardVisible(false);
          authGate.style.display = 'block';
          if (accessDeniedPanel) accessDeniedPanel.style.display = 'none';
          if (loggedInPanel) loggedInPanel.style.display = 'none';
          if (loginPanel) loginPanel.style.display = 'block';
          showGateLoading('Checking…');
        }
      });
    }

    // On load: determine current session
    showGateLoading('Checking…');

    auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user;
      if (!user) {
        // Not logged in
        state.unlocked = false;
        setDashboardVisible(false);
        if (loginPanel) loginPanel.style.display = 'block';
        if (accessDeniedPanel) accessDeniedPanel.style.display = 'none';
        if (loggedInPanel) loggedInPanel.style.display = 'none';
        showGateLoading('Sign in required');
        return;
      }

      const result = await verifyAdminUser(user);
      if (!result.ok) {
        state.unlocked = false;
        setDashboardVisible(false);
        showGateAccessDenied();
        return;
      }

      state.unlocked = true;
      authGate.style.display = 'none';
      setDashboardVisible(true);
      showGateLoggedIn(user.email);

      refreshDashboard();
      setupRealtime();
    }).catch((e) => {
      state.unlocked = false;
      setDashboardVisible(false);
      showGateAccessDenied(e?.message || 'Auth check failed');
    });

    // Listen for auth changes
    auth.onAuthStateChange(async (event, session) => {
      const user = session?.user;
      if (!user) {
        state.unlocked = false;
        setDashboardVisible(false);
        authGate.style.display = 'block';
        if (loginPanel) loginPanel.style.display = 'block';
        if (accessDeniedPanel) accessDeniedPanel.style.display = 'none';
        if (loggedInPanel) loggedInPanel.style.display = 'none';
        showGateLoading('Sign in required');
        return;
      }

      const result = await verifyAdminUser(user);
      if (!result.ok) {
        state.unlocked = false;
        setDashboardVisible(false);
        showGateAccessDenied();
        return;
      }

      state.unlocked = true;
      authGate.style.display = 'none';
      setDashboardVisible(true);
      showGateLoggedIn(user.email);

      refreshDashboard();
      setupRealtime();
    });
  }


  function loadSupabaseIfNeeded() {
    // dashboard.html currently doesn't include the supabase CDN.
    // If it isn't present, load it dynamically.
    if (window.supabase?.createClient) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load Supabase CDN.'));
      document.head.appendChild(s);
    });
  }

  // Boot
  (async function init() {
    try {
      // Make sure supabase CDN exists before we instantiate client.
      if (!window.supabase?.createClient) {
        await loadSupabaseIfNeeded();
      }

      // Re-create client after loading
      if (!window.supabase?.createClient) throw new Error('Supabase not available');

      // Update client reference
      // (supabaseClient was set at top-level; refresh by reading again)
      // eslint-disable-next-line no-unused-vars
      if (!supabaseClient && window.supabase?.createClient) {
        // Not reachable due to top-level const, so we just rely on supabase client already loaded.
      }

      initUI();
      ensureCharts();
      setupAuthGate();
    } catch (e) {
      if (statusPill) {
        statusPill.textContent = 'Error';
        statusPill.style.color = '#ef4444';
      }
      if (errorState) {
        errorState.style.display = 'block';
        errorState.textContent = e?.message || 'Failed to init dashboard.';
      }
    }
  })();
})();

