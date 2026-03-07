const STORE_KEY = 'financex-pwa-v1';
const THEME_KEY = 'financex-theme';
const state = loadState();
let deferredPrompt = null;

const els = {
  todayLabel: document.getElementById('todayLabel'),
  installBtn: document.getElementById('installBtn'),
  themeBtn: document.getElementById('themeBtn'),
  openEntryBtn: document.getElementById('openEntryBtn'),
  bottomAddBtn: document.getElementById('bottomAddBtn'),
  openBillBtn: document.getElementById('openBillBtn'),
  openGoalBtn: document.getElementById('openGoalBtn'),
  exportBtn: document.getElementById('exportBtn'),
  clearBtn: document.getElementById('clearBtn'),
  entryDialog: document.getElementById('entryDialog'),
  billDialog: document.getElementById('billDialog'),
  goalDialog: document.getElementById('goalDialog'),
  entryForm: document.getElementById('entryForm'),
  billForm: document.getElementById('billForm'),
  goalForm: document.getElementById('goalForm'),
  cancelEntry: document.getElementById('cancelEntry'),
  cancelBill: document.getElementById('cancelBill'),
  cancelGoal: document.getElementById('cancelGoal'),
  balanceValue: document.getElementById('balanceValue'),
  incomeValue: document.getElementById('incomeValue'),
  expenseValue: document.getElementById('expenseValue'),
  saveRateValue: document.getElementById('saveRateValue'),
  spentTotal: document.getElementById('spentTotal'),
  legendList: document.getElementById('legendList'),
  trendChart: document.getElementById('trendChart'),
  netFlowValue: document.getElementById('netFlowValue'),
  trendCount: document.getElementById('trendCount'),
  billList: document.getElementById('billList'),
  goalList: document.getElementById('goalList'),
  entryList: document.getElementById('entryList'),
  typeFilter: document.getElementById('typeFilter'),
  categoryFilter: document.getElementById('categoryFilter'),
  donutChart: document.getElementById('donutChart')
};

init();

function init() {
  setToday();
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
  seedDates();
  bindEvents();
  render();
  registerSW();
}

function loadState() {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        entries: Array.isArray(parsed.entries) ? parsed.entries : [],
        bills: Array.isArray(parsed.bills) ? parsed.bills : [],
        goals: Array.isArray(parsed.goals) ? parsed.goals : []
      };
    } catch {
      localStorage.removeItem(STORE_KEY);
    }
  }
  return {
    entries: [
      sampleEntry('income', 'Salary', 4200, offsetDate(-2), 'Monthly income'),
      sampleEntry('expense', 'Needs', 900, offsetDate(-2), 'Home and essentials'),
      sampleEntry('expense', 'Wants', 600, offsetDate(-1), 'Shopping and leisure'),
      sampleEntry('expense', 'Savings', 500, offsetDate(0), 'Transferred to savings'),
      sampleEntry('loan', 'Car Loan', 250, offsetDate(-4), 'Loan payment'),
      sampleEntry('lend', 'Friend', 80, offsetDate(-5), 'Temporary lend')
    ],
    bills: [
      { id: uid(), name: 'Rent', amount: 1100, dueDate: offsetDate(4) },
      { id: uid(), name: 'Internet', amount: 120, dueDate: offsetDate(8) }
    ],
    goals: [
      { id: uid(), name: 'Emergency Fund', target: 6000, saved: 4200 },
      { id: uid(), name: 'Travel', target: 2000, saved: 850 }
    ]
  };
}

function sampleEntry(type, category, amount, date, note) {
  return { id: uid(), type, category, amount, date, note };
}

function bindEvents() {
  [els.openEntryBtn, els.bottomAddBtn].forEach(btn => btn.addEventListener('click', () => els.entryDialog.showModal()));
  els.openBillBtn.addEventListener('click', () => els.billDialog.showModal());
  els.openGoalBtn.addEventListener('click', () => els.goalDialog.showModal());
  els.cancelEntry.addEventListener('click', () => els.entryDialog.close());
  els.cancelBill.addEventListener('click', () => els.billDialog.close());
  els.cancelGoal.addEventListener('click', () => els.goalDialog.close());
  els.entryForm.addEventListener('submit', saveEntry);
  els.billForm.addEventListener('submit', saveBill);
  els.goalForm.addEventListener('submit', saveGoal);
  els.exportBtn.addEventListener('click', exportData);
  els.clearBtn.addEventListener('click', clearData);
  els.typeFilter.addEventListener('change', renderEntries);
  els.categoryFilter.addEventListener('change', renderEntries);
  els.themeBtn.addEventListener('click', toggleTheme);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    els.installBtn.hidden = false;
  });

  els.installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    els.installBtn.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    els.installBtn.hidden = true;
  });
}

