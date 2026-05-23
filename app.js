'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  SAMPLE ROSTER  (gender: 'M' | 'F' | 'NB')
// ─────────────────────────────────────────────────────────────────────────────
const ROSTER_TEMPLATE = [
  { name: 'Alex Kim',      gender: 'M' }, { name: 'Jordan Lee',   gender: 'F' },
  { name: 'Sam Chen',      gender: 'M' }, { name: 'Riley Park',   gender: 'F' },
  { name: 'Casey Wong',    gender: 'M' }, { name: 'Morgan Liu',   gender: 'F' },
  { name: 'Taylor Ng',     gender: 'M' }, { name: 'Drew Tan',     gender: 'F' },
  { name: 'Quinn Zhao',    gender: 'M' }, { name: 'Blake Sun',    gender: 'F' },
  { name: 'Avery Ho',      gender: 'NB'},  { name: 'Reese Ma',    gender: 'M' },
  { name: 'Jamie Lim',     gender: 'F' }, { name: 'Skyler Fu',    gender: 'M' },
  { name: 'Sage Yip',      gender: 'F' }, { name: 'Rowan Bai',    gender: 'M' },
  { name: 'River Xu',      gender: 'F' }, { name: 'Emery Lin',    gender: 'M' },
  { name: 'Devon Wu',      gender: 'F' }, { name: 'Finley Jiang', gender: 'M' },
  { name: 'Hayden Zhu',    gender: 'F' }, { name: 'Lennox Fang',  gender: 'M' },
];
const ROSTER_TEMPLATE_B = [
  { name: 'Chris Patel',   gender: 'M' }, { name: 'Niko Singh',   gender: 'F' },
  { name: 'Zara Ahmed',    gender: 'F' }, { name: 'Milo Sharma',  gender: 'M' },
  { name: 'Isla Khan',     gender: 'F' }, { name: 'Remy Gupta',   gender: 'M' },
  { name: 'Asha Mehta',    gender: 'F' }, { name: 'Juno Rao',     gender: 'M' },
  { name: 'Kira Das',      gender: 'F' }, { name: 'Soren Nair',   gender: 'M' },
  { name: 'Tara Iyer',     gender: 'F' }, { name: 'Beau Pillai',  gender: 'M' },
  { name: 'Cleo Reddy',    gender: 'NB'}, { name: 'Dash Verma',   gender: 'M' },
  { name: 'Echo Bose',     gender: 'F' }, { name: 'Felix Joshi',  gender: 'M' },
  { name: 'Gem Anand',     gender: 'F' }, { name: 'Hugo Kaur',    gender: 'M' },
  { name: 'Iris Malhotra', gender: 'F' }, { name: 'Jules Devi',   gender: 'M' },
  { name: 'Kai Murthy',    gender: 'F' }, { name: 'Lior Soni',    gender: 'M' },
];

// ─────────────────────────────────────────────────────────────────────────────
//  GAME STATE MACHINE
//  States: LINE_SELECTION | PULLING | PULL_READY | PASS_CHAIN | BLOCK_PICK |
//          POINT_OVER | HALF_TIME | END_GAME
// ─────────────────────────────────────────────────────────────────────────────

function buildTeams() {
  return [
    {
      id: 0, name: 'Storm', color: '#00e5ff',
      players: ROSTER_TEMPLATE.map((p, i) => ({
        id: `t0p${i}`, name: p.name, gender: p.gender,
        stats: { pass: 0, goal: 0, block: 0, throwaway: 0, drop: 0, pull: 0, pullbonus: 0, receivererror: 0 }
      }))
    },
    {
      id: 1, name: 'Blaze', color: '#ff6b35',
      players: ROSTER_TEMPLATE_B.map((p, i) => ({
        id: `t1p${i}`, name: p.name, gender: p.gender,
        stats: { pass: 0, goal: 0, block: 0, throwaway: 0, drop: 0, pull: 0, pullbonus: 0, receivererror: 0 }
      }))
    }
  ];
}

function defaultState() {
  return {
    phase: 'LINE_SELECTION',   // current state machine phase
    teams: buildTeams(),
    score: [0, 0],
    pointNumber: 1,
    firstPullTeam: null,       // set at game start; used to determine half-time possession
    pullingTeam: null,         // which team pulls this point (index)
    possessionTeam: null,      // which team currently has the disc
    discHolderId: null,        // player id who currently holds disc (PASS_CHAIN)
    prevDiscHolderId: null,    // for throwaway attribution
    onField: [[], []],         // player ids on field per team
    rawLog: [],                // append-only; never mutated
    halfTimeDone: false,
    gameOver: false,
  };
}

