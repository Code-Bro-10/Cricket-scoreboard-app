/* ==========================================================================
   Cricket Overdrive Score Card Management - Client Application Logic
   ========================================================================== */

// --- Global Application State ---
const state = {
  currentTab: 'live-score',
  previousTab: null,
  isAdmin: false,
  currentUser: null,
  teams: [],
  players: [],
  matches: [],
  activeScorecard: null,
  charts: {
    points: null,
    teamRuns: null
  }
};

const API_BASE = '/api';

// --- Global Fetch Interceptor for JWT ---
const originalFetch = window.fetch;
window.fetch = async function() {
  let [resource, config] = arguments;
  if (resource.startsWith(API_BASE)) {
    if (!config) config = {};
    if (!config.headers) config.headers = {};
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  const response = await originalFetch(resource, config);
  if (response.status === 401 || response.status === 403) {
    if (state.currentUser && !resource.includes('/auth/')) {
      logoutUser(true);
    }
  }
  return response;
};

// --- Application Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupClock();
  setupUserAuth();
  setupGlobalActions();
  setupFilterHandlers();
  
  // Load initial tab data
  loadTabContent('live-score');
});

// --- Dynamic Clock Handler ---
function setupClock() {
  const clockEl = document.getElementById('liveTime');
  const updateTime = () => {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString();
  };
  updateTime();
  setInterval(updateTime, 1000);
}

// --- SPA Tab Navigation Router ---
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = item.getAttribute('data-tab');
      if (!tabId) return;
      navItems.forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      state.previousTab = null; // clear back history on explicit nav click
      navigateToTab(tabId, true);
    });
  });
}

function navigateToTab(tabId, fromNav = false) {
  // Track history for back button (only when jumping programmatically, e.g. scorecard)
  if (!fromNav && tabId !== state.currentTab) {
    state.previousTab = state.currentTab;
  }
  state.currentTab = tabId;

  // Show back button only for detail views (scorecard)
  const backBtn = document.getElementById('backBtn');
  if (tabId === 'scorecard' && state.previousTab) {
    backBtn.classList.remove('hide');
  } else {
    backBtn.classList.add('hide');
  }

  // Hide all panels, show the active one
  const panels = document.querySelectorAll('.tab-panel');
  panels.forEach(panel => panel.classList.remove('active'));

  const activePanel = document.getElementById(`${tabId}-tab`);
  if (activePanel) activePanel.classList.add('active');

  // Update Page title
  updateTitleBar(tabId);

  // Load data
  loadTabContent(tabId);
}

function navigateBack() {
  const target = state.previousTab || 'live-score';
  state.previousTab = null;
  // Sync sidebar highlight
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-tab') === target);
  });
  navigateToTab(target, true);
}

function updateTitleBar(tabId) {
  const titleEl = document.getElementById('pageTitle');
  const subtitleEl = document.getElementById('pageDescription');
  const addBtn = document.getElementById('globalAddBtn');
  const addBtnText = document.getElementById('globalAddBtnText');
  
  // Hide add button by default
  addBtn.classList.add('hide');

  switch (tabId) {
    case 'live-score':
      titleEl.textContent = 'Live Match Stand';
      subtitleEl.textContent = 'Follow ongoing matches and recent results.';
      break;
    case 'teams':
      titleEl.textContent = 'Team Management';
      subtitleEl.textContent = 'Manage league teams, roster details, and coaching staffs.';
      if (state.isAdmin) {
        addBtn.classList.remove('hide');
        addBtnText.textContent = 'Add Team';
      }
      break;
    case 'players':
      titleEl.textContent = 'Player Profiles';
      subtitleEl.textContent = 'Roster players, ages, roles, and stats details.';
      if (state.isAdmin) {
        addBtn.classList.remove('hide');
        addBtnText.textContent = 'Add Player';
      }
      break;
    case 'matches':
      titleEl.textContent = 'Matches & Schedule';
      subtitleEl.textContent = 'Plan, schedule, and configure championship matches.';
      if (state.isAdmin) {
        addBtn.classList.remove('hide');
        addBtnText.textContent = 'Schedule Match';
      }
      break;
    case 'scorecard':
      titleEl.textContent = 'Match Scorecard';
      subtitleEl.textContent = 'Review detailed batting and bowling performances.';
      break;
    case 'account':
      titleEl.textContent = 'Account Management';
      subtitleEl.textContent = 'Manage your profile and authentication state.';
      break;
  }
}

// --- Fetch Routing Handler ---
async function loadTabContent(tabId) {
  try {
    switch (tabId) {
      case 'live-score':
        await loadLiveScores();
        break;
      case 'teams':
        await loadTeams();
        break;
      case 'players':
        await loadTeams(); // need teams for select filters
        await loadPlayers();
        break;
      case 'matches':
        await loadTeams(); // need teams for forms
        await loadMatches();
        break;
      case 'scorecard':
        // scorecard loads dynamically via card click, handled below
        break;
      case 'statistics':
        await loadStatistics();
        break;
      case 'account':
        // No fetch needed for account tab view
        break;
    }
  } catch (err) {
    showToast(err.message || 'Error fetching resources.', 'error');
  }
}

