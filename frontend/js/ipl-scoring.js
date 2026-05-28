/* ==========================================================================
   IPL Live Scoring Engine — ipl-scoring.js
   Ball-by-ball scoring with real-time stats, undo, over history
   ========================================================================== */

// ─── IPL Scoring State ───────────────────────────────────────────────────────
const ipl = {
  matchId: null,
  matchData: null,          // Full match object from API
  scorecardData: null,      // Existing scorecard from API

  // Teams
  team1: null,
  team2: null,
  battingTeamId: null,
  bowlingTeamId: null,

  // Players available
  battingPlayers: [],       // Players from batting team
  bowlingPlayers: [],       // Players from bowling team

  // Current players on field
  strikerId: null,
  nonStrikerId: null,
  bowlerId: null,

  // Accumulated per-player stats for this session
  // { playerId: { runs, balls, fours, sixes, overs, conceded, wickets } }
  session: {},

  // Innings state
  totalRuns: 0,
  totalWickets: 0,
  totalExtras: 0,
  currentOverNum: 1,     // 1-indexed over number
  currentBallNum: 0,     // Legal balls in this over (max 6)
  currentOverBalls: [],  // Ball-by-ball records for current over display
  completedOvers: [],    // Array of over summaries { overNum, balls[], runsInOver }

  // History stack for undo
  history: [],

  // Is the session actively scoring?
  isScoring: false
};

// ─── Open IPL Scoring Panel ──────────────────────────────────────────────────
async function openIPLScoring(matchId) {
  if (!state.isAdmin) {
    showToast('Admin login required to score.', 'error');
    return;
  }

  // Reset state
  Object.assign(ipl, {
    matchId, matchData: null, scorecardData: null,
    team1: null, team2: null, battingTeamId: null, bowlingTeamId: null,
    battingPlayers: [], bowlingPlayers: [],
    strikerId: null, nonStrikerId: null, bowlerId: null,
    session: {}, totalRuns: 0, totalWickets: 0, totalExtras: 0,
    currentOverNum: 1, currentBallNum: 0, currentOverBalls: [],
    completedOvers: [], history: [], isScoring: false
  });

  try {
    // Load match + scorecard
    const [mRes, scRes] = await Promise.all([
      fetch(`${API_BASE}/matches`),
      fetch(`${API_BASE}/matches/${matchId}/scorecard`)
    ]);

    const allMatches = await mRes.json();
    ipl.matchData = allMatches.find(m => m.match_id === matchId);
    if (!ipl.matchData) throw new Error('Match not found.');

    if (scRes.ok) {
      ipl.scorecardData = await scRes.json();
      ipl.team1 = ipl.scorecardData.team1;
      ipl.team2 = ipl.scorecardData.team2;
    } else {
      throw new Error('Could not load scorecard data.');
    }

    // Set subtitle
    document.getElementById('iplMatchSubtitle').textContent =
      `${ipl.matchData.team1_name} vs ${ipl.matchData.team2_name} · ${ipl.matchData.venue}`;

    // Populate batting team selector
    const btSelect = document.getElementById('iplBattingTeamSelect');
    btSelect.innerHTML = `
      <option value="">Select batting team...</option>
      <option value="${ipl.team1.team_id}">${ipl.team1.team_name}</option>
      <option value="${ipl.team2.team_id}">${ipl.team2.team_name}</option>
    `;

    // Wire up batting team change to populate player selects
    btSelect.onchange = () => iplPopulatePlayers();

    // Reset panels
    document.getElementById('iplSetupPanel').style.display = 'flex';
    document.getElementById('iplLivePanel').style.display = 'none';
    document.getElementById('iplWicketOverlay').style.display = 'none';
    iplResetScoreDisplay();
    iplUpdateOverDisplay();
    setIPLBallBtnsEnabled(false);
    document.getElementById('iplSaveFinalBtn').disabled = true;

    // Show modal
    document.getElementById('iplScoringModal').classList.add('active');
    document.body.style.overflow = 'hidden';

  } catch (err) {
    showToast(err.message, 'error');
  }
}