let G = loadGame();

function loadGame() {
  try {
    const s = localStorage.getItem('ust_v2');
    if (s) return JSON.parse(s);
  } catch {}
  return defaultState();
}
function saveGame() { localStorage.setItem('ust_v2', JSON.stringify(G)); }

// Derive visual log from raw log (reversals cancel their targets)
function visualLog() {
  const cancelled = new Set();
  // collect reversal targets
  G.rawLog.forEach((ev, i) => {
    if (ev.type === 'reversal' && ev.targetIdx != null) cancelled.add(ev.targetIdx);
  });
  return G.rawLog
    .map((ev, i) => ({ ...ev, _rawIdx: i, _cancelled: cancelled.has(i) }))
    .filter(ev => ev.type !== 'reversal'); // reversals themselves don't appear
}

// Player lookup
function getPlayer(tid, pid) {
  return G.teams[tid].players.find(p => p.id === pid);
}
function playerByIdAnyTeam(pid) {
  for (const t of G.teams) { const p = t.players.find(x => x.id === pid); if (p) return { player: p, teamIdx: t.id }; }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  AVATAR helpers
// ─────────────────────────────────────────────────────────────────────────────
const AV_COLORS = ['#e05c5c','#e07c3c','#c4a020','#4caf50','#26a69a','#42a5f5','#7b7bd4','#ab47bc','#ef5f8e','#78909c'];
function avColor(id) { return AV_COLORS[parseInt(id.replace(/\D/g,'') || 0) % AV_COLORS.length]; }
function initials(name) {
  const p = name.trim().split(' ');
  return p.length === 1 ? p[0].slice(0,2).toUpperCase() : (p[0][0]+p[p.length-1][0]).toUpperCase();
}
function makeAvatarEl(player) {
  const el = document.createElement('div');
  el.className = `player-av ${player.gender === 'F' ? 'female' : player.gender === 'NB' ? 'nb' : 'male'}`;
  el.style.background = avColor(player.id);
  el.textContent = initials(player.name);
  return el;
}

// ─────────────────────────────────────────────────────────────────────────────
//  DOM refs
// ─────────────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const screens = {
  linesel:  $('screen-linesel'),
  pulling:  $('screen-pulling'),
  game:     $('screen-game'),
  endgame:  $('screen-endgame'),
};

// ─────────────────────────────────────────────────────────────────────────────
//  SCREEN ROUTER
// ─────────────────────────────────────────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  if (screens[name]) screens[name].classList.add('active');
}

function routeToPhase() {
  switch (G.phase) {
    case 'LINE_SELECTION': showScreen('linesel'); renderLineSelection(); break;
    case 'PULLING':        showScreen('pulling'); renderPulling(); break;
    case 'PULL_READY':     showScreen('game');    renderGame(); break;
    case 'PASS_CHAIN':     showScreen('game');    renderGame(); break;
    case 'BLOCK_PICK':     showScreen('game');    renderGame(); break;
    case 'POINT_OVER':     showScreen('linesel'); renderLineSelection(); break;
    case 'HALF_TIME':      showScreen('linesel'); renderLineSelection(); break;
    case 'END_GAME':       showScreen('endgame'); renderEndGame(); break;
  }
  renderHeader();
}

// ─────────────────────────────────────────────────────────────────────────────
//  HEADER
// ─────────────────────────────────────────────────────────────────────────────
function renderHeader() {
  $('sb-score-0').textContent = G.score[0];
  $('sb-score-1').textContent = G.score[1];
  $('sb-name-0').textContent  = G.teams[0].name;
  $('sb-name-1').textContent  = G.teams[1].name;
  $('poss-dot-0').classList.toggle('active', G.possessionTeam === 0);
  $('poss-dot-1').classList.toggle('active', G.possessionTeam === 1);

  const phaseLabels = {
    LINE_SELECTION: 'Line Selection',
    POINT_OVER:     'Point Over',
    PULLING:        'Choose Puller',
    PULL_READY:     'Pull',
    PASS_CHAIN:     'Pass Chain',
    BLOCK_PICK:     'Block Pick',
    HALF_TIME:      'Half Time',
    END_GAME:       'Game Over',
  };
  $('state-badge').textContent = phaseLabels[G.phase] || G.phase;
  $('state-badge').classList.toggle('active', ['PASS_CHAIN','PULL_READY','PULLING'].includes(G.phase));

  // Show undo only when there's something to undo and game not over
  $('btn-undo').style.display = (G.rawLog.length > 0 && G.phase !== 'END_GAME') ? '' : 'none';
  // Event button only during game
  $('btn-event').style.display = ['PASS_CHAIN','POINT_OVER','HALF_TIME','PULL_READY'].includes(G.phase) ? '' : 'none';
}