function saveEntry(e) {
  e.preventDefault();
  const form = new FormData(els.entryForm);
  state.entries.unshift({
    id: uid(),
    type: form.get('type'),
    category: String(form.get('category')).trim(),
    amount: Number(form.get('amount')),
    date: form.get('date'),
    note: String(form.get('note')).trim()
  });
  persist();
  els.entryForm.reset();
  seedDates();
  els.entryDialog.close();
  render();
}

function saveBill(e) {
  e.preventDefault();
  const form = new FormData(els.billForm);
  state.bills.push({
    id: uid(),
    name: String(form.get('name')).trim(),
    amount: Number(form.get('amount')),
    dueDate: form.get('dueDate')
  });
  persist();
  els.billForm.reset();
  seedDates();
  els.billDialog.close();
  render();
}

function saveGoal(e) {
  e.preventDefault();
  const form = new FormData(els.goalForm);
  state.goals.push({
    id: uid(),
    name: String(form.get('name')).trim(),
    target: Number(form.get('target')),
    saved: Number(form.get('saved'))
  });
  persist();
  els.goalForm.reset();
  els.goalDialog.close();
  render();
}

function render() {
  renderStats();
  renderTrend();
  renderBills();
  renderGoals();
  populateCategoryFilter();
  renderEntries();
  persist();
}

function renderStats() {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthEntries = state.entries.filter(e => String(e.date || '').startsWith(monthKey));
  const income = sum(monthEntries.filter(e => e.type === 'income').map(e => e.amount));
  const expense = sum(monthEntries.filter(e => e.type === 'expense').map(e => e.amount));
  const loans = sum(monthEntries.filter(e => e.type === 'loan').map(e => e.amount));
  const lends = sum(monthEntries.filter(e => e.type === 'lend').map(e => e.amount));
  const balance = income - expense - loans - lends;
  const savingsRate = income ? Math.max(0, Math.round(((income - expense) / income) * 100)) : 0;

  els.balanceValue.textContent = money(balance);
  els.balanceSub.textContent = `${state.entries.length} entries`;
  els.incomeValue.textContent = money(income);
  els.expenseValue.textContent = money(expense);
  els.saveRateValue.textContent = `${savingsRate}%`;
  els.spentTotal.textContent = money(expense);

  const needs = sum(state.entries.filter(e => e.type === 'expense' && /need|rent|bill|grocery|home|utility|medical/i.test(e.category)).map(e => e.amount));
  const wants = sum(state.entries.filter(e => e.type === 'expense' && /want|shop|fun|entertain|travel|coffee|game/i.test(e.category)).map(e => e.amount));
  const saved = sum(state.entries.filter(e => e.type === 'expense' && /saving/i.test(e.category)).map(e => e.amount));
  const total = Math.max(needs + wants + saved, 1);

  const n1 = Math.round((needs / total) * 100);
  const n2 = Math.round((wants / total) * 100);
  els.donutChart.style.background = `conic-gradient(var(--indigo) 0 ${n1}%, var(--pink) ${n1}% ${n1 + n2}%, var(--orange) ${n1 + n2}% 100%)`;
  els.legendList.innerHTML = [
    ['Needs', needs, 'var(--indigo)'],
    ['Wants', wants, 'var(--pink)'],
    ['Savings', saved, 'var(--orange)']
  ].map(([name, amount, color]) => `
    <div class="legend-item">
      <div class="legend-name"><span class="legend-dot" style="background:${color}"></span><span>${name}</span></div>
      <strong>${money(amount)}</strong>
    </div>`).join('');
}

function renderTrend() {
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const date = offsetDate(-(6 - i));
    const dayEntries = state.entries.filter(e => e.date === date);
    return sum(dayEntries.map(e => (e.type === 'income' ? Number(e.amount) : -Number(e.amount))));
  });

  const width = 320;
  const height = 160;
  const maxAbs = Math.max(...last7.map(v => Math.abs(v)), 100);
  const pointsArray = last7.map((v, i) => {
    const x = (i / 6) * (width - 20) + 10;
    const y = height / 2 - (v / maxAbs) * 55;
    return { x, y };
  });
  const points = pointsArray.map(p => `${p.x},${p.y}`).join(' ');
  const areaPoints = `10,80 ${points} 310,80`;

  els.trendChart.innerHTML = `
    <defs>
      <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(81,232,255,.45)" />
        <stop offset="100%" stop-color="rgba(81,232,255,0)" />
      </linearGradient>
    </defs>
    <line x1="10" y1="80" x2="310" y2="80" stroke="rgba(255,255,255,.12)" stroke-width="1" />
    <polyline points="${areaPoints}" fill="url(#lineFill)" stroke="none" />
    <polyline points="${points}" fill="none" stroke="#51e8ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
    ${pointsArray.map(({ x, y }) => `<circle cx="${x}" cy="${y}" r="4" fill="#4d67ff" stroke="#ffffff" stroke-width="2" />`).join('')}
  `;

  const net = sum(last7);
  els.netFlowValue.textContent = money(net);
  els.trendCount.textContent = String(state.entries.length);
}

