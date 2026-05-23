'use strict';

// ── SAMPLE ROSTER (replace with real names later) ──────────────────────────
const INITIAL_TEAMS = [
  {
    name: 'Storm',
    color: '#00e5ff',
    players: [
      'Alex Kim', 'Jordan Lee', 'Sam Chen', 'Riley Park', 'Casey Wong',
      'Morgan Liu', 'Taylor Ng', 'Drew Tan', 'Quinn Zhao', 'Blake Sun',
      'Avery Ho', 'Reese Ma', 'Jamie Lim', 'Skyler Fu', 'Sage Yip',
      'Rowan Bai', 'River Xu', 'Emery Lin', 'Devon Wu', 'Finley Jiang',
      'Hayden Zhu', 'Lennox Fang'
    ]
  },
  {
    name: 'Blaze',
    color: '#ff6b35',
    players: [
      'Chris Patel', 'Niko Singh', 'Zara Ahmed', 'Milo Sharma', 'Isla Khan',
      'Remy Gupta', 'Asha Mehta', 'Juno Rao', 'Kira Das', 'Soren Nair',
      'Tara Iyer', 'Beau Pillai', 'Cleo Reddy', 'Dash Verma', 'Echo Bose',
      'Felix Joshi', 'Gem Anand', 'Hugo Kaur', 'Iris Malhotra', 'Jules Devi',
      'Kai Murthy', 'Lior Soni'
    ]
  }
];

// ── STATE ─────────────────────────────────────────────────────────────────
let state = loadState();

function defaultState() {
  return {
    teams: INITIAL_TEAMS.map((t, ti) => ({
      ...t,
      players: t.players.map((name, pi) => ({
        id: `t${ti}_p${pi}`,
        name,
        stats: { pass: 0, goal: 0, block: 0, throwaway: 0, drop: 0, pull: 0 }
      }))
    })),
    score: [0, 0],
    possession: 0, // team index
    events: [],
    pointNumber: 1
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem('ust_state');
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultState();
}

function saveState() {
  localStorage.setItem('ust_state', JSON.stringify(state));
}

// ── AVATAR COLOURS ─────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#e05c5c','#e07c3c','#c4a020','#4caf50','#26a69a',
  '#42a5f5','#7b7bd4','#ab47bc','#ef5f8e','#78909c'
];
function avatarColor(id) {
  const n = parseInt(id.replace(/\D/g,'')) || 0;
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}
function initials(name) {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── DOM REFS ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const teamPanels   = [null, null];
const playerGrids  = [null, null];
const scoreEls     = [null, null];
const possBadges   = [null, null];
const possDotsEl   = [$('poss-dot-0'), $('poss-dot-1')];

// ── RENDER ─────────────────────────────────────────────────────────────────
function render() {
  // scores
  scoreEls[0].textContent = state.score[0];
  scoreEls[1].textContent = state.score[1];

  // possession
  possBadges[0].classList.toggle('visible', state.possession === 0);
  possBadges[1].classList.toggle('visible', state.possession === 1);
  possDotsEl[0].classList.toggle('active', state.possession === 0);
  possDotsEl[1].classList.toggle('active', state.possession === 1);

  // player grids
  [0, 1].forEach(ti => {
    const grid = playerGrids[ti];
    grid.innerHTML = '';
    state.teams[ti].players.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'player-btn';
      btn.dataset.tid = ti;
      btn.dataset.pid = p.id;

      const av = document.createElement('div');
      av.className = 'player-avatar';
      av.style.background = avatarColor(p.id);
      av.textContent = initials(p.name);

      const nm = document.createElement('div');
      nm.className = 'player-name';
      nm.textContent = p.name.split(' ')[0]; // first name only for space

      const sm = document.createElement('div');
      sm.className = 'player-stats-mini';

      const pips = [
        [p.stats.pass,      'pass',  'P'],
        [p.stats.goal,      'goal',  'G'],
        [p.stats.block,     'block', 'D'],
        [p.stats.throwaway, 'turn',  'T'],
        [p.stats.drop,      'turn',  'Dr'],
      ];
      pips.forEach(([val, cls, label]) => {
        if (val > 0) {
          const pip = document.createElement('span');
          pip.className = `stat-pip pip-${cls}`;
          pip.textContent = `${label}${val}`;
          sm.appendChild(pip);
        }
      });

      btn.appendChild(av);
      btn.appendChild(nm);
      btn.appendChild(sm);
      btn.addEventListener('click', () => openModal(ti, p.id));
      grid.appendChild(btn);
    });
  });

  // event log
  const log = $('event-log');
  log.innerHTML = '';
  [...state.events].reverse().forEach(ev => {
    const el = document.createElement('div');
    el.className = `log-entry ${ev.type}`;
    el.innerHTML = `<span class="log-player">${ev.playerName}</span> — ${ev.label}`;
    if (ev.type === 'goal') {
      el.innerHTML += ` <span style="color:var(--muted);font-size:10px">(${state.teams[ev.teamIdx].name} ${ev.score[ev.teamIdx]}–${ev.score[1 - ev.teamIdx]})</span>`;
    }
    log.appendChild(el);
  });

  saveState();
}

// ── ACTION MODAL ────────────────────────────────────────────────────────────
let modalTeam = null;
let modalPlayer = null;