// ─────────────────────────────────────────────────────────────────────────────
//  LINE SELECTION
// ─────────────────────────────────────────────────────────────────────────────
let lineSelState = [new Set(), new Set()]; // selected player ids per team

function renderLineSelection() {
  const isFirst = G.pointNumber === 1 && !G.firstPullTeam;
  const isHalf  = G.phase === 'HALF_TIME';

  // Title
  let title = `Point ${G.pointNumber} — Select Lines`;
  if (isHalf) title = 'Half Time — Select Lines';
  $('linesel-title').textContent = title;

  // Pull team selector (only first point)
  const pullRow = $('pull-team-row');
  pullRow.style.display = isFirst ? 'flex' : 'none';
  if (isFirst) renderPullTeamPicker();

  // Keep previous on-field as default selection
  lineSelState = [new Set(G.onField[0]), new Set(G.onField[1])];

  renderLineselTeam(0);
  renderLineselTeam(1);
  updateLineselConfirm();
}

function renderPullTeamPicker() {
  const row = $('pull-team-row');
  row.innerHTML = '<span style="font-size:11px;color:var(--muted);font-weight:600;font-family:var(--fh);text-transform:uppercase;letter-spacing:.06em">Pulls First:</span>';
  G.teams.forEach((t, i) => {
    const btn = document.createElement('button');
    btn.className = 'hdr-btn' + (G.firstPullTeam === i ? ' accent' : '');
    btn.textContent = t.name;
    btn.style.fontSize = '12px';
    btn.onclick = () => { G.firstPullTeam = i; G.pullingTeam = i; renderPullTeamPicker(); updateLineselConfirm(); };
    row.appendChild(btn);
  });
}

function renderLineselTeam(ti) {
  const container = $(`linesel-team-${ti}`);
  container.innerHTML = '';
  G.teams[ti].players.forEach(p => {
    const btn = document.createElement('div');
    btn.className = 'roster-player' + (lineSelState[ti].has(p.id) ? ' selected' : '');
    btn.appendChild(makeAvatarEl(p));
    const nm = document.createElement('div');
    nm.className = 'roster-pname';
    nm.textContent = p.name.split(' ')[0];
    btn.appendChild(nm);
    btn.onclick = () => {
      if (lineSelState[ti].has(p.id)) lineSelState[ti].delete(p.id);
      else lineSelState[ti].add(p.id);
      renderLineselTeam(ti);
      updateLineselCount(ti);
      updateLineselConfirm();
    };
    container.appendChild(btn);
  });
  updateLineselCount(ti);
}

function updateLineselCount(ti) {
  const el = $(`linesel-count-${ti}`);
  const n = lineSelState[ti].size;
  el.textContent = `${n} / 7 selected`;
  el.className = 'linesel-count' + (n === 0 ? '' : n < 7 ? ' warn' : ' ok');
}

function updateLineselConfirm() {
  const firstPointReady = G.pointNumber > 1 || G.firstPullTeam !== null;
  const hasPlayers = lineSelState[0].size > 0 && lineSelState[1].size > 0;
  $('linesel-confirm').disabled = !(firstPointReady && hasPlayers);
}