// ==========================================================================
// 1. LIVE SCORES / MAIN DASHBOARD
// ==========================================================================
async function loadLiveScores() {
  const container = document.getElementById('liveMatchesGrid');
  container.innerHTML = `<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading matches...</div>`;
  
  const response = await fetch(`${API_BASE}/matches`);
  if (!response.ok) throw new Error('Could not fetch matches list.');
  const matches = await response.json();
  state.matches = matches;

  // Update hero stats
  const heroMatchCount = document.getElementById('heroMatchCount');
  const heroLiveCount  = document.getElementById('heroLiveCount');
  const heroTotalCount = document.getElementById('heroTotalCount');
  if (heroMatchCount) heroMatchCount.textContent = `${matches.length} match${matches.length !== 1 ? 'es' : ''} this season`;
  if (heroLiveCount)  heroLiveCount.textContent  = matches.filter(m => m.status === 'live').length;
  if (heroTotalCount) heroTotalCount.textContent = matches.length;

  if (matches.length === 0) {
    container.innerHTML = `<div class="loading-spinner"><i class="fa-solid fa-calendar-xmark"></i> No matches scheduled yet.</div>`;
    return;
  }

  container.innerHTML = '';
  
  // Render each match card
  for (const match of matches) {
    const card = document.createElement('div');
    card.className = 'match-card';
    
    // Status
    let statusClass = 'scheduled';
    let statusLabel = 'Scheduled';
    if (match.status === 'live') { statusClass = 'live'; statusLabel = 'Live'; }
    else if (match.status === 'completed') { statusClass = 'completed'; statusLabel = 'Completed'; }

    // Winner banner
    let resultBanner = `<div class="match-result-banner" style="color:var(--text-3)">Upcoming Match</div>`;
    if (match.status === 'completed') {
      resultBanner = match.winner_id
        ? `<div class="match-result-banner"><i class="fa-solid fa-trophy"></i> ${match.winner_name} won</div>`
        : `<div class="match-result-banner">Match Tie / Draw</div>`;
    } else if (match.status === 'live') {
      resultBanner = `<div class="match-result-banner"><i class="fa-solid fa-tower-broadcast"></i> In Progress</div>`;
    }

    // Score totals
    let scoreDisplay = null;
    if (match.status !== 'scheduled') {
      const scResponse = await fetch(`${API_BASE}/matches/${match.match_id}/scorecard`);
      if (scResponse.ok) {
        const scData = await scResponse.json();
        const t1Runs = scData.team1.players.reduce((s, p) => s + p.runs_scored, 0);
        const t1Wkts = scData.team2.players.reduce((s, p) => s + p.wickets_taken, 0);
        const t2Runs = scData.team2.players.reduce((s, p) => s + p.runs_scored, 0);
        const t2Wkts = scData.team1.players.reduce((s, p) => s + p.wickets_taken, 0);
        scoreDisplay = { team1: `${t1Runs}/${t1Wkts}`, team2: `${t2Runs}/${t2Wkts}` };
      }
    }

    const t1Init = match.team1_name.substring(0,3).toUpperCase();
    const t2Init = match.team2_name.substring(0,3).toUpperCase();
    const isT1Winner = match.winner_id === match.team1_id;
    const isT2Winner = match.winner_id === match.team2_id;

    card.innerHTML = `
      <div class="match-card-accent ${match.status === 'live' ? 'live-accent' : ''}"></div>
      <div class="match-card-inner">
        <div class="match-card-header">
          <span class="match-badge ${statusClass}">${statusLabel}</span>
          <span class="match-date-text">${formatDate(match.match_date)}</span>
        </div>
        <div class="match-teams-display">
          <div class="team-row ${isT1Winner ? 'winner-row' : ''}">
            <span class="team-info-name ${isT1Winner ? 'winner' : ''}">
              <div class="team-flag-placeholder">${t1Init}</div>
              ${match.team1_name}
            </span>
            <span class="team-score-summary">${scoreDisplay ? scoreDisplay.team1 : '\u2014'}</span>
          </div>
          <div class="vs-divider">VS</div>
          <div class="team-row ${isT2Winner ? 'winner-row' : ''}">
            <span class="team-info-name ${isT2Winner ? 'winner' : ''}">
              <div class="team-flag-placeholder">${t2Init}</div>
              ${match.team2_name}
            </span>
            <span class="team-score-summary">${scoreDisplay ? scoreDisplay.team2 : '\u2014'}</span>
          </div>
        </div>
        <div class="match-venue">
          <i class="fa-solid fa-location-dot"></i> ${match.venue}
        </div>
        <div class="match-card-footer">
          ${resultBanner}
          <div style="display:flex;gap:8px;align-items:center;">
            ${state.isAdmin && match.status !== 'completed' ? `<button class="score-match-btn" onclick="openIPLScoring(${match.match_id})" title="Open Live Scoring"><i class="fa-solid fa-radio"></i> Score</button>` : ''}
            <button class="secondary-btn" onclick="viewScorecard(${match.match_id})" style="font-size:0.8rem;padding:8px 16px;">
              <i class="fa-solid fa-list-ul"></i> Scorecard
            </button>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  }
}

// ==========================================================================
// 2. TEAMS MANAGEMENT
// ==========================================================================
async function loadTeams() {
  const response = await fetch(`${API_BASE}/teams`);
  if (!response.ok) throw new Error('Could not fetch teams.');
  const teams = await response.json();
  state.teams = teams;
  
  // Populate dropdown lists in player & match forms
  populateTeamDropdowns();

  if (state.currentTab === 'teams') {
    renderTeamsTab();
  }
}

function renderTeamsTab() {
  const container = document.getElementById('teamsGrid');
  container.innerHTML = '';
  
  if (state.teams.length === 0) {
    container.innerHTML = `<div class="loading-spinner" style="grid-column:1/-1;"><i class="fa-solid fa-circle-exclamation"></i> No teams added yet.</div>`;
    return;
  }

  state.teams.forEach(team => {
    const card = document.createElement('div');
    card.className = 'team-card';
    
    let adminControls = '';
    if (state.isAdmin) {
      adminControls = `
        <div class="team-card-actions">
          <button class="action-icon-btn edit-btn" onclick="openEditTeamModal(${team.team_id})" title="Edit Team">
            <i class="fa-solid fa-pencil"></i>
          </button>
          <button class="action-icon-btn delete-btn" onclick="deleteTeam(${team.team_id})" title="Delete Team">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `;
    }

    // Generate initials avatar
    const initials = team.team_name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    card.innerHTML = `
      <div class="team-card-header">
        <div style="display:flex;align-items:center;gap:14px;">
          <div class="team-avatar">${initials}</div>
          <span class="team-card-title">${team.team_name}</span>
        </div>
        ${adminControls}
      </div>
      <div class="team-meta-list">
        <div class="team-meta-item">
          <i class="fa-solid fa-star"></i>
          <span>Captain: <strong>${team.captain}</strong></span>
        </div>
        <div class="team-meta-item">
          <i class="fa-solid fa-chalkboard-user"></i>
          <span>Coach: <strong>${team.coach}</strong></span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function populateTeamDropdowns() {
  // Populate player assign select
  const pSelect = document.getElementById('playerTeamField');
  const pFilter = document.getElementById('playerTeamFilter');
  const mT1Select = document.getElementById('matchTeam1Field');
  const mT2Select = document.getElementById('matchTeam2Field');

  const optionsHTML = state.teams.map(t => `<option value="${t.team_id}">${t.team_name}</option>`).join('');
  
  pSelect.innerHTML = `<option value="">Select Team...</option>` + optionsHTML;
  mT1Select.innerHTML = `<option value="">Select Team 1...</option>` + optionsHTML;
  mT2Select.innerHTML = `<option value="">Select Team 2...</option>` + optionsHTML;
  
  // Filter sidebar dropdown gets an extra "All Teams" option
  pFilter.innerHTML = `<option value="">All Teams</option>` + optionsHTML;
}

// Add/Edit team form submit
document.getElementById('teamForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('teamIdField').value;
  const team_name = document.getElementById('teamNameField').value;
  const captain = document.getElementById('teamCaptainField').value;
  const coach = document.getElementById('teamCoachField').value;

  const url = id ? `${API_BASE}/teams/${id}` : `${API_BASE}/teams`;
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_name, captain, coach })
    });
    const data = await res.json();
    
    if (!res.ok) throw new Error(data.error || 'Server error saving team.');

    showToast(id ? 'Team details updated.' : 'Team created successfully!');
    closeModal('teamModal');
    loadTeams();
  } catch (err) {
    const errorEl = document.getElementById('teamError');
    errorEl.textContent = err.message;
    errorEl.classList.remove('hide');
  }
});