function openModal(teamIdx, playerId) {
  modalTeam = teamIdx;
  modalPlayer = playerId;
  const p = getPlayer(teamIdx, playerId);
  const overlay = $('action-overlay');
  const nameEl = overlay.querySelector('.modal-player-name');
  nameEl.textContent = p.name;
  nameEl.style.color = state.teams[teamIdx].color;
  overlay.classList.add('open');
}

function closeModal() {
  $('action-overlay').classList.remove('open');
  modalTeam = null;
  modalPlayer = null;
}

function getPlayer(ti, pid) {
  return state.teams[ti].players.find(p => p.id === pid);
}

function recordAction(type) {
  if (modalTeam === null) return;
  const ti = modalTeam;
  const p  = getPlayer(ti, modalPlayer);

  const labels = {
    pass:      '✅ Pass / Catch',
    goal:      '🥏 GOAL',
    block:     '🛡️ D-Block',
    throwaway: '❌ Throwaway',
    drop:      '⚠️ Drop',
    pull:      '🚀 Pull'
  };

  const ev = {
    type,
    teamIdx:    ti,
    playerId:   p.id,
    playerName: p.name,
    label:      labels[type],
    score:      [...state.score],
    ts:         Date.now()
  };

  // update player stat
  if (type === 'throwaway') p.stats.throwaway++;
  else if (type in p.stats)  p.stats[type]++;

  // game-state effects
  if (type === 'goal') {
    state.score[ti]++;
    ev.score = [...state.score];
    // possession flips: team that scored now pulls
    state.possession = ti === 0 ? 1 : 0;
    state.pointNumber++;
  } else if (type === 'throwaway' || type === 'drop' || type === 'block') {
    // turnover → other team gets possession
    if (type === 'block') {
      // block: defending team (not ti) gets possession
      state.possession = ti === 0 ? 1 : 0;
    } else {
      // throwaway/drop: other team gets possession
      state.possession = ti === 0 ? 1 : 0;
    }
  } else if (type === 'pass') {
    state.possession = ti; // stay with same team
  } else if (type === 'pull') {
    state.possession = ti === 0 ? 1 : 0; // receiving team gets it
  }

  state.events.push(ev);
  closeModal();
  render();
}

// ── UNDO ────────────────────────────────────────────────────────────────────
function undo() {
  if (state.events.length === 0) return;
  const ev = state.events.pop();
  const p  = getPlayer(ev.teamIdx, ev.playerId);

  // reverse stat
  const key = ev.type === 'throwaway' ? 'throwaway' : ev.type;
  if (key in p.stats && p.stats[key] > 0) p.stats[key]--;

  // reverse score
  if (ev.type === 'goal') {
    state.score[ev.teamIdx] = Math.max(0, state.score[ev.teamIdx] - 1);
    state.pointNumber = Math.max(1, state.pointNumber - 1);
  }

  // restore possession from second-to-last event if possible
  if (state.events.length > 0) {
    const prev = state.events[state.events.length - 1];
    state.possession = prev.teamIdx;
  } else {
    state.possession = 0;
  }

  render();
}

// ── RESET ───────────────────────────────────────────────────────────────────
function resetGame() {
  if (!confirm('Reset the entire game? This cannot be undone.')) return;
  state = defaultState();
  render();
}

// ── EXPORT ──────────────────────────────────────────────────────────────────
function exportData() {
  const summary = state.teams.map(t => ({
    team: t.name,
    score: state.score[state.teams.indexOf(t)],
    players: t.players
      .filter(p => Object.values(p.stats).some(v => v > 0))
      .map(p => ({ name: p.name, ...p.stats }))
  }));

  const out = {
    exportedAt: new Date().toISOString(),
    score: { [state.teams[0].name]: state.score[0], [state.teams[1].name]: state.score[1] },
    events: state.events,
    playerSummary: summary
  };

  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `ultistats_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── INIT ────────────────────────────────────────────────────────────────────
function init() {
  // wire up team panels from DOM
  [0, 1].forEach(ti => {
    teamPanels[ti]  = document.querySelector(`.team-panel[data-team="${ti}"]`);
    playerGrids[ti] = document.querySelector(`.team-panel[data-team="${ti}"] .player-grid`);
    scoreEls[ti]    = $(`score-${ti}`);
    possBadges[ti]  = $(`poss-${ti}`);
  });

  // action buttons
  document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => recordAction(btn.dataset.action));
  });

  $('modal-cancel').addEventListener('click', closeModal);
  $('action-overlay').addEventListener('click', e => {
    if (e.target === $('action-overlay')) closeModal();
  });

  $('btn-undo').addEventListener('click', undo);
  $('btn-reset').addEventListener('click', resetGame);
  $('export-btn').addEventListener('click', exportData);

  // team name display
  document.querySelectorAll('.team-label').forEach(el => {
    const ti = parseInt(el.dataset.team);
    el.textContent = state.teams[ti].name;
    el.style.color = state.teams[ti].color;
  });
  document.querySelectorAll('.score-name').forEach(el => {
    const ti = parseInt(el.dataset.team);
    el.textContent = state.teams[ti].name.toUpperCase();
  });

  render();
}

document.addEventListener('DOMContentLoaded', init);
