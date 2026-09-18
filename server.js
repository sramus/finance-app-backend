const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'finance.json');

const defaultCategories = [
  'Salary',
  'Freelance',
  'Grocery',
  'Rent',
  'Utilities',
  'Transport',
  'Dining',
  'Entertainment',
  'Health',
  'Education',
  'Savings',
  'Other'
];

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      categories: defaultCategories,
      transactions: [
        {
          id: 'sample-1',
          type: 'income',
          category: 'Salary',
          amount: 4200,
          description: 'Monthly salary',
          date: new Date().toISOString().slice(0, 10)
        },
        {
          id: 'sample-2',
          type: 'expense',
          category: 'Rent',
          amount: 1200,
          description: 'Apartment rent',
          date: new Date().toISOString().slice(0, 10)
        },
        {
          id: 'sample-3',
          type: 'expense',
          category: 'Grocery',
          amount: 340,
          description: 'Weekly groceries',
          date: new Date().toISOString().slice(0, 10)
        }
      ]
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
  }
}

function readData() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw || '{}');

  return {
    categories: Array.isArray(parsed.categories) && parsed.categories.length
      ? parsed.categories
      : defaultCategories,
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : []
  };
}

function writeData(data) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function generateId() {
  return `txn-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function sortTransactions(transactions) {
  return [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function matchesMonth(transaction, month) {
  if (!month) return true;
  return transaction.date && transaction.date.startsWith(month);
}

function sanitizeTransaction(body) {
  const type = String(body.type || '').toLowerCase();
  const category = String(body.category || '').trim();
  const description = String(body.description || '').trim();
  const date = String(body.date || '').trim();
  const amountValue = Number(body.amount);

  if (!['income', 'expense'].includes(type)) {
    throw new Error('Transaction type must be income or expense.');
  }

  if (!category) {
    throw new Error('Category is required.');
  }

  if (!description) {
    throw new Error('Description is required.');
  }

  if (!date || Number.isNaN(new Date(date).getTime())) {
    throw new Error('Valid date is required.');
  }

  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    throw new Error('Amount must be greater than zero.');
  }

  return {
    type,
    category,
    amount: Number(amountValue.toFixed(2)),
    description,
    date
  };
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Finance tracker API is running.' });
});

app.get('/api/categories', (req, res) => {
  const { categories } = readData();
  res.json(categories);
});

app.post('/api/categories', (req, res) => {
  const { categories } = readData();
  const nextCategory = String(req.body?.name || '').trim();

  if (!nextCategory) {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  const normalized = nextCategory.trim();
  if (categories.includes(normalized)) {
    return res.status(409).json({ error: 'Category already exists.' });
  }

  const updated = [...categories, normalized];
  const data = readData();
  data.categories = updated;
  writeData(data);

  res.status(201).json({ name: normalized, categories: updated });
});

app.get('/api/transactions', (req, res) => {
  const { type, category, month, search } = req.query;
  const data = readData();

  let transactions = data.transactions.filter((transaction) => {
    if (month && !matchesMonth(transaction, month)) return false;
    if (type && transaction.type !== String(type).toLowerCase()) return false;
    if (category && transaction.category !== String(category)) return false;
    if (search) {
      const query = String(search).toLowerCase();
      const haystack = `${transaction.description} ${transaction.category} ${transaction.type}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  transactions = sortTransactions(transactions);
  res.json(transactions);
});

app.get('/api/summary', (req, res) => {
  const { month } = req.query;
  const data = readData();
  const targetMonth = month || new Date().toISOString().slice(0, 7);

  const filtered = data.transactions.filter((transaction) => matchesMonth(transaction, targetMonth));
  const totalIncome = filtered
    .filter((entry) => entry.type === 'income')
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  const totalExpense = filtered
    .filter((entry) => entry.type === 'expense')
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  const balance = totalIncome - totalExpense;

  const categoryTotals = filtered.reduce((acc, entry) => {
    const key = entry.category;
    acc[key] = (acc[key] || 0) + Number(entry.amount || 0);
    return acc;
  }, {});

  const categories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([name, total]) => ({ name, total }));

  res.json({
    month: targetMonth,
    totalIncome,
    totalExpense,
    balance,
    categories,
    transactionCount: filtered.length
  });
});

app.post('/api/transactions', (req, res) => {
  try {
    const data = readData();
    const payload = sanitizeTransaction(req.body);

    const transaction = {
      id: generateId(),
      ...payload
    };

    data.transactions = sortTransactions([transaction, ...data.transactions]);
    writeData(data);

    res.status(201).json(transaction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = readData();
    const payload = sanitizeTransaction(req.body);
    const index = data.transactions.findIndex((transaction) => transaction.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    data.transactions[index] = { ...data.transactions[index], ...payload };
    data.transactions = sortTransactions(data.transactions);
    writeData(data);

    res.json(data.transactions[index]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/transactions/:id', (req, res) => {
  const { id } = req.params;
  const data = readData();
  const originalLength = data.transactions.length;
  data.transactions = data.transactions.filter((transaction) => transaction.id !== id);

  if (data.transactions.length === originalLength) {
    return res.status(404).json({ error: 'Transaction not found.' });
  }

  writeData(data);
  res.json({ success: true, deletedId: id });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Finance app running at http://localhost:${PORT}`);
});