function confirmLineSelection() {
  // Warn if not 7
  const w0 = lineSelState[0].size !== 7, w1 = lineSelState[1].size !== 7;
  if ((w0 || w1) && !confirm(`Warning: ${w0 ? G.teams[0].name+' has '+lineSelState[0].size : ''}${w0&&w1?', ':''}${w1 ? G.teams[1].name+' has '+lineSelState[1].size : ''} players (expected 7).\nContinue?`)) return;

  G.onField = [Array.from(lineSelState[0]), Array.from(lineSelState[1])];

  appendRawEvent({ type: 'linesel', pointNumber: G.pointNumber,
    onField: G.onField.map((ids, ti) => ids.map(id => getPlayer(ti, id)?.name)) });

  // Determine pulling team
  if (G.pointNumber === 1) {
    G.pullingTeam = G.firstPullTeam ?? 0;
  }
  // After half time, possession flips to team that didn't start
  if (G.phase === 'HALF_TIME') {
    G.pullingTeam = G.firstPullTeam === 0 ? 1 : 0;
  }

  G.phase = 'PULLING';
  G.discHolderId = null;
  G.prevDiscHolderId = null;
  G.possessionTeam = G.pullingTeam;
  saveGame(); routeToPhase();
}

// ─────────────────────────────────────────────────────────────────────────────
//  PULLING SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function renderPulling() {
  const ti = G.pullingTeam;
  $('pulling-team-label').textContent = `${G.teams[ti].name} — tap the puller`;
  $('pulling-team-label').style.color = G.teams[ti].color;

  const grid = $('pulling-grid');
  grid.innerHTML = '';
  const fieldIds = new Set(G.onField[ti]);
  G.teams[ti].players.filter(p => fieldIds.has(p.id)).forEach(p => {
    const btn = document.createElement('div');
    btn.className = 'puller-btn';
    btn.appendChild(makeAvatarEl(p));
    const nm = document.createElement('div');
    nm.className = 'roster-pname';
    nm.textContent = p.name.split(' ')[0];
    btn.appendChild(nm);
    btn.onclick = () => selectPuller(ti, p.id);
    grid.appendChild(btn);
  });
}

function selectPuller(ti, pid) {
  // Puller is identified — now show pull/pullbonus modal
  openPullModal(ti, pid);
}

// ─────────────────────────────────────────────────────────────────────────────
//  PASS CHAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function renderGame() {
  renderPlayerZone();
  renderEventLog();
}

function renderPlayerZone() {
  const pz = $('player-zone');
  const header = pz.querySelector('.pz-header');
  const grid   = pz.querySelector('.player-zone-grid');

  if (G.phase === 'BLOCK_PICK') {
    // Show the defending team for blocker pick
    const defTeam = G.possessionTeam; // after turnover, this is the new possession team = former defender
    header.querySelector('.pz-team-name').textContent = G.teams[defTeam].name + ' — pick blocker';
    header.querySelector('.pz-team-name').style.color = G.teams[defTeam].color;
    header.querySelector('.pz-hint').textContent = 'D-Block';
    renderFieldPlayers(grid, defTeam, true);
  } else {
    // Show attacking team (team with possession)
    const ti = G.possessionTeam ?? 0;
    header.querySelector('.pz-team-name').textContent = G.teams[ti].name;
    header.querySelector('.pz-team-name').style.color = G.teams[ti].color;
    const hint = G.phase === 'PULL_READY' ? 'Pull phase' : 'Tap player to record action';
    header.querySelector('.pz-hint').textContent = hint;
    renderFieldPlayers(grid, ti, false);
  }
}

function renderFieldPlayers(grid, ti, isBlockPick) {
  grid.innerHTML = '';
  const fieldIds = new Set(G.onField[ti]);
  G.teams[ti].players.filter(p => fieldIds.has(p.id)).forEach(p => {
    const btn = document.createElement('div');
    btn.className = 'field-player';
    if (p.id === G.discHolderId) btn.classList.add('has-disc');

    btn.appendChild(makeAvatarEl(p));
    const nm = document.createElement('div');
    nm.className = 'roster-pname';
    nm.textContent = p.name.split(' ')[0];
    btn.appendChild(nm);

    // mini stat pips
    const ps = document.createElement('div');
    ps.className = 'fp-stats';
    [[p.stats.goal,'g','G'],[p.stats.pass,'p','P'],[p.stats.block,'d','D'],[p.stats.throwaway+p.stats.drop+p.stats.receivererror,'t','T']].forEach(([v,cls,lbl]) => {
      if (v > 0) { const pip = document.createElement('span'); pip.className=`fp-pip ${cls}`; pip.textContent=`${lbl}${v}`; ps.appendChild(pip); }
    });
    btn.appendChild(ps);

    btn.onclick = () => isBlockPick ? recordBlockPick(ti, p.id) : openPlayerModal(ti, p.id);
    grid.appendChild(btn);
  });
}