function iplPopulatePlayers() {
  const btSelect   = document.getElementById('iplBattingTeamSelect');
  const strikerSel = document.getElementById('iplStrikerSelect');
  const nsSel      = document.getElementById('iplNonStrikerSelect');
  const bowlerSel  = document.getElementById('iplBowlerSelect');

  const battingId = parseInt(btSelect.value);
  if (!battingId) return;

  const bowlingId = battingId === ipl.team1.team_id ? ipl.team2.team_id : ipl.team1.team_id;
  ipl.battingTeamId  = battingId;
  ipl.bowlingTeamId  = bowlingId;

  const battingTeam = battingId === ipl.team1.team_id ? ipl.team1 : ipl.team2;
  const bowlingTeam = bowlingId === ipl.team1.team_id ? ipl.team1 : ipl.team2;

  ipl.battingPlayers = battingTeam.players;
  ipl.bowlingPlayers = bowlingTeam.players;

  const battingOpts = ipl.battingPlayers.map(p =>
    `<option value="${p.player_id}">${p.player_name} (${p.role})</option>`
  ).join('');

  const bowlingOpts = ipl.bowlingPlayers.map(p =>
    `<option value="${p.player_id}">${p.player_name} (${p.role})</option>`
  ).join('');

  strikerSel.innerHTML = `<option value="">Select striker...</option>${battingOpts}`;
  nsSel.innerHTML      = `<option value="">Select non-striker...</option>${battingOpts}`;
  bowlerSel.innerHTML  = `<option value="">Select bowler...</option>${bowlingOpts}`;

  document.getElementById('iplBattingTeamName').textContent = battingTeam.team_name;
}

function closeIPLScoring() {
  document.getElementById('iplScoringModal').classList.remove('active');
  document.body.style.overflow = '';
}

// ─── Start Scoring ─────────────────────────────────────────────────────────
function startIPLScoring() {
  const strikerId   = parseInt(document.getElementById('iplStrikerSelect').value);
  const nonStrikerId = parseInt(document.getElementById('iplNonStrikerSelect').value);
  const bowlerId    = parseInt(document.getElementById('iplBowlerSelect').value);
  const battingId   = parseInt(document.getElementById('iplBattingTeamSelect').value);

  if (!battingId) { showToast('Please select batting team.', 'warning'); return; }
  if (!strikerId || !nonStrikerId) { showToast('Please select both batsmen.', 'warning'); return; }
  if (strikerId === nonStrikerId) { showToast('Striker and non-striker must be different players.', 'warning'); return; }
  if (!bowlerId) { showToast('Please select a bowler.', 'warning'); return; }

  ipl.strikerId    = strikerId;
  ipl.nonStrikerId = nonStrikerId;
  ipl.bowlerId     = bowlerId;
  ipl.isScoring    = true;

  // Init session stats for selected players
  [strikerId, nonStrikerId, bowlerId].forEach(id => iplInitPlayerSession(id));

  // Show live panel
  document.getElementById('iplSetupPanel').style.display = 'none';
  document.getElementById('iplLivePanel').style.display  = 'flex';
  document.getElementById('iplSaveFinalBtn').disabled     = false;

  // Enable scoring buttons
  setIPLBallBtnsEnabled(true);

  // Render panels
  iplRenderLiveStats();
  iplUpdateOverDisplay();
  iplPopulateNewBatsmanSelect();
}

function iplInitPlayerSession(playerId) {
  if (!ipl.session[playerId]) {
    // Try to load existing stats from scorecard
    let existing = null;
    if (ipl.scorecardData) {
      existing = [...ipl.scorecardData.team1.players, ...ipl.scorecardData.team2.players]
        .find(p => p.player_id === playerId);
    }
    ipl.session[playerId] = {
      runs: existing?.runs_scored || 0,
      balls: existing?.balls_faced || 0,
      fours: existing?.fours || 0,
      sixes: existing?.sixes || 0,
      overs: existing?.overs_bowled || 0,
      conceded: existing?.runs_conceded || 0,
      wickets: existing?.wickets_taken || 0
    };
  }
}