function openEditTeamModal(id) {
  const team = state.teams.find(t => t.team_id === id);
  if (!team) return;

  document.getElementById('teamModalTitle').textContent = 'Edit Team Details';
  document.getElementById('teamSubmitBtn').textContent = 'Save Changes';
  document.getElementById('teamIdField').value = team.team_id;
  document.getElementById('teamNameField').value = team.team_name;
  document.getElementById('teamCaptainField').value = team.captain;
  document.getElementById('teamCoachField').value = team.coach;
  
  document.getElementById('teamError').classList.add('hide');
  openModal('teamModal');
}

async function deleteTeam(id) {
  if (!confirm('Are you sure you want to delete this team? All associated players, matches, and scorecards will be deleted.')) return;
  try {
    const res = await fetch(`${API_BASE}/teams/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Could not delete team.');
    showToast('Team deleted.');
    loadTeams();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================================================
// 3. PLAYER MODULE
// ==========================================================================
async function loadPlayers() {
  const search = document.getElementById('playerSearchInput').value;
  const team_id = document.getElementById('playerTeamFilter').value;
  const role = document.getElementById('playerRoleFilter').value;
  
  let url = `${API_BASE}/players?`;
  if (search) url += `search=${encodeURIComponent(search)}&`;
  if (team_id) url += `team_id=${team_id}&`;
  if (role) url += `role=${role}&`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not load players.');
  const players = await res.json();
  state.players = players;

  renderPlayersTable();
}

function renderPlayersTable() {
  const tbody = document.getElementById('playersTableBody');
  tbody.innerHTML = '';
  
  // Set header column visibility for admin
  const actionHeaders = document.querySelectorAll('#playersTable .admin-only');
  actionHeaders.forEach(th => {
    if (state.isAdmin) th.classList.remove('hide');
    else th.classList.add('hide');
  });

  if (state.players.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${state.isAdmin ? 5 : 4}" style="text-align:center;">No players matching filters found.</td></tr>`;
    return;
  }

  state.players.forEach(p => {
    const tr = document.createElement('tr');
    
    let adminCell = '';
    if (state.isAdmin) {
      adminCell = `
        <td class="admin-only">
          <button class="action-icon-btn edit-btn" onclick="openEditPlayerModal(${p.player_id})">
            <i class="fa-solid fa-pencil"></i>
          </button>
          <button class="action-icon-btn delete-btn" onclick="deletePlayer(${p.player_id})">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      `;
    }

    tr.innerHTML = `
      <td><strong>${p.player_name}</strong></td>
      <td>${p.age} years</td>
      <td><span class="role-badge ${p.role.replace(' ', '-')}">${p.role}</span></td>
      <td><i class="fa-solid fa-shield-halved"></i> ${p.team_name}</td>
      ${adminCell}
    `;
    tbody.appendChild(tr);
  });
}

// Add/Edit Player Submit
document.getElementById('playerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('playerIdField').value;
  const player_name = document.getElementById('playerNameField').value;
  const age = document.getElementById('playerAgeField').value;
  const role = document.getElementById('playerRoleField').value;
  const team_id = document.getElementById('playerTeamField').value;

  const url = id ? `${API_BASE}/players/${id}` : `${API_BASE}/players`;
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_name, age, role, team_id })
    });
    const data = await res.json();
    
    if (!res.ok) throw new Error(data.error || 'Server error saving player.');

    showToast(id ? 'Player updated.' : 'Player added to team!');
    closeModal('playerModal');
    loadPlayers();
  } catch (err) {
    const errorEl = document.getElementById('playerError');
    errorEl.textContent = err.message;
    errorEl.classList.remove('hide');
  }
});

function openEditPlayerModal(id) {
  const p = state.players.find(x => x.player_id === id);
  if (!p) return;

  document.getElementById('playerModalTitle').textContent = 'Edit Player Info';
  document.getElementById('playerSubmitBtn').textContent = 'Save Changes';
  document.getElementById('playerIdField').value = p.player_id;
  document.getElementById('playerNameField').value = p.player_name;
  document.getElementById('playerAgeField').value = p.age;
  document.getElementById('playerRoleField').value = p.role;
  document.getElementById('playerTeamField').value = p.team_id;

  document.getElementById('playerError').classList.add('hide');
  openModal('playerModal');
}