function renderEventLog() {
  const log = $('event-log');
  log.innerHTML = '';
  const vl = visualLog();
  [...vl].reverse().forEach(ev => {
    const el = document.createElement('div');
    if (ev._cancelled) el.classList.add('reversal');
    el.className = ('log-entry ' + ev.type + (ev._cancelled ? ' reversal' : '')).trim();

    let text = '';
    switch (ev.type) {
      case 'linesel':   text = `📋 Line set — Pt ${ev.pointNumber}`; break;
      case 'pull':      text = `🚀 Pull — <span class="lp">${ev.playerName}</span>`; break;
      case 'pullbonus': text = `🚀✨ Pull Bonus — <span class="lp">${ev.playerName}</span>`; break;
      case 'pass':      text = `🥏 → <span class="lp">${ev.playerName}</span>`; break;
      case 'goal':      text = `🎯 GOAL — <span class="lp">${ev.playerName}</span> (${G.score[0]}–${G.score[1]})`; break;
      case 'throwaway': text = `❌ Throwaway — <span class="lp">${ev.playerName}</span>`; break;
      case 'receivererror': text = `⚠️ Rcvr Error — <span class="lp">${ev.playerName}</span>`; break;
      case 'block':     text = `🛡️ D-Block — <span class="lp">${ev.playerName}</span>`; break;
      case 'halftime':  text = `⏱️ HALF TIME`; break;
      case 'endgame':   text = `🏁 END GAME`; break;
      case 'sub':       text = `🔄 Sub: <span class="lp">${ev.outName}</span> → <span class="lp">${ev.inName}</span>`; break;
      default:          text = ev.type;
    }
    el.innerHTML = text;
    log.appendChild(el);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  PLAYER ACTION MODAL
// ─────────────────────────────────────────────────────────────────────────────
let modalCtx = null; // { teamIdx, playerId }

function openPlayerModal(ti, pid) {
  const p = getPlayer(ti, pid);
  modalCtx = { ti, pid };

  $('modal-pname').textContent = p.name;
  $('modal-pname').style.color = G.teams[ti].color;

  const grid = $('action-grid');
  grid.innerHTML = '';
  grid.className = 'action-grid';

  let actions = [];
  if (G.phase === 'PULL_READY') {
    // Only pull / pull bonus
    actions = [
      { key: 'pull',     label: 'Pull',       icon: '🚀', cls: 'pull' },
      { key: 'pullbonus',label: 'Pull Bonus',  icon: '🚀✨', cls: 'pullbon' },
    ];
    grid.classList.add('cols2');
    $('modal-hint').textContent = 'Choose pull type';
  } else {
    // PASS_CHAIN
    actions = [
      { key: 'pass',          label: 'Pass / Catch',   icon: '🥏', cls: 'pass' },
      { key: 'goal',          label: 'Goal',            icon: '🎯', cls: 'goal' },
      { key: 'block',         label: 'D-Block',         icon: '🛡️', cls: 'block' },
      { key: 'throwaway',     label: 'Throwaway',       icon: '❌', cls: 'throw' },
      { key: 'receivererror', label: 'Rcvr Error',      icon: '⚠️', cls: 'drop' },
    ];
    grid.classList.add('cols3');
    $('modal-hint').textContent = 'Tap action for ' + p.name.split(' ')[0];
  }

  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.className = `act-btn ${a.cls}`;
    btn.innerHTML = `<span class="ic">${a.icon}</span>${a.label}`;
    btn.onclick = () => { closeModal(); recordAction(a.key, ti, pid); };
    grid.appendChild(btn);
  });

  $('overlay').classList.add('open');
}

function openPullModal(ti, pid) {
  // Reuse player modal for pull type selection
  G.phase = 'PULL_READY';
  G.discHolderId = pid;
  openPlayerModal(ti, pid);
}

function closeModal() { $('overlay').classList.remove('open'); modalCtx = null; }

// ─────────────────────────────────────────────────────────────────────────────
//  ACTION RECORDING
// ─────────────────────────────────────────────────────────────────────────────
function appendRawEvent(ev) {
  ev._idx = G.rawLog.length;
  ev.ts = Date.now();
  G.rawLog.push(ev);
}

function recordAction(action, ti, pid) {
  const p = getPlayer(ti, pid);
  const ev = { type: action, teamIdx: ti, playerId: pid, playerName: p.name };

  switch (action) {

    case 'pull':
    case 'pullbonus':
      p.stats[action]++;
      ev.pointNumber = G.pointNumber;
      appendRawEvent(ev);
      // Possession flips to receiving team
      G.possessionTeam = ti === 0 ? 1 : 0;
      G.discHolderId = null;
      G.prevDiscHolderId = null;
      G.phase = 'PASS_CHAIN';
      break;

    case 'pass':
      p.stats.pass++;
      ev.prevHolder = G.discHolderId;
      appendRawEvent(ev);
      G.prevDiscHolderId = G.discHolderId;
      G.discHolderId = pid;
      G.possessionTeam = ti;
      G.phase = 'PASS_CHAIN';
      break;

    case 'goal':
      p.stats.goal++;
      G.score[ti]++;
      ev.score = [...G.score];
      ev.pointNumber = G.pointNumber;
      appendRawEvent(ev);
      G.discHolderId = null;
      G.prevDiscHolderId = null;
      // After goal, the scoring team pulls next
      G.pullingTeam = ti;
      G.possessionTeam = null;
      G.phase = 'POINT_OVER';
      G.pointNumber++;
      break;

    case 'throwaway':
      // Attributed to the previous disc holder (the thrower)
      {
        const throwerId = G.discHolderId ?? pid;
        const thrower = playerByIdAnyTeam(throwerId);
        if (thrower) thrower.player.stats.throwaway++;
        ev.playerId = throwerId;
        ev.playerName = thrower ? thrower.player.name : p.name;
        appendRawEvent(ev);
        G.possessionTeam = ti === 0 ? 1 : 0;
        G.discHolderId = null;
        G.prevDiscHolderId = null;
        G.phase = 'PASS_CHAIN';
      }
      break;

    case 'receivererror':
      // Attributed to tapped player (the intended receiver)
      p.stats.receivererror++;
      appendRawEvent(ev);
      G.possessionTeam = ti === 0 ? 1 : 0;
      G.discHolderId = null;
      G.prevDiscHolderId = null;
      G.phase = 'PASS_CHAIN';
      break;

    case 'block':
      // Triggers BLOCK_PICK — we note who was tapped (the attacker context)
      // Actually per spec: right on attacker → pick defender from other team
      G.phase = 'BLOCK_PICK';
      // possession will flip when blocker is picked
      G.possessionTeam = ti === 0 ? 1 : 0; // defender gets it
      G.discHolderId = null;
      G.prevDiscHolderId = null;
      // Don't append event yet — wait for blocker pick
      break;
  }

  saveGame(); routeToPhase();
}

function recordBlockPick(ti, pid) {
  // ti is the defending team, pid is the blocker
  const p = getPlayer(ti, pid);
  p.stats.block++;
  const ev = { type: 'block', teamIdx: ti, playerId: pid, playerName: p.name };
  appendRawEvent(ev);
  G.possessionTeam = ti;
  G.discHolderId = pid; // blocker may now be the first receiver
  G.phase = 'PASS_CHAIN';
  saveGame(); routeToPhase();
}

// ─────────────────────────────────────────────────────────────────────────────
//  UNDO
// ─────────────────────────────────────────────────────────────────────────────
function undo() {
  // Find last non-reversal, non-cancelled raw event
  const cancelled = new Set();
  G.rawLog.forEach((ev, i) => { if (ev.type === 'reversal' && ev.targetIdx != null) cancelled.add(ev.targetIdx); });

  let targetIdx = null;
  for (let i = G.rawLog.length - 1; i >= 0; i--) {
    if (G.rawLog[i].type !== 'reversal' && !cancelled.has(i)) { targetIdx = i; break; }
  }
  if (targetIdx === null) return;

  const ev = G.rawLog[targetIdx];
  // Append reversal entry
  appendRawEvent({ type: 'reversal', targetIdx, undoneType: ev.type });

  // Reverse stat
  const p = ev.playerId ? playerByIdAnyTeam(ev.playerId)?.player : null;
  if (p) {
    const key = ev.type === 'receivererror' ? 'receivererror' : ev.type;
    if (key in p.stats && p.stats[key] > 0) p.stats[key]--;
  }

  // Reverse score
  if (ev.type === 'goal' && ev.teamIdx != null) {
    G.score[ev.teamIdx] = Math.max(0, G.score[ev.teamIdx] - 1);
    G.pointNumber = Math.max(1, G.pointNumber - 1);
  }

  // Restore phase from second-to-last visual event
  restorePhaseAfterUndo(targetIdx);
  saveGame(); routeToPhase();
}

function restorePhaseAfterUndo(undoneIdx) {
  // Re-derive phase from the visual log before the undone event
  const cancelled = new Set();
  G.rawLog.forEach((ev, i) => { if (ev.type === 'reversal' && ev.targetIdx != null) cancelled.add(ev.targetIdx); });

  const priorEvents = G.rawLog
    .map((ev, i) => ({ ...ev, _i: i }))
    .filter((ev, i) => ev.type !== 'reversal' && !cancelled.has(i) && ev._i < undoneIdx);

  if (priorEvents.length === 0) {
    G.phase = 'LINE_SELECTION';
    G.possessionTeam = null; G.discHolderId = null; G.pullingTeam = G.firstPullTeam;
    return;
  }

  const last = priorEvents[priorEvents.length - 1];
  switch (last.type) {
    case 'linesel':
      G.phase = 'PULLING';
      G.possessionTeam = G.pullingTeam;
      G.discHolderId = null;
      break;
    case 'pull':
    case 'pullbonus':
      G.phase = 'PASS_CHAIN';
      G.possessionTeam = last.teamIdx === 0 ? 1 : 0;
      G.discHolderId = null;
      break;
    case 'pass':
      G.phase = 'PASS_CHAIN';
      G.discHolderId = last.playerId;
      G.possessionTeam = last.teamIdx;
      break;
    case 'goal':
      G.phase = 'POINT_OVER';
      G.possessionTeam = null; G.discHolderId = null;
      break;
    case 'throwaway':
    case 'receivererror':
    case 'block':
      G.phase = 'PASS_CHAIN';
      G.possessionTeam = last.teamIdx;
      G.discHolderId = last.type === 'block' ? last.playerId : null;
      break;
    case 'halftime':
      G.phase = 'HALF_TIME';
      break;
    default:
      G.phase = 'PASS_CHAIN';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  EVENT MENU  (Special events)
// ─────────────────────────────────────────────────────────────────────────────
function openEventMenu() {
  const inPassChain = ['PASS_CHAIN','PULL_READY'].includes(G.phase);
  $('ev-item-injury').classList.toggle('disabled', !inPassChain);
  $('event-menu-overlay').classList.add('open');
}
function closeEventMenu() { $('event-menu-overlay').classList.remove('open'); }

function triggerHalfTime() {
  closeEventMenu();
  if (!confirm('Mark Half Time? This switches ends and flips possession.')) return;
  appendRawEvent({ type: 'halftime' });
  G.halfTimeDone = true;
  G.phase = 'HALF_TIME';
  G.discHolderId = null;
  G.possessionTeam = null;
  saveGame(); routeToPhase();
}

function triggerEndGame() {
  closeEventMenu();
  if (!confirm('End the game? No further events can be recorded.')) return;
  appendRawEvent({ type: 'endgame' });
  G.phase = 'END_GAME';
  G.gameOver = true;
  saveGame(); routeToPhase();
}

function openInjurySub() {
  closeEventMenu();
  renderSubModal();
  $('sub-overlay').classList.add('open');
}

// ─────────────────────────────────────────────────────────────────────────────
//  INJURY SUB MODAL  (F5 mid-point substitution)
// ─────────────────────────────────────────────────────────────────────────────
let subState = { ti: null, outId: null, inId: null };

function renderSubModal() {
  subState = { ti: null, outId: null, inId: null };
  // Team selector
  const teamRow = $('sub-team-row');
  teamRow.innerHTML = '';
  G.teams.forEach((t, i) => {
    const btn = document.createElement('button');
    btn.className = 'sub-psel' + (subState.ti === i ? ' selected' : '');
    btn.textContent = t.name;
    btn.style.border = `1.5px solid ${t.color}`;
    btn.onclick = () => {
      subState.ti = i; subState.outId = null; subState.inId = null;
      renderSubPlayerLists();
      document.querySelectorAll('#sub-team-row .sub-psel').forEach((b,j) => b.classList.toggle('selected', j === i));
    };
    teamRow.appendChild(btn);
  });
  $('sub-out-list').innerHTML = '';
  $('sub-in-list').innerHTML = '';
  $('sub-confirm').disabled = true;
}

function renderSubPlayerLists() {
  const ti = subState.ti;
  if (ti === null) return;
  const fieldIds = new Set(G.onField[ti]);

  // OUT: players currently on field
  const outList = $('sub-out-list');
  outList.innerHTML = '';
  G.teams[ti].players.filter(p => fieldIds.has(p.id)).forEach(p => {
    const btn = document.createElement('div');
    btn.className = 'sub-psel' + (subState.outId === p.id ? ' selected' : '');
    btn.textContent = p.name.split(' ')[0];
    btn.onclick = () => { subState.outId = p.id; renderSubPlayerLists(); updateSubConfirm(); };
    outList.appendChild(btn);
  });

  // IN: players on bench
  const inList = $('sub-in-list');
  inList.innerHTML = '';
  G.teams[ti].players.filter(p => !fieldIds.has(p.id)).forEach(p => {
    const btn = document.createElement('div');
    btn.className = 'sub-psel' + (subState.inId === p.id ? ' selected' : '');
    btn.textContent = p.name.split(' ')[0];
    btn.onclick = () => { subState.inId = p.id; renderSubPlayerLists(); updateSubConfirm(); };
    inList.appendChild(btn);
  });

  updateSubConfirm();
}

function updateSubConfirm() {
  $('sub-confirm').disabled = !(subState.ti !== null && subState.outId && subState.inId);
}

function confirmSub() {
  const { ti, outId, inId } = subState;
  const outP = getPlayer(ti, outId);
  const inP  = getPlayer(ti, inId);

  // Update on-field list
  const idx = G.onField[ti].indexOf(outId);
  if (idx !== -1) G.onField[ti][idx] = inId;
  else { G.onField[ti] = G.onField[ti].filter(id => id !== outId); G.onField[ti].push(inId); }

  appendRawEvent({ type: 'sub', teamIdx: ti, outId, inId, outName: outP.name, inName: inP.name });

  // If disc holder was subbed out, clear disc holder
  if (G.discHolderId === outId) G.discHolderId = null;

  $('sub-overlay').classList.remove('open');
  saveGame(); routeToPhase();
}

// ─────────────────────────────────────────────────────────────────────────────
//  END GAME SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function renderEndGame() {
  $('eg-score-0').textContent = G.score[0];
  $('eg-score-1').textContent = G.score[1];
  $('eg-t0').textContent = G.teams[0].name;
  $('eg-t1').textContent = G.teams[1].name;
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXPORT
// ─────────────────────────────────────────────────────────────────────────────
function exportData() {
  const out = {
    exportedAt: new Date().toISOString(),
    score: { [G.teams[0].name]: G.score[0], [G.teams[1].name]: G.score[1] },
    playerStats: G.teams.map(t => ({
      team: t.name,
      players: t.players
        .filter(p => Object.values(p.stats).some(v => v > 0))
        .map(p => ({ name: p.name, gender: p.gender, ...p.stats }))
    })),
    rawEventLog: G.rawLog,
    visualLog: visualLog(),
  };
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `ultistats_${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
}

function resetGame() {
  if (!confirm('Reset entire game? This cannot be undone.')) return;
  G = defaultState(); saveGame(); routeToPhase();
}

// ─────────────────────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────────────────────
function init() {
  // Wire up line selection
  $('linesel-confirm').onclick = confirmLineSelection;

  // Overlay close on background click
  $('overlay').onclick = e => { if (e.target === $('overlay')) closeModal(); };
  $('modal-cancel').onclick = closeModal;
  $('event-menu-overlay').onclick = e => { if (e.target === $('event-menu-overlay')) closeEventMenu(); };

  // Header buttons
  $('btn-undo').onclick = undo;
  $('btn-event').onclick = openEventMenu;
  $('btn-reset').onclick = resetGame;

  // Event menu items
  $('ev-item-injury').onclick = openInjurySub;
  $('ev-item-halftime').onclick = triggerHalfTime;
  $('ev-item-endgame').onclick = triggerEndGame;
  $('ev-item-close').onclick = closeEventMenu;

  // Sub modal
  $('sub-confirm').onclick = confirmSub;
  $('sub-cancel').onclick = () => $('sub-overlay').classList.remove('open');

  // Export
  $('export-btn').onclick = exportData;
  $('eg-export').onclick = exportData;
  $('eg-newgame').onclick = resetGame;

  // End game stat review (goes back to end game screen with log)
  // (already shown on end game screen)

  routeToPhase();
}

document.addEventListener('DOMContentLoaded', init);