// ─── Record Ball ────────────────────────────────────────────────────────────
function recordBall(outcome) {
  if (!ipl.isScoring) return;

  const striker  = ipl.session[ipl.strikerId];
  const nonStriker = ipl.session[ipl.nonStrikerId];
  const bowler   = ipl.session[ipl.bowlerId];

  // Save snapshot for undo
  ipl.history.push({
    strikerId: ipl.strikerId,
    nonStrikerId: ipl.nonStrikerId,
    bowlerId: ipl.bowlerId,
    strikerSnap: { ...striker },
    nonStrikerSnap: { ...nonStriker },
    bowlerSnap: { ...bowler },
    totalRuns: ipl.totalRuns,
    totalWickets: ipl.totalWickets,
    totalExtras: ipl.totalExtras,
    currentBallNum: ipl.currentBallNum,
    currentOverBalls: [...ipl.currentOverBalls]
  });
  if (ipl.history.length > 30) ipl.history.shift(); // cap history

  let ballLabel = '';
  let ballClass = '';
  let isLegalBall = true;  // Wides + No balls don't count as legal delivery

  switch (outcome) {
    case 'dot':
      striker.balls++;
      bowler.conceded += 0;
      ballLabel = '0'; ballClass = 'dot-ball';
      ipl.totalRuns += 0;
      break;

    case 1: case 2: case 3:
      striker.runs  += outcome;
      striker.balls++;
      bowler.conceded += outcome;
      ipl.totalRuns  += outcome;
      ballLabel = String(outcome);
      ballClass = `run-${outcome}`;
      // Swap strike on odd runs
      if (outcome % 2 === 1) iplSwapStrike();
      break;

    case 4:
      striker.runs  += 4;
      striker.balls++;
      striker.fours++;
      bowler.conceded += 4;
      ipl.totalRuns  += 4;
      ballLabel = '4'; ballClass = 'run-4';
      break;

    case 6:
      striker.runs  += 6;
      striker.balls++;
      striker.sixes++;
      bowler.conceded += 6;
      ipl.totalRuns  += 6;
      ballLabel = '6'; ballClass = 'run-6';
      break;

    case 'miss':
      striker.balls++;
      ballLabel = '0'; ballClass = 'dot-ball';
      break;

    case 'out':
      striker.balls++;
      bowler.wickets++;
      ipl.totalWickets++;
      ipl.totalRuns += 0;
      ballLabel = 'W'; ballClass = 'wicket';
      // Show wicket overlay
      setTimeout(() => {
        const name = iplGetPlayerName(ipl.strikerId);
        document.getElementById('iplWicketMsg').textContent = `${name} is OUT!`;
        document.getElementById('iplWicketOverlay').style.display = 'block';
        iplPopulateNewBatsmanSelect();
      }, 150);
      break;

    case 'wide':
      bowler.conceded++;
      ipl.totalRuns++;
      ipl.totalExtras++;
      ballLabel = 'WD'; ballClass = 'wide';
      isLegalBall = false; // Wide does not count as legal ball
      break;

    case 'noball':
      bowler.conceded++;
      ipl.totalRuns++;
      ipl.totalExtras++;
      ballLabel = 'NB'; ballClass = 'noball';
      isLegalBall = false; // No ball doesn't count
      break;

    case 'bye':
      striker.balls++;
      ipl.totalRuns++;
      ipl.totalExtras++;
      ballLabel = 'B'; ballClass = 'bye';
      break;

    case 'legbye':
      striker.balls++;
      ipl.totalRuns++;
      ipl.totalExtras++;
      ballLabel = 'LB'; ballClass = 'bye';
      break;
  }

  // Add ball to current over display
  ipl.currentOverBalls.push({ label: ballLabel, cls: ballClass });

  // Increment legal ball counter
  if (isLegalBall) {
    ipl.currentBallNum++;
  }

  // Update bowler overs (only count legal balls)
  if (isLegalBall) {
    const legalBalls = Math.floor(bowler.overs) * 6 + Math.round((bowler.overs % 1) * 10);
    const newLegal = legalBalls + 1;
    bowler.overs = Math.floor(newLegal / 6) + (newLegal % 6) / 10;
  }

  iplUpdateOverDisplay();
  iplRenderLiveStats();
  iplUpdateScoreDisplay();

  // Auto-end over after 6 legal balls
  if (ipl.currentBallNum >= 6) {
    document.getElementById('iplEndOverBtn').disabled = false;
    setIPLBallBtnsEnabled(false);
    showToast(`Over ${ipl.currentOverNum} complete! Change bowler to continue.`, 'warning');
  }
}