async function deletePlayer(id) {
  if (!confirm('Are you sure you want to delete this player? All batting and bowling performances will be removed.')) return;
  try {
    const res = await fetch(`${API_BASE}/players/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Could not delete player.');
    showToast('Player deleted.');
    loadPlayers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Setup search & filter handlers
function setupFilterHandlers() {
  const searchInput = document.getElementById('playerSearchInput');
  const teamFilter = document.getElementById('playerTeamFilter');
  const roleFilter = document.getElementById('playerRoleFilter');

  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      loadPlayers().catch(console.error);
    }, 300);
  });

  teamFilter.addEventListener('change', () => loadPlayers().catch(console.error));
  roleFilter.addEventListener('change', () => loadPlayers().catch(console.error));

  // Match Schedule Filters
  const matchFilters = document.querySelectorAll('[data-match-filter]');
  matchFilters.forEach(btn => {
    btn.addEventListener('click', () => {
      matchFilters.forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      const filterValue = btn.getAttribute('data-match-filter');
      loadMatches(filterValue).catch(console.error);
    });
  });
}

// ==========================================================================
// 4. MATCHES SCHEDULER
// ==========================================================================
async function loadMatches(filter = 'all') {
  let url = `${API_BASE}/matches`;
  if (filter !== 'all') {
    url += `?status=${filter}`;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not load matches.');
  const matches = await res.json();
  state.matches = matches;

  renderMatchesTable();
}

function renderMatchesTable() {
  const tbody = document.getElementById('matchesTableBody');
  tbody.innerHTML = '';

  if (state.matches.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No matches found.</td></tr>`;
    return;
  }

  state.matches.forEach(m => {
    const tr = document.createElement('tr');
    
    // Status Badge
    let statusClass = 'scheduled';
    let statusLabel = 'Upcoming';
    if (m.status === 'live') {
      statusClass = 'live';
      statusLabel = 'Live';
    } else if (m.status === 'completed') {
      statusClass = 'completed';
      statusLabel = 'Completed';
    }

    // Result Summary
    let resultSummary = 'Draw / Pending';
    if (m.status === 'completed') {
      resultSummary = m.winner_id ? `<strong>${m.winner_name} won</strong>` : 'Tie / Draw';
    } else if (m.status === 'live') {
      resultSummary = '<span style="color:var(--green)">Live Scorecard</span>';
    }

    // Admin action buttons or guest View Scorecard button
    let actionCell = '';
    if (state.isAdmin) {
      actionCell = `
        <td>
          ${m.status !== 'completed' ? `<button class="score-match-btn" onclick="openIPLScoring(${m.match_id})" title="Live Score" style="margin-right:4px;"><i class="fa-solid fa-radio"></i> Score</button>` : ''}
          <button class="action-icon-btn edit-btn" onclick="openEditMatchModal(${m.match_id})" title="Edit Match">
            <i class="fa-solid fa-pencil"></i>
          </button>
          <button class="action-icon-btn delete-btn" onclick="deleteMatch(${m.match_id})" title="Delete Match">
            <i class="fa-solid fa-trash-can"></i>
          </button>
          <button class="action-icon-btn" onclick="viewScorecard(${m.match_id})" title="View Scorecard" style="color:var(--green)">
            <i class="fa-solid fa-list-check"></i>
          </button>
        </td>
      `;
    } else {
      actionCell = `
        <td>
          <button class="secondary-btn" onclick="viewScorecard(${m.match_id})">
            <i class="fa-solid fa-file-lines"></i> View Card
          </button>
        </td>
      `;
    }

    tr.innerHTML = `
      <td>${formatDate(m.match_date)}</td>
      <td><strong>${m.team1_name}</strong> <span style="color:var(--text-muted)">vs</span> <strong>${m.team2_name}</strong></td>
      <td>${m.venue}</td>
      <td><span class="match-badge ${statusClass}">${statusLabel}</span></td>
      <td>${resultSummary}</td>
      ${actionCell}
    `;
    tbody.appendChild(tr);
  });
}

// Add/Edit Match Submit
document.getElementById('matchForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('matchIdField').value;
  const team1_id = document.getElementById('matchTeam1Field').value;
  const team2_id = document.getElementById('matchTeam2Field').value;
  const match_date = document.getElementById('matchDateField').value;
  const status = document.getElementById('matchStatusField').value;
  const venue = document.getElementById('matchVenueField').value;
  const winner_id = document.getElementById('matchWinnerField').value || null;

  if (team1_id === team2_id) {
    const errorEl = document.getElementById('matchError');
    errorEl.textContent = 'Please choose different teams.';
    errorEl.classList.remove('hide');
    return;
  }

  const url = id ? `${API_BASE}/matches/${id}` : `${API_BASE}/matches`;
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team1_id, team2_id, match_date, status, venue, winner_id })
    });
    const data = await res.json();
    
    if (!res.ok) throw new Error(data.error || 'Server error scheduling match.');

    showToast(id ? 'Match updated.' : 'Match scheduled successfully!');
    closeModal('matchModal');
    loadMatches();
  } catch (err) {
    const errorEl = document.getElementById('matchError');
    errorEl.textContent = err.message;
    errorEl.classList.remove('hide');
  }
});

