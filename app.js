const STORAGE_KEY = 'financeXAI_v1';
const THEME_KEY = 'financeXTheme';

const defaultData = {
  entries: [],
  bills: [],
  goals: []
};

let state = loadState();
const $ = (id) => document.getElementById(id);

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return raw && typeof raw === 'object'
      ? {
          entries: Array.isArray(raw.entries) ? raw.entries : [],
          bills: Array.isArray(raw.bills) ? raw.bills : [],
          goals: Array.isArray(raw.goals) ? raw.goals : []
        }
      : structuredClone(defaultData);
  } catch {
    return structuredClone(defaultData);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatMoney(value) {
  const num = Number(value || 0);
  return `$${num.toFixed(2)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function humanDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

function applyTheme() {
  document.body.classList.toggle('light', getTheme() === 'light');
}

function openModal(id) {
  const dialog = $(id);
  if (dialog?.showModal) dialog.showModal();
}

function closeModal(id) {
  const dialog = $(id);
  if (dialog?.close) dialog.close();
}

function sameMonth(dateStr, refDate = new Date()) {
  const d = new Date(dateStr);
  return d.getFullYear() === refDate.getFullYear() && d.getMonth() === refDate.getMonth();
}

function getFilteredEntriesForTrend(days) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - Number(days));
  return state.entries
    .filter((e) => new Date(e.date) >= cutoff)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function bucketTotals() {
  const needs = state.entries.filter(e => e.type === 'expense' && e.bucket === 'needs').reduce((s, e) => s + Number(e.amount), 0);
  const wants = state.entries.filter(e => e.type === 'expense' && e.bucket === 'wants').reduce((s, e) => s + Number(e.amount), 0);
  const savings = state.entries.filter(e => e.type === 'saving' || e.bucket === 'savings').reduce((s, e) => s + Number(e.amount), 0);
  return { needs, wants, savings };
}

function currentMonthTotals() {
  let income = 0;
  let expense = 0;
  let saving = 0;
  state.entries.forEach((e) => {
    if (!sameMonth(e.date)) return;
    if (e.type === 'income') income += Number(e.amount);
    if (e.type === 'expense') expense += Number(e.amount);
    if (e.type === 'saving') saving += Number(e.amount);
  });
  return { income, expense, saving };
}

function allBalance() {
  return state.entries.reduce((sum, e) => {
    const amount = Number(e.amount);
    if (e.type === 'income' || e.type === 'loan') return sum + amount;
    if (e.type === 'expense' || e.type === 'lend' || e.type === 'saving') return sum - amount;
    return sum;
  }, 0);
}

function updateOverview() {
  const { income, expense } = currentMonthTotals();
  $('incomeTotal').textContent = formatMoney(income);
  $('expenseTotal').textContent = formatMoney(expense);
  $('balanceTotal').textContent = formatMoney(allBalance());
  $('entryCount').textContent = `${state.entries.length} ${state.entries.length === 1 ? 'entry' : 'entries'}`;
  const rate = income > 0 ? Math.max(0, ((income - expense) / income) * 100) : 0;
  $('savingRate').textContent = `${Math.round(rate)}%`;
}

function updateRing() {
  const { needs, wants, savings } = bucketTotals();
  const total = needs + wants + savings;
  $('needsTotal').textContent = formatMoney(needs);
  $('wantsTotal').textContent = formatMoney(wants);
  $('savingsBucketTotal').textContent = formatMoney(savings);
  $('spentRingAmount').textContent = formatMoney(needs + wants);

  const needsPct = total ? (needs / total) * 100 : 33.3;
  const wantsPct = total ? (wants / total) * 100 : 33.3;
  const savingsPct = total ? (savings / total) * 100 : 33.4;

  $('spendingRing').style.background = `conic-gradient(
    var(--blue) 0 ${needsPct}%,
    var(--pink) ${needsPct}% ${needsPct + wantsPct}%,
    var(--orange) ${needsPct + wantsPct}% ${needsPct + wantsPct + savingsPct}%
  )`;
}

function buildTrendPoints(entries, days) {
  const byDay = new Map();
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - Number(days) + 1);

  for (let i = 0; i < Number(days); i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }

  entries.forEach((e) => {
    const key = new Date(e.date).toISOString().slice(0, 10);
    if (!byDay.has(key)) return;
    const amt = Number(e.amount);
    const effect = e.type === 'income' || e.type === 'loan' ? amt : -amt;
    byDay.set(key, byDay.get(key) + effect);
  });

  return [...byDay.values()];
}

function renderTrend() {
  const days = Number($('trendFilter').value);
  $('trendSubtitle').textContent = days === 7 ? 'Last 7 days' : days === 30 ? 'Last 30 days' : days === 90 ? 'Last 3 months' : 'Last year';

  const entries = getFilteredEntriesForTrend(days);
  const points = buildTrendPoints(entries, Math.min(days, 30));
  const viewW = 320;
  const viewH = 160;
  const padding = 12;
  const maxAbs = Math.max(10, ...points.map(v => Math.abs(v)));
  const stepX = (viewW - padding * 2) / Math.max(points.length - 1, 1);
  const baseline = viewH / 2;
  const toY = (v) => baseline - (v / maxAbs) * (viewH / 2 - 18);

  let line = '';
  let area = '';
  const dots = [];
  points.forEach((v, i) => {
    const x = padding + i * stepX;
    const y = toY(v);
    line += `${i === 0 ? 'M' : 'L'} ${x} ${y} `;
    dots.push(`<circle cx="${x}" cy="${y}" r="3.5"></circle>`);
  });
  if (points.length) {
    const firstX = padding;
    const lastX = padding + (points.length - 1) * stepX;
    area = `${line} L ${lastX} ${baseline} L ${firstX} ${baseline} Z`;
  }

  $('trendLine').setAttribute('d', line.trim());
  $('trendArea').setAttribute('d', area.trim());
  $('trendDots').innerHTML = dots.join('');

  const netFlow = entries.reduce((sum, e) => sum + ((e.type === 'income' || e.type === 'loan') ? Number(e.amount) : -Number(e.amount)), 0);
  $('netFlowLabel').textContent = `Net flow ${formatMoney(netFlow)}`;
  $('trendEntriesLabel').textContent = `Entries ${entries.length}`;
}

function populateCategoryFilter() {
  const select = $('categoryFilter');
  const current = select.value || 'all';
  const categories = [...new Set(state.entries.map(e => e.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  select.innerHTML = '<option value="all">All categories</option>' + categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  if ([...select.options].some(o => o.value === current)) select.value = current;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function renderEntries() {
  const typeFilter = $('typeFilter').value;
  const categoryFilter = $('categoryFilter').value;
  const filtered = [...state.entries]
    .filter(e => (typeFilter === 'all' ? true : e.type === typeFilter))
    .filter(e => (categoryFilter === 'all' ? true : e.category === categoryFilter))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const list = $('entryList');
  if (!filtered.length) {
    list.className = 'entry-list empty-text';
    list.textContent = 'No entries match this filter.';
    return;
  }

  list.className = 'entry-list';
  list.innerHTML = filtered.map((e) => `
    <div class="entry-row">
      <div class="entry-main">
        <strong>${escapeHtml(capitalize(e.category))}</strong>
        <div class="entry-meta">${escapeHtml(capitalize(e.type))} • ${escapeHtml(e.bucket || 'general')} • ${humanDate(e.date)}${e.note ? ` • ${escapeHtml(e.note)}` : ''}</div>
      </div>
      <div class="entry-amount">${formatMoney(e.amount)}</div>
    </div>
  `).join('');
}

function renderBills() {
  const list = $('billList');
  const bills = [...state.bills].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (!bills.length) {
    list.className = 'stack-list empty-text';
    list.textContent = 'No upcoming bills yet.';
    return;
  }
  list.className = 'stack-list';
  list.innerHTML = bills.map((b, i) => `
    <div class="stack-item">
      <div><strong>${escapeHtml(b.name)}</strong><div class="entry-meta">Due ${humanDate(b.date)}</div></div>
      <div><strong>${formatMoney(b.amount)}</strong></div>
    </div>
  `).join('');
}

function renderGoals() {
  const list = $('goalList');
  if (!state.goals.length) {
    list.className = 'stack-list empty-text';
    list.textContent = 'No goals yet.';
    return;
  }
  list.className = 'stack-list';
  list.innerHTML = state.goals.map((g) => {
    const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
    return `
      <div class="stack-item">
        <div><strong>${escapeHtml(g.name)}</strong><div class="entry-meta">${pct}% complete</div></div>
        <div><strong>${formatMoney(g.saved)} / ${formatMoney(g.target)}</strong></div>
      </div>
    `;
  }).join('');
}

function capitalize(str) {
  return String(str || '').charAt(0).toUpperCase() + String(str || '').slice(1);
}

function generateAdvice() {
  const days = Number($('trendFilter').value);
  const focus = $('advisorMode').value;
  const rangeEntries = getFilteredEntriesForTrend(days);
  const income = rangeEntries.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0);
  const expenses = rangeEntries.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0);
  const savings = rangeEntries.filter(e => e.type === 'saving').reduce((s, e) => s + Number(e.amount), 0);
  const debt = rangeEntries.filter(e => e.type === 'loan').reduce((s, e) => s + Number(e.amount), 0);
  const lent = rangeEntries.filter(e => e.type === 'lend').reduce((s, e) => s + Number(e.amount), 0);
  const cats = {};
  rangeEntries.filter(e => e.type === 'expense').forEach(e => {
    cats[e.category] = (cats[e.category] || 0) + Number(e.amount);
  });
  const topCategory = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
  const advice = [];
  const savingRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

  if (!rangeEntries.length) {
    $('aiSummary').textContent = 'No records in the selected range yet. Add entries and the advisor will react instantly.';
    $('aiAdviceList').innerHTML = '<li>Start with income, expense, and one savings entry for better advice.</li>';
    return;
  }

  if (expenses > income && income > 0) {
    advice.push(`Your spending is above income in this range by ${formatMoney(expenses - income)}. Cut wants first and pause non-urgent buying.`);
  }
  if (savingRate < 10 && income > 0) {
    advice.push(`Your savings rate is ${Math.round(Math.max(0, savingRate))}%. Try moving at least 10% of each income entry into savings.`);
  } else if (savingRate >= 20) {
    advice.push(`Savings rate is ${Math.round(savingRate)}%. Good job. Keep the same habit and direct extra surplus to debt or goals.`);
  }
  if (topCategory) {
    advice.push(`Your biggest expense category is ${capitalize(topCategory[0])} at ${formatMoney(topCategory[1])}. Set a cap for it next cycle.`);
  }
  if (debt > 0) {
    advice.push(`You added ${formatMoney(debt)} in loans in this range. Prioritize minimum payments and avoid new debt until balance stabilizes.`);
  }
  if (lent > income * 0.15 && income > 0) {
    advice.push(`You lent out ${formatMoney(lent)}. Keep lending below 15% of your range income to protect your cashflow.`);
  }
  if (savings === 0 && income > 0) {
    advice.push('No savings entries recorded. Create a small automatic savings habit, even if it starts at 5% of income.');
  }

  if (focus === 'save') {
    advice.unshift('Save more mode: move the first money you receive into savings before spending anything else.');
  }
  if (focus === 'debt') {
    advice.unshift('Debt focus mode: target the highest-interest debt first while keeping every minimum payment current.');
  }
  if (focus === 'growth') {
    advice.unshift('Growth mode: protect emergency savings first, then direct surplus to skill growth or long-term investing.');
  }

  const summary = `In the selected range: income ${formatMoney(income)}, spending ${formatMoney(expenses)}, savings ${formatMoney(savings)}, net ${formatMoney(income - expenses - savings - lent + debt)}.`;
  $('aiSummary').textContent = summary;
  $('aiAdviceList').innerHTML = advice.slice(0, 6).map(item => `<li>${escapeHtml(item)}</li>`).join('') || '<li>Keep adding records for deeper suggestions.</li>';
}

function renderAll() {
  updateOverview();
  updateRing();
  populateCategoryFilter();
  renderTrend();
  renderBills();
  renderGoals();
  renderEntries();
  generateAdvice();
  saveState();
}

function bindEvents() {
  $('openAddEntry').addEventListener('click', () => openModal('entryDialog'));
  $('navAdd').addEventListener('click', () => openModal('entryDialog'));
  $('openBillBtn').addEventListener('click', () => openModal('billDialog'));
  $('openGoalBtn').addEventListener('click', () => openModal('goalDialog'));

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  $('entryForm').addEventListener('submit', (e) => {
    e.preventDefault();
    state.entries.push({
      type: $('entryType').value,
      amount: Number($('entryAmount').value || 0),
      category: $('entryCategory').value.trim() || 'General',
      bucket: $('entryBucket').value,
      date: $('entryDate').value || todayISO(),
      note: $('entryNote').value.trim()
    });
    $('entryForm').reset();
    $('entryDate').value = todayISO();
    closeModal('entryDialog');
    renderAll();
  });

  $('billForm').addEventListener('submit', (e) => {
    e.preventDefault();
    state.bills.push({
      name: $('billName').value.trim(),
      amount: Number($('billAmount').value || 0),
      date: $('billDate').value || todayISO()
    });
    $('billForm').reset();
    $('billDate').value = todayISO();
    closeModal('billDialog');
    renderAll();
  });

  $('goalForm').addEventListener('submit', (e) => {
    e.preventDefault();
    state.goals.push({
      name: $('goalName').value.trim(),
      target: Number($('goalTarget').value || 0),
      saved: Number($('goalSaved').value || 0)
    });
    $('goalForm').reset();
    closeModal('goalDialog');
    renderAll();
  });

  $('typeFilter').addEventListener('change', renderEntries);
  $('categoryFilter').addEventListener('change', renderEntries);
  $('trendFilter').addEventListener('change', () => {
    renderTrend();
    generateAdvice();
  });
  $('advisorMode').addEventListener('change', generateAdvice);

  $('exportBtn').addEventListener('click', exportData);
  $('resetBtn').addEventListener('click', resetData);
  $('themeToggle').addEventListener('click', () => {
    localStorage.setItem(THEME_KEY, getTheme() === 'light' ? 'dark' : 'light');
    applyTheme();
  });
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `finance-x-backup-${todayISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function resetData() {
  const ok = window.confirm('Reset all Finance X data on this device?');
  if (!ok) return;
  state = structuredClone(defaultData);
  renderAll();
}

function seedDemoData() {
  if (state.entries.length || state.bills.length || state.goals.length) return;
  const now = new Date();
  const makeDate = (offset) => {
    const d = new Date(now); d.setDate(d.getDate() - offset); return d.toISOString().slice(0, 10);
  };
  state.entries = [
    { type: 'income', amount: 2800, category: 'Salary', bucket: 'needs', date: makeDate(3), note: 'Monthly pay' },
    { type: 'expense', amount: 420, category: 'Food', bucket: 'needs', date: makeDate(2), note: '' },
    { type: 'expense', amount: 180, category: 'Shopping', bucket: 'wants', date: makeDate(1), note: '' },
    { type: 'saving', amount: 250, category: 'Emergency fund', bucket: 'savings', date: makeDate(1), note: '' },
    { type: 'expense', amount: 95, category: 'Transport', bucket: 'needs', date: makeDate(0), note: '' }
  ];
  state.bills = [{ name: 'Rent', amount: 900, date: makeDate(-5) }];
  state.goals = [{ name: 'Emergency fund', target: 4000, saved: 900 }];
}

function init() {
  applyTheme();
  $('todayLabel').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  $('entryDate').value = todayISO();
  $('billDate').value = todayISO();
  seedDemoData();
  bindEvents();
  renderAll();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
}

init();