// ─── Undo Last Ball ─────────────────────────────────────────────────────────
function undoLastBall() {
  if (ipl.history.length === 0) {
    showToast('Nothing to undo.', 'warning');
    return;
  }

  const snap = ipl.history.pop();
  ipl.strikerId    = snap.strikerId;
  ipl.nonStrikerId = snap.nonStrikerId;
  ipl.bowlerId     = snap.bowlerId;
  ipl.session[snap.strikerId]    = { ...snap.strikerSnap };
  ipl.session[snap.nonStrikerId] = { ...snap.nonStrikerSnap };
  ipl.session[snap.bowlerId]     = { ...snap.bowlerSnap };
  ipl.totalRuns    = snap.totalRuns;
  ipl.totalWickets = snap.totalWickets;
  ipl.totalExtras  = snap.totalExtras;
  ipl.currentBallNum   = snap.currentBallNum;
  ipl.currentOverBalls = [...snap.currentOverBalls];

  // Re-enable ball buttons if we're back to < 6 legal balls
  if (ipl.currentBallNum < 6 && ipl.isScoring) {
    setIPLBallBtnsEnabled(true);
    document.getElementById('iplEndOverBtn').disabled = true;
  }

  iplUpdateOverDisplay();
  iplRenderLiveStats();
  iplUpdateScoreDisplay();
  document.getElementById('iplWicketOverlay').style.display = 'none';
  showToast('Last ball undone.');
}

// ─── End Over (change bowler) ────────────────────────────────────────────────
function endOver() {
  // Archive the current over
  const runsThisOver = ipl.currentOverBalls
    .filter(b => !['WD','NB'].includes(b.label))
    .reduce((sum, b) => {
      const n = parseInt(b.label);
      return sum + (isNaN(n) ? 0 : n);
    }, 0);

  ipl.completedOvers.push({
    overNum: ipl.currentOverNum,
    balls: [...ipl.currentOverBalls],
    runs: runsThisOver
  });

  ipl.currentOverNum++;
  ipl.currentBallNum = 0;
  ipl.currentOverBalls = [];

  // Swap strike at end of over
  iplSwapStrike();

  // Update over history display
  iplRenderOverHistory();
  iplUpdateOverDisplay();
  iplUpdateScoreDisplay();

  // Prompt bowler change
  document.getElementById('iplEndOverBtn').disabled = true;

  // Open bowler select prompt
  const bowlerSel = document.getElementById('iplBowlerSelect') ||
                    iplCreateBowlerChangePrompt();
  iplShowBowlerChangeUI();
}