function renderBills() {
  const bills = [...state.bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (!bills.length) {
    els.billList.className = 'stack-list empty-state';
    els.billList.textContent = 'No upcoming bills yet.';
    return;
  }
  els.billList.className = 'stack-list';
  els.billList.innerHTML = bills.map(b => `
    <div class="stack-item">
      <div>
        <div class="item-title">${escapeHtml(b.name)}</div>
        <div class="item-sub">Due ${formatDate(b.dueDate)}</div>
      </div>
      <div style="text-align:right">
        <div class="amount expense">${money(b.amount)}</div>
        <button class="pill" onclick="removeBill('${b.id}')">Remove</button>
      </div>
    </div>
  `).join('');
}

function renderGoals() {
  if (!state.goals.length) {
    els.goalList.className = 'stack-list empty-state';
    els.goalList.textContent = 'No goals yet.';
    return;
  }
  els.goalList.className = 'stack-list';
  els.goalList.innerHTML = state.goals.map(g => {
    const pct = Math.min(100, Math.round((g.saved / Math.max(g.target, 1)) * 100));
    return `
      <div class="legend-item" style="display:block">
        <div style="display:flex;justify-content:space-between;gap:.8rem;align-items:center">
          <div>
            <div class="item-title">${escapeHtml(g.name)}</div>
            <div class="item-sub">${money(g.saved)} of ${money(g.target)}</div>
          </div>
          <div class="amount goal">${pct}%</div>
        </div>
        <div class="progress-row"><div class="progress-bar" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');
}

function populateCategoryFilter() {
  const current = els.categoryFilter.value || 'all';
  const categories = ['all', ...new Set(state.entries.map(e => e.category).filter(Boolean))];
  els.categoryFilter.innerHTML = categories.map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c === 'all' ? 'All categories' : c)}</option>`).join('');
  els.categoryFilter.value = categories.includes(current) ? current : 'all';
}

function renderEntries() {
  let list = [...state.entries];
  if (els.typeFilter.value !== 'all') list = list.filter(e => e.type === els.typeFilter.value);
  if (els.categoryFilter.value !== 'all') list = list.filter(e => e.category === els.categoryFilter.value);

  if (!list.length) {
    els.entryList.className = 'entry-list empty-state';
    els.entryList.textContent = 'No entries match this filter.';
    return;
  }

  els.entryList.className = 'entry-list';
  els.entryList.innerHTML = list.map(e => `
    <div class="entry-item">
      <div>
        <div class="item-title">${escapeHtml(e.category)}</div>
        <div class="item-sub">${formatDate(e.date)} · ${capitalize(e.type)}${e.note ? ' · ' + escapeHtml(e.note) : ''}</div>
      </div>
      <div style="text-align:right">
        <div class="amount ${e.type}">${e.type === 'income' ? '+' : '-'}${money(e.amount)}</div>
        <button class="pill" onclick="removeEntry('${e.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `finance-x-backup-${offsetDate(0)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function clearData() {
  const ok = confirm('Reset Finance X and remove all local entries, bills, and goals?');
  if (!ok) return;
  state.entries = [];
  state.bills = [];
  state.goals = [];
  persist();
  render();
}

function removeEntry(id) {
  state.entries = state.entries.filter(e => e.id !== id);
  persist();
  render();
}
window.removeEntry = removeEntry;

function removeBill(id) {
  state.bills = state.bills.filter(b => b.id !== id);
  persist();
  render();
}
window.removeBill = removeBill;

function persist() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function toggleTheme() {
  const next = document.documentElement.classList.contains('light') ? 'dark' : 'light';
  applyTheme(next);
}

function applyTheme(theme) {
  document.documentElement.classList.toggle('light', theme === 'light');
  localStorage.setItem(THEME_KEY, theme);
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
}

function setToday() {
  const now = new Date();
  els.todayLabel.textContent = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

function seedDates() {
  const today = offsetDate(0);
  els.entryForm.elements.date.value = today;
  els.billForm.elements.dueDate.value = offsetDate(7);
}

function sum(arr) { return arr.reduce((a, b) => a + Number(b || 0), 0); }
function uid() { return Math.random().toString(36).slice(2, 10); }
function money(v) { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(v || 0)); }
function capitalize(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }
function formatDate(s) { return new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }
function offsetDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