function openEditMatchModal(id) {
  const m = state.matches.find(x => x.match_id === id);
  if (!m) return;

  document.getElementById('matchModalTitle').textContent = 'Edit Match Schedule';
  document.getElementById('matchSubmitBtn').textContent = 'Save Changes';
  document.getElementById('matchIdField').value = m.match_id;
  document.getElementById('matchTeam1Field').value = m.team1_id;
  document.getElementById('matchTeam2Field').value = m.team2_id;
  
  // Format Date for date input (YYYY-MM-DD)
  const formattedDate = m.match_date.split('T')[0];
  document.getElementById('matchDateField').value = formattedDate;
  
  document.getElementById('matchStatusField').value = m.status;
  document.getElementById('matchVenueField').value = m.venue;

  // Toggle winner selection visibility
  const winnerGroup = document.getElementById('matchWinnerGroup');
  const winnerField = document.getElementById('matchWinnerField');
  
  winnerField.innerHTML = `
    <option value="">Tie / Draw / No Result</option>
    <option value="${m.team1_id}">${m.team1_name}</option>
    <option value="${m.team2_id}">${m.team2_name}</option>
  `;
  winnerField.value = m.winner_id || '';

  if (m.status === 'completed') {
    winnerGroup.classList.remove('hide');
  } else {
    winnerGroup.classList.add('hide');
  }

  // Add event listener to toggle winner dropdown dynamically when status shifts to completed
  document.getElementById('matchStatusField').addEventListener('change', (e) => {
    if (e.target.value === 'completed') {
      const t1_id = document.getElementById('matchTeam1Field').value;
      const t2_id = document.getElementById('matchTeam2Field').value;
      const t1_name = state.teams.find(t => t.team_id == t1_id)?.team_name || 'Team 1';
      const t2_name = state.teams.find(t => t.team_id == t2_id)?.team_name || 'Team 2';
      
      winnerField.innerHTML = `
        <option value="">Tie / Draw / No Result</option>
        <option value="${t1_id}">${t1_name}</option>
        <option value="${t2_id}">${t2_name}</option>
      `;
      winnerGroup.classList.remove('hide');
    } else {
      winnerGroup.classList.add('hide');
    }
  });

  document.getElementById('matchError').classList.add('hide');
  openModal('matchModal');
}

