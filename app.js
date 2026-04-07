/**
 * Account ARR Tracker
 * Tracks accounts organized into ARR (Annual Recurring Revenue) tiers.
 *
 * Tier definitions:
 *   Tier 1 – $1,000,000 and above
 *   Tier 2 – $750,000 to $999,999
 *   Tier 3 – $500,000 to $749,999
 *   Tier 4 – $250,000 to $499,999
 *   Tier 5 – $0 to $249,999
 */

'use strict';

// ---------------------------------------------------------------------------
// Tier Configuration
// ---------------------------------------------------------------------------
const TIERS = [
  { id: 'tier1', label: '$1,000,000 and Above', min: 1_000_000, max: Infinity },
  { id: 'tier2', label: '$750,000 to $999,999',  min: 750_000,   max: 999_999 },
  { id: 'tier3', label: '$500,000 to $749,999',  min: 500_000,   max: 749_999 },
  { id: 'tier4', label: '$250,000 to $499,999',  min: 250_000,   max: 499_999 },
  { id: 'tier5', label: '$0 to $249,999',         min: 0,         max: 249_999 },
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let accounts = loadAccounts();

// ---------------------------------------------------------------------------
// Persistence Helpers
// ---------------------------------------------------------------------------
function loadAccounts() {
  try {
    const stored = localStorage.getItem('arrTrackerAccounts');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveAccounts() {
  try {
    localStorage.setItem('arrTrackerAccounts', JSON.stringify(accounts));
  } catch {
    // localStorage not available (e.g., private browsing quota exceeded)
  }
}

// ---------------------------------------------------------------------------
// ARR Tier Classification
// ---------------------------------------------------------------------------
/**
 * Returns the tier object that matches the given ARR value.
 * @param {number} arr
 * @returns {{ id: string, label: string, min: number, max: number }}
 */
function classifyARR(arr) {
  for (const tier of TIERS) {
    if (arr >= tier.min && arr <= tier.max) return tier;
  }
  // Fallback to the lowest tier for any negative value (shouldn't happen with min=0)
  return TIERS[TIERS.length - 1];
}

// ---------------------------------------------------------------------------
// Formatting Helpers
// ---------------------------------------------------------------------------
function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderAll() {
  // Clear all tier table bodies
  TIERS.forEach(tier => {
    document.getElementById(`tbody-${tier.id}`).innerHTML = '';
  });

  // Group accounts by tier
  const tierGroups = {};
  TIERS.forEach(t => { tierGroups[t.id] = []; });

  accounts.forEach(account => {
    const tier = classifyARR(account.arr);
    tierGroups[tier.id].push(account);
  });

  // Render each tier group
  TIERS.forEach(tier => {
    const tbody = document.getElementById(`tbody-${tier.id}`);
    const group = tierGroups[tier.id];

    if (group.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No accounts in this tier</td></tr>`;
    } else {
      // Sort within tier by ARR descending
      group.sort((a, b) => b.arr - a.arr);
      group.forEach(account => {
        tbody.appendChild(createAccountRow(account));
      });
    }

    // Update tier total
    const totalARR = group.reduce((sum, a) => sum + a.arr, 0);
    document.getElementById(`total-${tier.id}`).textContent =
      `Total ARR: ${formatCurrency(totalARR)}`;

    // Update summary cards
    document.getElementById(`count-${tier.id}`).textContent = group.length;
    document.getElementById(`arr-${tier.id}`).textContent = formatCurrency(totalARR);
  });
}

/**
 * Creates a <tr> element for an account row.
 * @param {{ id: string, name: string, owner: string, arr: number, stage: string }} account
 * @returns {HTMLTableRowElement}
 */
function createAccountRow(account) {
  const stageCSSKey = account.stage.replace(/\s+/g, '-');
  const tr = document.createElement('tr');
  tr.dataset.id = account.id;
  tr.innerHTML = `
    <td>${escapeHtml(account.name)}</td>
    <td>${escapeHtml(account.owner || '—')}</td>
    <td class="arr-value">${formatCurrency(account.arr)}</td>
    <td><span class="stage-badge stage-badge--${stageCSSKey}">${escapeHtml(account.stage)}</span></td>
    <td><button class="btn-delete" data-id="${account.id}" aria-label="Delete ${escapeHtml(account.name)}">Delete</button></td>
  `;
  return tr;
}

// ---------------------------------------------------------------------------
// Escape HTML to prevent XSS
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

// ---------------------------------------------------------------------------
// Add Account
// ---------------------------------------------------------------------------
function addAccount(name, owner, arr, stage) {
  const account = {
    id: `acc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    owner: owner.trim(),
    arr: Number(arr),
    stage,
  };
  accounts.push(account);
  saveAccounts();
  renderAll();

  const tier = classifyARR(account.arr);
  showToast(`"${account.name}" added to ${tier.label}`);
}

// ---------------------------------------------------------------------------
// Delete Account
// ---------------------------------------------------------------------------
function deleteAccount(id) {
  const account = accounts.find(a => a.id === id);
  accounts = accounts.filter(a => a.id !== id);
  saveAccounts();
  renderAll();
  if (account) showToast(`"${account.name}" removed`);
}

// ---------------------------------------------------------------------------
// Toast Notification
// ---------------------------------------------------------------------------
let toastTimeout = null;
const toast = document.createElement('div');
toast.className = 'toast';
document.body.appendChild(toast);

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ---------------------------------------------------------------------------
// Event Listeners
// ---------------------------------------------------------------------------
document.getElementById('accountForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const name  = document.getElementById('accountName').value.trim();
  const owner = document.getElementById('accountOwner').value.trim();
  const arr   = parseFloat(document.getElementById('accountARR').value);
  const stage = document.getElementById('accountStage').value;

  if (!name) return;
  if (isNaN(arr) || arr < 0) {
    showToast('Please enter a valid ARR value (0 or above).');
    return;
  }

  addAccount(name, owner, arr, stage);
  this.reset();
});

// Delegated click handler for delete buttons
document.querySelector('.tiers-section').addEventListener('click', function (e) {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;
  const id = btn.dataset.id;
  if (id) deleteAccount(id);
});

// ---------------------------------------------------------------------------
// Initial Render
// ---------------------------------------------------------------------------
renderAll();
