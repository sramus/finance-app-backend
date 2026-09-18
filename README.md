const monthFilter = document.getElementById('monthFilter');
const incomeTotal = document.getElementById('incomeTotal');
const expenseTotal = document.getElementById('expenseTotal');
const balanceTotal = document.getElementById('balanceTotal');
const categoryChart = document.getElementById('categoryChart');
const transactionTableBody = document.getElementById('transactionTableBody');
const transactionForm = document.getElementById('transactionForm');
const transactionIdField = document.getElementById('transactionId');
const typeField = document.getElementById('type');
const categoryField = document.getElementById('category');
const amountField = document.getElementById('amount');
const dateField = document.getElementById('date');
const descriptionField = document.getElementById('description');
const formTitle = document.getElementById('formTitle');
const cancelEditBtn = document.getElementById('cancelEdit');
const newCategoryInput = document.getElementById('newCategory');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const searchInput = document.getElementById('searchInput');

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
});

const defaultMonth = new Date().toISOString().slice(0, 7);
monthFilter.value = defaultMonth;

dateField.value = new Date().toISOString().slice(0, 10);

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Request failed');
  }

  return response.json();
}

async function loadCategories() {
  const categories = await fetchJson('/api/categories');
  categoryField.innerHTML = categories
    .map((category) => `<option value="${category}">${category}</option>`)
    .join('');
}

function renderSummary(summary) {
  incomeTotal.textContent = currencyFormatter.format(summary.totalIncome || 0);
  expenseTotal.textContent = currencyFormatter.format(summary.totalExpense || 0);
  balanceTotal.textContent = currencyFormatter.format(summary.balance || 0);

  const max = Math.max(...(summary.categories?.map((item) => item.total) || [0]), 1);

  categoryChart.innerHTML = (summary.categories || []).map((entry) => {
    const width = Math.max((entry.total / max) * 100, 5);
    return `
      <div class="chart-row">
        <span class="label">${entry.name}</span>
        <div class="chart-bar-wrap">
          <span class="chart-bar" style="width: ${width}%"></span>
        </div>
        <span class="total">${currencyFormatter.format(entry.total)}</span>
      </div>
    `;
  }).join('') || '<p>No spending recorded for this month.</p>';
}

function renderTransactions(transactions) {
  if (!transactions.length) {
    transactionTableBody.innerHTML = '<tr><td colspan="6">No transactions found.</td></tr>';
    return;
  }

  transactionTableBody.innerHTML = transactions.map((transaction) => {
    const amountClass = transaction.type === 'income' ? 'amount-income' : 'amount-expense';
    const badgeClass = transaction.type === 'income' ? 'income' : 'expense';
    return `
      <tr>
        <td>${transaction.date}</td>
        <td><span class="type-badge ${badgeClass}">${transaction.type}</span></td>
        <td>${transaction.category}</td>
        <td>${transaction.description}</td>
        <td class="${amountClass}">${transaction.type === 'income' ? '+' : '-'}${currencyFormatter.format(transaction.amount)}</td>
        <td>
          <div class="table-actions">
            <button class="action-btn edit" data-action="edit" data-id="${transaction.id}">Edit</button>
            <button class="action-btn delete" data-action="delete" data-id="${transaction.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadTransactions() {
  const month = monthFilter.value || defaultMonth;
  const searchQuery = searchInput.value.trim();

  const query = new URLSearchParams({ month });
  if (searchQuery) query.set('search', searchQuery);

  const [summary, transactions] = await Promise.all([
    fetchJson(`/api/summary?month=${encodeURIComponent(month)}`),
    fetchJson(`/api/transactions?${query.toString()}`)
  ]);

  renderSummary(summary);
  renderTransactions(transactions);
}

async function saveTransaction(event) {
  event.preventDefault();

  const payload = {
    type: typeField.value,
    category: categoryField.value,
    amount: Number(amountField.value),
    date: dateField.value,
    description: descriptionField.value.trim()
  };

  const id = transactionIdField.value;

  try {
    if (id) {
      await fetchJson(`/api/transactions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      await fetchJson('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    resetForm();
    await loadTransactions();
  } catch (error) {
    alert(error.message);
  }
}

async function handleTransactionAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const { action, id } = button.dataset;
  if (action === 'delete') {
    const confirmed = window.confirm('Delete this transaction?');
    if (!confirmed) return;

    try {
      await fetchJson(`/api/transactions/${id}`, { method: 'DELETE' });
      await loadTransactions();
    } catch (error) {
      alert(error.message);
    }
  }

  if (action === 'edit') {
    const transaction = (await fetchJson(`/api/transactions?month=${encodeURIComponent(monthFilter.value)}`))
      .find((item) => item.id === id);

    if (!transaction) return;

    transactionIdField.value = transaction.id;
    typeField.value = transaction.type;
    categoryField.value = transaction.category;
    amountField.value = transaction.amount;
    dateField.value = transaction.date;
    descriptionField.value = transaction.description;
    formTitle.textContent = 'Edit Transaction';
    cancelEditBtn.classList.remove('hidden');
  }
}

function resetForm() {
  transactionIdField.value = '';
  typeField.value = 'income';
  amountField.value = '';
  dateField.value = new Date().toISOString().slice(0, 10);
  descriptionField.value = '';
  formTitle.textContent = 'Add Transaction';
  cancelEditBtn.classList.add('hidden');
}

async function addCategory() {
  const categoryName = newCategoryInput.value.trim();
  if (!categoryName) return;

  try {
    const response = await fetchJson('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: categoryName })
    });

    await loadCategories();
    categoryField.value = response.name;
    newCategoryInput.value = '';
  } catch (error) {
    alert(error.message);
  }
}

transactionForm.addEventListener('submit', saveTransaction);
transactionTableBody.addEventListener('click', handleTransactionAction);
monthFilter.addEventListener('change', loadTransactions);
searchInput.addEventListener('input', loadTransactions);
cancelEditBtn.addEventListener('click', resetForm);
addCategoryBtn.addEventListener('click', addCategory);

(async function init() {
  await loadCategories();
  resetForm();
  await loadTransactions();
})();