async function deleteMatch(id) {
  if (!confirm('Are you sure you want to cancel and delete this match? Performance scorecards for this match will be lost.')) return;
  try {
    const res = await fetch(`${API_BASE}/matches/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Could not delete match.');
    showToast('Match canceled.');
    loadMatches();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================================================
// 5. SCORECARD & PLAYER PERFORMANCE WRITER
// ==========================================================================
async function viewScorecard(matchId) {
  navigateToTab('scorecard');
  
  try {
    const res = await fetch(`${API_BASE}/matches/${matchId}/scorecard`);
    if (!res.ok) throw new Error('Could not load scorecard data.');
    const data = await res.json();
    state.activeScorecard = data;

    renderScorecardDetails();
  } catch (err) {
    showToast(err.message, 'error');
    navigateToTab('live-score');
  }
}

function renderScorecardDetails() {
  const sc = state.activeScorecard;
  if (!sc) return;

  // Render Header Details
  const headerCard = document.getElementById('scHeaderCard');
  let outcomeText = 'Match Scheduled';
  if (sc.match.status === 'live') {
    outcomeText = 'LIVE: In Progress';
  } else if (sc.match.status === 'completed') {
    outcomeText = sc.match.winner_id ? `${sc.match.winner_name} won` : 'Match Tied / Drawn';
  }

  headerCard.innerHTML = `
    <div class="sc-header-title">${sc.team1.team_name} vs ${sc.team2.team_name}</div>
    <div class="sc-header-meta">${formatDate(sc.match.match_date)} &bull; Venue: ${sc.match.venue}</div>
    <div class="sc-header-result">${outcomeText}</div>
  `;

  // Set tabs labels
  document.getElementById('scTeam1TabBtn').textContent = sc.team1.team_name;
  document.getElementById('scTeam2TabBtn').textContent = sc.team2.team_name;

  // Render Tables for Team 1
  renderIndividualTable(sc.team1.players, 'scTeam1BattingBody', 'scTeam1BowlingBody');

  // Render Tables for Team 2
  renderIndividualTable(sc.team2.players, 'scTeam2BattingBody', 'scTeam2BowlingBody');

  // Toggle visible sections based on tab selection
  toggleScorecardTeam(1);

  // Setup Admin Editor Roster
  setupScorecardEditorDropdown();
}

function renderIndividualTable(players, battingBodyId, bowlingBodyId) {
  const battingBody = document.getElementById(battingBodyId);
  const bowlingBody = document.getElementById(bowlingBodyId);
  
  battingBody.innerHTML = '';
  bowlingBody.innerHTML = '';

  let battingCount = 0;
  let bowlingCount = 0;

  players.forEach(p => {
    // A player is added to batting scorecard if role is batsman, all-rounder, wicket keeper
    // Or if they faced balls / scored runs
    if (p.role !== 'bowler' || p.runs_scored > 0 || p.balls_faced > 0) {
      battingCount++;
      const sr = p.balls_faced > 0 ? ((p.runs_scored * 100) / p.balls_faced).toFixed(2) : '0.00';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${p.player_name}</strong> <span style="font-size:0.75rem;color:var(--text-secondary);text-transform:capitalize;">(${p.role})</span></td>
        <td class="num-col"><strong>${p.runs_scored}</strong></td>
        <td class="num-col">${p.balls_faced}</td>
        <td class="num-col">${p.fours}</td>
        <td class="num-col">${p.sixes}</td>
        <td class="num-col">${sr}</td>
      `;
      battingBody.appendChild(tr);
    }

    // Bowler card if role is bowler or all-rounder
    // Or if they bowled overs / conceded runs
    if (p.role === 'bowler' || p.role === 'all-rounder' || p.overs_bowled > 0) {
      bowlingCount++;
      const econ = p.overs_bowled > 0 ? (p.runs_conceded / p.overs_bowled).toFixed(2) : '0.00';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${p.player_name}</strong></td>
        <td class="num-col">${p.overs_bowled.toFixed(1)}</td>
        <td class="num-col">${p.runs_conceded}</td>
        <td class="num-col"><strong>${p.wickets_taken}</strong></td>
        <td class="num-col">${econ}</td>
      `;
      bowlingBody.appendChild(tr);
    }
  });

  if (battingCount === 0) {
    battingBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No batting performances recorded yet.</td></tr>`;
  }
  if (bowlingCount === 0) {
    bowlingBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No bowling performances recorded yet.</td></tr>`;
  }
}

function toggleScorecardTeam(teamNum) {
  const t1Btn = document.getElementById('scTeam1TabBtn');
  const t2Btn = document.getElementById('scTeam2TabBtn');
  const t1Section = document.getElementById('scTeam1Section');
  const t2Section = document.getElementById('scTeam2Section');

  if (teamNum === 1) {
    t1Btn.classList.add('active');
    t2Btn.classList.remove('active');
    t1Section.classList.add('active');
    t2Section.classList.remove('active');
  } else {
    t1Btn.classList.remove('active');
    t2Btn.classList.add('active');
    t1Section.classList.remove('active');
    t2Section.classList.add('active');
  }
}

// Populate Admin Scorecard Editor Select
function setupScorecardEditorDropdown() {
  const sc = state.activeScorecard;
  const select = document.getElementById('editorPlayerSelect');
  const fields = document.getElementById('editorFormFields');
  const actions = document.getElementById('editorFormActions');
  
  fields.style.display = 'none';
  actions.style.display = 'none';
  
  if (!sc) return;

  let optionsHTML = '<option value="">Choose Player to Update...</option>';
  
  optionsHTML += `<optgroup label="${sc.team1.team_name}">`;
  optionsHTML += sc.team1.players.map(p => `<option value="${p.player_id}">${p.player_name} (${p.role})</option>`).join('');
  optionsHTML += `</optgroup>`;

  optionsHTML += `<optgroup label="${sc.team2.team_name}">`;
  optionsHTML += sc.team2.players.map(p => `<option value="${p.player_id}">${p.player_name} (${p.role})</option>`).join('');
  optionsHTML += `</optgroup>`;

  select.innerHTML = optionsHTML;
  
  // Clean Form Inputs
  resetPerformanceFields();

  // On Player Change
  select.onchange = (e) => {
    const playerId = e.target.value;
    if (!playerId) {
      fields.style.display = 'none';
      actions.style.display = 'none';
      return;
    }
    
    // Find player performance data
    let player = sc.team1.players.find(p => p.player_id == playerId);
    if (!player) {
      player = sc.team2.players.find(p => p.player_id == playerId);
    }
    
    if (player) {
      // Toggle field displays based on player role
      const battingGroup = document.getElementById('battingInputGroup');
      const bowlingGroup = document.getElementById('bowlingInputGroup');

      if (player.role === 'bowler') {
        battingGroup.style.display = 'none';
        bowlingGroup.style.display = 'block';
      } else if (player.role === 'batsman' || player.role === 'wicket keeper') {
        battingGroup.style.display = 'block';
        bowlingGroup.style.display = 'none';
      } else {
        // all-rounder
        battingGroup.style.display = 'block';
        bowlingGroup.style.display = 'block';
      }

      // Populate input values
      document.getElementById('perfRuns').value = player.runs_scored;
      document.getElementById('perfBalls').value = player.balls_faced;
      document.getElementById('perfFours').value = player.fours;
      document.getElementById('perfSixes').value = player.sixes;
      document.getElementById('perfOvers').value = player.overs_bowled.toFixed(1);
      document.getElementById('perfConceded').value = player.runs_conceded;
      document.getElementById('perfWickets').value = player.wickets_taken;

      fields.style.display = 'grid';
      actions.style.display = 'flex';
    }
  };
}

function resetPerformanceFields() {
  document.getElementById('perfRuns').value = 0;
  document.getElementById('perfBalls').value = 0;
  document.getElementById('perfFours').value = 0;
  document.getElementById('perfSixes').value = 0;
  document.getElementById('perfOvers').value = '0.0';
  document.getElementById('perfConceded').value = 0;
  document.getElementById('perfWickets').value = 0;
}

// Cancel perform editor
document.getElementById('cancelPerformanceBtn').addEventListener('click', (e) => {
  e.preventDefault();
  resetPerformanceFields();
});

// Save Performance Action
document.getElementById('savePerformanceBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  const sc = state.activeScorecard;
  if (!sc) return;

  const playerId = document.getElementById('editorPlayerSelect').value;
  if (!playerId) return;

  const runs_scored = parseInt(document.getElementById('perfRuns').value) || 0;
  const balls_faced = parseInt(document.getElementById('perfBalls').value) || 0;
  const fours = parseInt(document.getElementById('perfFours').value) || 0;
  const sixes = parseInt(document.getElementById('perfSixes').value) || 0;
  const overs_bowled = parseFloat(document.getElementById('perfOvers').value) || 0.0;
  const runs_conceded = parseInt(document.getElementById('perfConceded').value) || 0;
  const wickets_taken = parseInt(document.getElementById('perfWickets').value) || 0;

  // Validate overs bowling format (fraction must be <= .5)
  const decimalPart = overs_bowled - Math.floor(overs_bowled);
  if (decimalPart > 0.5) {
    showToast('Invalid overs format. Overs fraction must be between .0 and .5 (e.g. 3.2 is valid, 3.6 is not).', 'warning');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/matches/${sc.match.match_id}/performance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_id: playerId,
        runs_scored,
        balls_faced,
        fours,
        sixes,
        overs_bowled,
        runs_conceded,
        wickets_taken
      })
    });

    if (!res.ok) throw new Error('Failed to record player stats.');
    
    showToast('Player performance updated!');
    // Refresh scorecard card
    viewScorecard(sc.match.match_id);
  } catch (err) {
    showToast(err.message, 'error');
  }
});


// ==========================================================================
// 6. STATISTICS & GRAPHS
// ==========================================================================
async function loadStatistics() {
  // Load points table
  const pointsRes = await fetch(`${API_BASE}/stats/points-table`);
  if (!pointsRes.ok) throw new Error('Error loading points standings.');
  const pointsData = await pointsRes.json();
  renderPointsTable(pointsData);

  // Load highest runs list
  const runsRes = await fetch(`${API_BASE}/stats/highest-runs`);
  if (!runsRes.ok) throw new Error('Error loading highest runs stats.');
  const runsData = await runsRes.json();
  renderLeaderboard(runsData, 'runsLeaderList', 'runs');

  // Load most wickets list
  const wicketsRes = await fetch(`${API_BASE}/stats/most-wickets`);
  if (!wicketsRes.ok) throw new Error('Error loading most wickets stats.');
  const wicketsData = await wicketsRes.json();
  renderLeaderboard(wicketsData, 'wicketsLeaderList', 'wickets');

  // Load cumulative team runs
  const teamRunsRes = await fetch(`${API_BASE}/stats/team-runs`);
  if (!teamRunsRes.ok) throw new Error('Error loading team runs.');
  const teamRunsData = await teamRunsRes.json();

  // Load Charts
  renderCharts(pointsData, teamRunsData);
}

function renderPointsTable(data) {
  const tbody = document.getElementById('pointsTableBody');
  tbody.innerHTML = '';

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-3);">No completed matches yet.</td></tr>`;
    return;
  }

  data.forEach((team, idx) => {
    const rankDisplay = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
    const initials = team.team_name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-size:1.1rem;text-align:center;">${rankDisplay}</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:28px;height:28px;border-radius:7px;background:rgba(0,214,143,0.12);border:1px solid rgba(0,214,143,0.2);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.65rem;color:var(--green);">${initials}</div>
          <strong>${team.team_name}</strong>
        </div>
      </td>
      <td class="num-col">${team.matches_played}</td>
      <td class="num-col" style="color:#4ade80;">${team.wins}</td>
      <td class="num-col" style="color:var(--red);">${team.losses}</td>
      <td class="num-col">${team.ties_draws}</td>
      <td class="num-col" style="color:var(--green);font-weight:800;font-size:1.1rem;">${team.points}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderLeaderboard(data, elementId, type) {
  const container = document.getElementById(elementId);
  container.innerHTML = '';

  if (data.length === 0) {
    container.innerHTML = `<li style="text-align:center;padding:20px;color:var(--text-secondary);">No stats recorded yet.</li>`;
    return;
  }

  data.forEach((p, idx) => {
    const li = document.createElement('li');
    li.className = 'stats-leader-item';
    
    let scoreDisplay = '';
    if (type === 'runs') {
      scoreDisplay = `<span><strong>${p.total_runs}</strong> <span style="font-size:0.75rem;color:var(--text-secondary)">runs</span></span>`;
    } else {
      scoreDisplay = `<span><strong>${p.total_wickets}</strong> <span style="font-size:0.75rem;color:var(--text-secondary)">wkts</span></span>`;
    }

    li.innerHTML = `
      <div class="leader-player-info">
        <div class="leader-rank-badge">${idx + 1}</div>
        <div>
          <div class="leader-name">${p.player_name}</div>
          <div class="leader-team">${p.team_name} &bull; <span style="text-transform:capitalize;">${p.role}</span></div>
        </div>
      </div>
      <div class="leader-score">${scoreDisplay}</div>
    `;
    container.appendChild(li);
  });
}

function renderCharts(pointsData, teamRunsData) {
  // Chart 1: Standings points distribution (Bar Chart)
  const ctxPoints = document.getElementById('pointsChart').getContext('2d');
  
  if (state.charts.points) {
    state.charts.points.destroy();
  }

  const pointsLabels = pointsData.map(t => t.team_name);
  const pointsValues = pointsData.map(t => t.points);

  state.charts.points = new Chart(ctxPoints, {
    type: 'bar',
    data: {
      labels: pointsLabels,
      datasets: [{
        label: 'Points',
        data: pointsValues,
        backgroundColor: pointsLabels.map((_, i) => [
          'rgba(0, 214, 143, 0.7)',
          'rgba(251, 191, 36, 0.7)',
          'rgba(10, 132, 255, 0.7)',
          'rgba(191, 90, 242, 0.7)'
        ][i % 4]),
        borderColor: pointsLabels.map((_, i) => [
          'rgba(0, 214, 143, 1)',
          'rgba(251, 191, 36, 1)',
          'rgba(10, 132, 255, 1)',
          'rgba(191, 90, 242, 1)'
        ][i % 4]),
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: 'rgba(255,255,255,0.4)', font: { family: 'Inter', size: 11 } }
        },
        x: {
          grid: { display: false },
          ticks: { color: 'rgba(255,255,255,0.5)', font: { family: 'Outfit', weight: '700', size: 12 } }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(20,25,32,0.95)',
          borderColor: 'rgba(0,214,143,0.2)',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: 'rgba(255,255,255,0.6)',
          cornerRadius: 10
        }
      }
    }
  });

  // Chart 2: Team Cumulative Runs (Doughnut Chart)
  const ctxRuns = document.getElementById('teamRunsChart').getContext('2d');
  
  if (state.charts.teamRuns) {
    state.charts.teamRuns.destroy();
  }

  const runsLabels = teamRunsData.map(t => t.team_name);
  const runsValues = teamRunsData.map(t => t.cumulative_runs);

  // Curated Apple-style palette for teams
  const colors = [
    'rgba(0, 214, 143, 0.80)',
    'rgba(251, 191, 36, 0.80)',
    'rgba(10, 132, 255, 0.80)',
    'rgba(191, 90, 242, 0.80)'
  ];
  const borderColors = [
    'rgba(0, 214, 143, 1)',
    'rgba(251, 191, 36, 1)',
    'rgba(10, 132, 255, 1)',
    'rgba(191, 90, 242, 1)'
  ];

  state.charts.teamRuns = new Chart(ctxRuns, {
    type: 'doughnut',
    data: {
      labels: runsLabels,
      datasets: [{
        data: runsValues,
        backgroundColor: colors.slice(0, runsLabels.length),
        borderColor: borderColors.slice(0, runsLabels.length),
        borderWidth: 2,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: 'rgba(255,255,255,0.7)',
            font: { family: 'Outfit', size: 12, weight: '600' },
            padding: 16,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(20,25,32,0.95)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: 'rgba(255,255,255,0.6)',
          cornerRadius: 10
        }
      }
    }
  });
}

// ==========================================================================
// AUTHENTICATION SYSTEM (Signup & Login)
// ==========================================================================
function setupUserAuth() {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');

  // Handle Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;
    const btn = loginForm.querySelector('button');
    btn.disabled = true;

    try {
      const res = await originalFetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed.');

      processLoginResponse(data);
      showToast('Welcome back, ' + data.user.username + '!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Handle Signup
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('signupUser').value;
    const password = document.getElementById('signupPass').value;
    const btn = signupForm.querySelector('button');
    btn.disabled = true;

    try {
      const res = await originalFetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed.');

      showToast('Account created! Please log in.', 'success');
      switchAuthTab('login');
      document.getElementById('loginUser').value = username;
      document.getElementById('signupForm').reset();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Check existing token on load
  verifyToken();
}

async function verifyToken() {
  const token = localStorage.getItem('authToken');
  if (!token) return;

  try {
    const res = await originalFetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error('Token expired');
    
    processLoginResponse({ token, user: data.user }, false);
  } catch (err) {
    logoutUser(false);
  }
}

function processLoginResponse(data, redirect = true) {
  state.currentUser = data.user;
  state.isAdmin = data.user.role === 'admin';
  localStorage.setItem('authToken', data.token);
  
  updateAuthUI();
  updateAdminUI();
  
  if (redirect && state.currentTab === 'account') {
    loadTabContent(state.currentTab);
  }
}

function logoutUser(forced = false) {
  state.currentUser = null;
  state.isAdmin = false;
  localStorage.removeItem('authToken');
  
  updateAuthUI();
  updateAdminUI();
  
  if (forced) {
    showToast('Session expired. Please log in again.', 'warning');
  } else {
    showToast('Logged out successfully.');
  }
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const btns = document.querySelectorAll('.auth-tab-btn');
  
  btns.forEach(b => b.classList.remove('active'));
  
  if (tab === 'login') {
    btns[0].classList.add('active');
    loginForm.style.display = 'flex';
    signupForm.style.display = 'none';
  } else {
    btns[1].classList.add('active');
    loginForm.style.display = 'none';
    signupForm.style.display = 'flex';
  }
}

function updateAuthUI() {
  const formsContainer = document.getElementById('authFormsContainer');
  const profileContainer = document.getElementById('userProfileContainer');
  const sidebarUser = document.getElementById('sidebarUser');
  const sidebarLoginBtn = document.getElementById('sidebarLoginBtn');

  if (state.currentUser) {
    // Logged in
    formsContainer.style.display = 'none';
    profileContainer.style.display = 'flex';
    sidebarUser.style.display = 'flex';
    sidebarLoginBtn.innerHTML = `<i class="fa-solid fa-right-from-bracket" title="Log Out"></i>`;
    
    // Update labels
    const u = state.currentUser;
    const initial = u.username.charAt(0).toUpperCase();
    
    document.getElementById('profileAvatar').textContent = initial;
    document.getElementById('sidebarAvatar').textContent = initial;
    
    document.getElementById('profileUsername').textContent = u.username;
    document.getElementById('sidebarUserName').textContent = u.username;
    
    document.getElementById('profileRole').textContent = u.role;
    document.getElementById('sidebarUserRole').textContent = u.role;
    
    if (u.role === 'admin') {
      document.getElementById('profileRole').classList.add('admin');
      document.getElementById('profileAdminText').style.display = 'inline';
    } else {
      document.getElementById('profileRole').classList.remove('admin');
      document.getElementById('profileAdminText').style.display = 'none';
    }
  } else {
    // Not logged in
    formsContainer.style.display = 'flex';
    profileContainer.style.display = 'none';
    sidebarUser.style.display = 'none';
    sidebarLoginBtn.innerHTML = `<i class="fa-solid fa-right-to-bracket" title="Log In"></i>`;
  }
}

function updateAdminUI() {
  const card = document.getElementById('adminStatusCard');
  const statusLabel = card.querySelector('.status-label');
  const statusDesc = card.querySelector('.status-desc');
  const adminElements = document.querySelectorAll('.admin-only');

  if (state.isAdmin) {
    card.classList.add('logged-in');
    statusLabel.textContent = 'Admin Mode';
    statusDesc.textContent = 'Full editing rights active';
    adminElements.forEach(el => el.classList.remove('hide'));
  } else {
    card.classList.remove('logged-in');
    statusLabel.textContent = 'Viewer Mode';
    statusDesc.textContent = 'Log in to edit scores';
    adminElements.forEach(el => el.classList.add('hide'));
  }

  // Update page headers
  updateTitleBar(state.currentTab);
}

// ==========================================================================
// MODALS & GENERAL ACTION WORKFLOWS
// ==========================================================================
function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

function setupGlobalActions() {
  const addBtn = document.getElementById('globalAddBtn');
  
  addBtn.addEventListener('click', () => {
    if (state.currentTab === 'teams') {
      document.getElementById('teamModalTitle').textContent = 'Add New Team';
      document.getElementById('teamSubmitBtn').textContent = 'Create Team';
      document.getElementById('teamForm').reset();
      document.getElementById('teamIdField').value = '';
      document.getElementById('teamError').classList.add('hide');
      openModal('teamModal');
    } else if (state.currentTab === 'players') {
      document.getElementById('playerModalTitle').textContent = 'Add New Player';
      document.getElementById('playerSubmitBtn').textContent = 'Add Player';
      document.getElementById('playerForm').reset();
      document.getElementById('playerIdField').value = '';
      document.getElementById('playerError').classList.add('hide');
      openModal('playerModal');
    } else if (state.currentTab === 'matches') {
      document.getElementById('matchModalTitle').textContent = 'Schedule New Match';
      document.getElementById('matchSubmitBtn').textContent = 'Schedule Match';
      document.getElementById('matchForm').reset();
      document.getElementById('matchIdField').value = '';
      document.getElementById('matchWinnerGroup').classList.add('hide');
      document.getElementById('matchError').classList.add('hide');
      openModal('matchModal');
    }
  });
}

// --- Dynamic Toast Notifications ---
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'warning' ? 'toast-warning' : ''}`;
  
  let icon = '<i class="fa-solid fa-circle-check" style="color:var(--green)"></i>';
  if (type === 'error') {
    icon = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--red)"></i>';
  } else if (type === 'warning') {
    icon = '<i class="fa-solid fa-circle-exclamation" style="color:var(--gold)"></i>';
  }

  toast.innerHTML = `
    ${icon}
    <span>${message}</span>
  `;
  
  container.appendChild(toast);

  // Remove toast after delay
  setTimeout(() => {
    toast.style.animation = 'toastIn 0.3s reverse forwards ease-in';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// --- Date Formatter Helper ---
function formatDate(dateString) {
  if (!dateString) return '-';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', options);
}