function iplShowBowlerChangeUI() {
  // Re-use the new batsman section to also switch bowler
  const livePanel = document.getElementById('iplLivePanel');

  // Build an inline prompt
  let overlay = document.getElementById('iplBowlerChangePrompt');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'iplBowlerChangePrompt';
    overlay.style.cssText = `
      background: rgba(191,90,242,0.06);
      border: 1px solid rgba(191,90,242,0.3);
      border-radius: var(--r-md);
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    overlay.innerHTML = `
      <div style="font-size:0.7rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--purple);margin-bottom:2px;">
        <i class="fa-solid fa-bowling-ball"></i> New Bowler
      </div>
      <select class="ipl-select" id="iplNewBowlerSelect" style="font-size:0.85rem;">
        <option value="">Select new bowler...</option>
      </select>
      <button class="ipl-end-over-btn" style="border-color:rgba(191,90,242,0.4);color:var(--purple);" onclick="confirmBowlerChange()">
        <i class="fa-solid fa-check"></i> Confirm Bowler &amp; Continue
      </button>
    `;
    livePanel.insertBefore(overlay, document.getElementById('iplSaveSessionBtn'));
  }

  // Populate bowler options
  const bowlerSel = document.getElementById('iplNewBowlerSelect');
  const opts = ipl.bowlingPlayers.map(p =>
    `<option value="${p.player_id}" ${p.player_id === ipl.bowlerId ? 'selected' : ''}>${p.player_name} (${p.role})</option>`
  ).join('');
  bowlerSel.innerHTML = `<option value="">Select new bowler...</option>${opts}`;

  overlay.style.display = 'flex';
}

function confirmBowlerChange() {
  const newBowlerId = parseInt(document.getElementById('iplNewBowlerSelect').value);
  if (!newBowlerId) { showToast('Select a bowler to continue.', 'warning'); return; }

  ipl.bowlerId = newBowlerId;
  iplInitPlayerSession(newBowlerId);

  const prompt = document.getElementById('iplBowlerChangePrompt');
  if (prompt) prompt.style.display = 'none';

  setIPLBallBtnsEnabled(true);
  iplRenderLiveStats();
  showToast(`Over ${ipl.currentOverNum}: ${iplGetPlayerName(newBowlerId)} is bowling.`);
}

// ─── Swap Batsman (Wicket / Between Overs) ──────────────────────────────────
function swapBatsman() {
  const newId = parseInt(document.getElementById('iplNewBatsmanSelect').value);
  if (!newId) { showToast('Select the new batsman.', 'warning'); return; }

  ipl.strikerId = newId;
  iplInitPlayerSession(newId);
  iplPopulateNewBatsmanSelect();
  document.getElementById('iplWicketOverlay').style.display = 'none';
  setIPLBallBtnsEnabled(ipl.currentBallNum < 6);
  iplRenderLiveStats();
  showToast(`${iplGetPlayerName(newId)} is in at the crease.`);
}

function iplPopulateNewBatsmanSelect() {
  const sel = document.getElementById('iplNewBatsmanSelect');
  const usedIds = [ipl.strikerId, ipl.nonStrikerId].filter(Boolean);
  const remaining = ipl.battingPlayers.filter(p => !usedIds.includes(p.player_id));
  const opts = remaining.map(p =>
    `<option value="${p.player_id}">${p.player_name} (${p.role})</option>`
  ).join('');
  sel.innerHTML = `<option value="">New batsman coming in...</option>${opts}`;
}

// ─── Strike Swap ────────────────────────────────────────────────────────────
function iplSwapStrike() {
  [ipl.strikerId, ipl.nonStrikerId] = [ipl.nonStrikerId, ipl.strikerId];
}

// ─── UI Rendering ────────────────────────────────────────────────────────────
function iplRenderLiveStats() {
  const striker  = ipl.session[ipl.strikerId];
  const nonStriker = ipl.session[ipl.nonStrikerId];
  const bowler   = ipl.session[ipl.bowlerId];

  if (!striker || !nonStriker || !bowler) return;

  // Striker
  document.getElementById('iplStrikerName').textContent = iplGetPlayerName(ipl.strikerId);
  document.getElementById('iplStrikerRuns').textContent = striker.runs;
  document.getElementById('iplStrikerBalls').textContent = striker.balls;
  document.getElementById('iplStrikerSR').textContent =
    `SR: ${striker.balls > 0 ? ((striker.runs / striker.balls) * 100).toFixed(2) : '0.00'}`;
  const sRole = iplGetPlayerRole(ipl.strikerId);
  document.getElementById('iplStrikerRole').textContent = `${sRole} · ${striker.fours}×4 · ${striker.sixes}×6`;

  // Non-striker
  document.getElementById('iplNonStrikerName').textContent = iplGetPlayerName(ipl.nonStrikerId);
  document.getElementById('iplNonStrikerRuns').textContent = nonStriker.runs;
  document.getElementById('iplNonStrikerBalls').textContent = nonStriker.balls;
  document.getElementById('iplNonStrikerSR').textContent =
    `SR: ${nonStriker.balls > 0 ? ((nonStriker.runs / nonStriker.balls) * 100).toFixed(2) : '0.00'}`;

  // Bowler
  document.getElementById('iplBowlerName').textContent = iplGetPlayerName(ipl.bowlerId);
  const oversStr = bowler.overs.toFixed(1);
  document.getElementById('iplBowlerStats').textContent =
    `Econ: ${bowler.overs > 0 ? (bowler.conceded / bowler.overs).toFixed(2) : '0.00'}`;
  document.getElementById('iplBowlerFigures').textContent = `${bowler.wickets}/${bowler.conceded} (${oversStr})`;
}

function iplUpdateScoreDisplay() {
  document.getElementById('iplTotalRuns').textContent = ipl.totalRuns;
  document.getElementById('iplTotalWickets').textContent = ipl.totalWickets;
  document.getElementById('iplExtras').textContent = ipl.totalExtras;

  // Overs display: completedOvers + currentBallNum
  const overs = ipl.completedOvers.length + (ipl.currentBallNum / 10);
  document.getElementById('iplOversDisplay').textContent = overs.toFixed(1);

  // CRR
  const totalOvers = ipl.completedOvers.length + ipl.currentBallNum / 6;
  const crr = totalOvers > 0 ? (ipl.totalRuns / totalOvers).toFixed(2) : '0.00';
  document.getElementById('iplCRR').textContent = crr;

  document.getElementById('iplOverNumber').textContent = `Over ${ipl.currentOverNum}`;
}

function iplResetScoreDisplay() {
  document.getElementById('iplTotalRuns').textContent = '0';
  document.getElementById('iplTotalWickets').textContent = '0';
  document.getElementById('iplExtras').textContent = '0';
  document.getElementById('iplOversDisplay').textContent = '0.0';
  document.getElementById('iplCRR').textContent = '0.00';
  document.getElementById('iplOverNumber').textContent = 'Over 1';
  document.getElementById('iplOverHistory').innerHTML =
    '<div style="font-size:0.8rem;color:var(--text-4);text-align:center;padding:10px 0;">No completed overs yet</div>';
}

function iplUpdateOverDisplay() {
  const container = document.getElementById('iplOverBalls');
  container.innerHTML = '';

  const totalSlots = 6;
  const ballsToShow = [...ipl.currentOverBalls];

  // Show recorded balls
  ballsToShow.forEach(b => {
    const div = document.createElement('div');
    div.className = `ipl-ball ${b.cls}`;
    div.textContent = b.label;
    container.appendChild(div);
  });

  // Fill remaining empty slots
  const remaining = totalSlots - Math.min(ballsToShow.length, totalSlots);
  for (let i = 0; i < remaining; i++) {
    const div = document.createElement('div');
    div.className = 'ipl-ball empty';
    container.appendChild(div);
  }

  // If there are extras (wides/no balls), we may have more than 6 elements — show them all
  if (ballsToShow.length > totalSlots) {
    ballsToShow.slice(totalSlots).forEach(b => {
      const div = document.createElement('div');
      div.className = `ipl-ball ${b.cls}`;
      div.textContent = b.label;
      container.appendChild(div);
    });
  }
}

function iplRenderOverHistory() {
  const container = document.getElementById('iplOverHistory');

  if (ipl.completedOvers.length === 0) {
    container.innerHTML = '<div style="font-size:0.8rem;color:var(--text-4);text-align:center;padding:10px 0;">No completed overs yet</div>';
    return;
  }

  container.innerHTML = '';
  [...ipl.completedOvers].reverse().forEach(over => {
    const chip = document.createElement('div');
    chip.className = 'ipl-over-chip';

    const miniCls = {
      'wicket': 'wkt', 'run-4': 'r4', 'run-6': 'r6', 'wide': 'wd', 'noball': 'nb'
    };

    const ballsHTML = over.balls.map(b => {
      const cls = miniCls[b.cls] || '';
      return `<div class="ipl-mini-ball ${cls}">${b.label}</div>`;
    }).join('');

    chip.innerHTML = `
      <span class="ipl-over-chip-label">Ov ${over.overNum}</span>
      <div class="ipl-over-chip-balls">${ballsHTML}</div>
      <span style="margin-left:auto;font-weight:700;font-size:0.8rem;color:var(--text-1);">${over.runs}</span>
    `;
    container.appendChild(chip);
  });
}

// ─── Enable / Disable Ball Buttons ─────────────────────────────────────────
function setIPLBallBtnsEnabled(enabled) {
  const ids = ['iplBtn0','iplBtn1','iplBtn2','iplBtn3','iplBtn4','iplBtn6',
                'iplBtnOut','iplBtnMiss','iplBtnWide','iplBtnNB','iplBtnBye','iplBtnLB'];
  ids.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !enabled;
  });
}

// ─── Save Session to Backend ─────────────────────────────────────────────────
async function saveIPLSession() {
  if (!ipl.matchId || !ipl.isScoring) return;

  const btn = document.getElementById('iplSaveSessionBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';

  try {
    const saves = Object.entries(ipl.session).map(([playerId, stats]) => {
      return fetch(`${API_BASE}/matches/${ipl.matchId}/performance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: parseInt(playerId),
          runs_scored: stats.runs,
          balls_faced: stats.balls,
          fours: stats.fours,
          sixes: stats.sixes,
          overs_bowled: parseFloat(stats.overs.toFixed(1)),
          runs_conceded: stats.conceded,
          wickets_taken: stats.wickets
        })
      });
    });

    const results = await Promise.all(saves);
    const failed = results.filter(r => !r.ok);
    if (failed.length > 0) throw new Error('Some player stats failed to save.');

    showToast('Scoring session saved successfully! 🏏');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Scoring Session';

    // Also update the header Save & Finish button
    document.getElementById('iplSaveFinalBtn').textContent = '✓ Saved!';
    setTimeout(() => {
      document.getElementById('iplSaveFinalBtn').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save & Finish';
    }, 2000);

  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Scoring Session';
  }
}

// Hook up the header Save & Finish button
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('iplSaveFinalBtn').addEventListener('click', async () => {
    await saveIPLSession();
    closeIPLScoring();
    loadTabContent(state.currentTab);
  });
});

// ─── Helper: Get Player Name ────────────────────────────────────────────────
function iplGetPlayerName(playerId) {
  if (!ipl.scorecardData) return `Player #${playerId}`;
  const all = [...ipl.scorecardData.team1.players, ...ipl.scorecardData.team2.players];
  return all.find(p => p.player_id === playerId)?.player_name || `Player #${playerId}`;
}

function iplGetPlayerRole(playerId) {
  if (!ipl.scorecardData) return 'player';
  const all = [...ipl.scorecardData.team1.players, ...ipl.scorecardData.team2.players];
  return all.find(p => p.player_id === playerId)?.role || 'player';
}
