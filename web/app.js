const STORAGE_KEY = 'juggerstones.preferences.v1';
const HISTORY_LIMIT = 32;
const DEFAULT_PREFS = {
  mode: 100,
  modePrevious: -1,
  modeCustom: 100,
  interval: 1500,
  intervalCustom: 1.5,
  reverse: false,
  immediateStart: false,
  gongAfterPoint: false,
  pauseAfterPoint: false,
  pauseAfterGong: false,
  keepAwake: false,
  soundStone: 'stone',
  soundStoneCountdown: 'stone',
  soundGong: 'gong',
  language: 'en',
};

const SOUND_STONE_OPTIONS = [
  { id: 'stone', labelKey: 'pref_stone' },
  { id: 'achievement', labelKey: 'pref_achievement' },
  { id: 'big_drum_hit', labelKey: 'pref_big_drum' },
  { id: 'cash_reg', labelKey: 'pref_cash_reg' },
  { id: 'censure', labelKey: 'pref_censure' },
  { id: 'crow', labelKey: 'pref_crow' },
  { id: 'doh', labelKey: 'pref_doh' },
  { id: 'drum', labelKey: 'pref_drum' },
  { id: 'duck', labelKey: 'pref_duck' },
  { id: 'fb', labelKey: 'pref_fb' },
  { id: 'metal_gear', labelKey: 'pref_metal_gear' },
  { id: 'pan', labelKey: 'pref_pan' },
  { id: 'snare_drum', labelKey: 'pref_snare_drum' },
  { id: 'telephone', labelKey: 'pref_telephone' },
];

const SOUND_GONG_OPTIONS = [
  { id: 'gong', labelKey: 'pref_gong' },
  { id: 'air_horn', labelKey: 'pref_air_horn' },
  { id: 'train_whistle', labelKey: 'pref_train_whistle' },
  { id: 'vuvuzela', labelKey: 'pref_vuvuzela' },
];

const DEFAULT_COLORS = ['#00ff00', '#ff0000'];

const LONG_PRESS_DURATION = 500;
const STONE_COUNTDOWN_THRESHOLD = 10;

async function loadI18n() {
  const response = await fetch('i18n.json');
  if (!response.ok) {
    throw new Error('Failed to load i18n.json');
  }
  const data = await response.json();
  const resolved = {};
  for (const [lang, strings] of Object.entries(data)) {
    resolved[lang] = resolveStringReferences(strings);
  }
  return resolved;
}

function resolveStringReferences(strings) {
  const resolved = { ...strings };
  const visiting = new Set();

  function resolve(key) {
    if (!resolved[key]) return '';
    const value = resolved[key];
    if (typeof value !== 'string') return value;
    if (!value.startsWith('@string/')) return value;
    const ref = value.replace('@string/', '');
    if (visiting.has(ref)) return value;
    visiting.add(ref);
    const resolvedValue = resolve(ref) || value;
    visiting.delete(ref);
    resolved[key] = resolvedValue;
    return resolvedValue;
  }

  Object.keys(resolved).forEach(resolve);
  return resolved;
}

class PreferenceStore {
  constructor(defaults = DEFAULT_PREFS, storageKey = STORAGE_KEY) {
    this.defaults = defaults;
    this.storageKey = storageKey;
    this.state = { ...defaults, ...this._readPersisted() };
  }

  _readPersisted() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch (error) {
      console.warn('Failed to read preferences, using defaults', error);
      return {};
    }
  }

  save() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.state));
  }

  get(key) {
    return key in this.state ? this.state[key] : this.defaults[key];
  }

  getNumber(key) {
    const value = this.get(key);
    const num = Number(value);
    return Number.isFinite(num) ? num : Number(this.defaults[key] ?? 0);
  }

  getBoolean(key) {
    const value = this.get(key);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value === 'true' || value === '1';
    }
    return Boolean(value);
  }

  set(key, value) {
    this.state[key] = value;
    this.save();
  }

  setMany(entries) {
    Object.assign(this.state, entries);
    this.save();
  }
}

class CounterPreference {
  constructor(store) {
    this.store = store;
  }

  getMode() {
    const raw = this.store.getNumber('mode');
    if (raw === 0) {
      return Math.max(1, Math.floor(this.store.getNumber('modeCustom') || DEFAULT_PREFS.modeCustom));
    }
    return raw;
  }

  getPreviousMode() {
    const current = this.getMode();
    let previous = this.store.getNumber('modePrevious');
    if (previous === current || (previous !== -1 && !this.isInfinityMode())) {
      return this.isInfinityMode() ? DEFAULT_PREFS.mode : -1;
    }
    return previous;
  }

  getModeStart() {
    if (this.isInfinityMode() || this.isNormalMode()) {
      return 0;
    }
    return this.getMode();
  }

  getModeMin() {
    if (this.isInfinityMode() || this.isReverse()) {
      return 0;
    }
    return -this.getMode() + 1;
  }

  getModeMax() {
    if (this.isInfinityMode()) {
      return Number.MAX_SAFE_INTEGER;
    }
    const mode = this.getMode();
    return this.isReverse() ? mode * 2 - 1 : mode - 1;
  }

  getIntervalMs() {
    let interval = this.store.getNumber('interval');
    if (interval === 0) {
      const custom = Number(this.store.get('intervalCustom'));
      interval = Number.isFinite(custom) ? Math.max(1, Math.round(custom * 1000)) : DEFAULT_PREFS.interval;
    }
    if (interval <= 0) return 1;
    return interval;
  }

  isInfinityMode() {
    return this.getMode() === -1;
  }

  isNormalMode(ignoreReverse = false) {
    if (this.isInfinityMode()) return false;
    return ignoreReverse || !this.isReverse();
  }

  isNormalModeIgnoringReverse() {
    return this.isNormalMode(true);
  }

  isReverse() {
    if (!this.isNormalModeIgnoringReverse()) return false;
    return this.store.getBoolean('reverse');
  }

  isImmediateStart() {
    return this.store.getBoolean('immediateStart');
  }

  isGongAfterPoint() {
    return this.store.getBoolean('gongAfterPoint');
  }

  isPauseAfterPoint() {
    return this.store.getBoolean('pauseAfterPoint');
  }

  isPauseAfterGong() {
    return this.store.getBoolean('pauseAfterGong');
  }

  isKeepDisplayAwake() {
    return this.store.getBoolean('keepAwake');
  }

  isStoneCountdown(value, threshold = STONE_COUNTDOWN_THRESHOLD) {
    if (this.isInfinityMode()) return false;
    if (!this.isNormalMode() || threshold <= this.getMode() - value) {
      return this.isReverse() && threshold > value;
    }
    return true;
  }

  toggleNormalModeWithInfinity() {
    const previous = this.getPreviousMode();
    const current = this.getMode();
    this.store.setMany({ mode: previous, modePrevious: current });
  }

  toggleReverse() {
    this.store.set('reverse', !this.isReverse());
  }
}

class SoundManager {
  constructor(prefStore) {
    this.prefStore = prefStore;
    this.updateFromPreferences();
  }

  updateFromPreferences() {
    this.stoneId = this.prefStore.get('soundStone') || DEFAULT_PREFS.soundStone;
    const countdown = this.prefStore.get('soundStoneCountdown');
    this.countdownId = countdown || this.stoneId;
    this.gongId = this.prefStore.get('soundGong') || DEFAULT_PREFS.soundGong;
  }

  playStone() {
    this._play(this.stoneId);
  }

  playStoneCountdown() {
    this._play(this.countdownId);
  }

  playGong() {
    this._play(this.gongId);
  }

  _play(id) {
    if (!id) return;
    const audio = new Audio(`assets/audio/${id}.mp3`);
    audio.play().catch(() => {
      /* ignore playback errors (autoplay restrictions) */
    });
  }
}

class WakeLockManager {
  constructor() {
    this.handle = null;
  }

  async enable() {
    if (!('wakeLock' in navigator)) return;
    try {
      this.handle = await navigator.wakeLock.request('screen');
      this.handle.addEventListener('release', () => {
        this.handle = null;
      });
    } catch (error) {
      console.warn('WakeLock request failed', error);
    }
  }

  async disable() {
    if (this.handle) {
      try {
        await this.handle.release();
      } catch (error) {
        console.warn('WakeLock release failed', error);
      }
      this.handle = null;
    }
  }
}

class TimerHandler {
  constructor(app, counterPref) {
    this.app = app;
    this.counterPref = counterPref;
    this.timerId = null;
  }

  start() {
    if (this.isRunning()) return;
    const interval = this.counterPref.getIntervalMs();
    this.app.valueHandler.saveHistoryEntry();
    this.app.setPlayState(true);
    if (this.counterPref.isImmediateStart()) {
      this.app.onTimerTick();
    }
    this.timerId = setInterval(() => this.app.onTimerTick(), interval);
  }

  pause() {
    if (!this.isRunning()) return;
    clearInterval(this.timerId);
    this.timerId = null;
    this.app.setPlayState(false);
  }

  toggle() {
    if (this.isRunning()) {
      this.pause();
    } else {
      this.start();
    }
  }

  stop() {
    this.pause();
    this.app.valueHandler.resetStones();
    this.app.valueHandler.clearHistory();
  }

  isRunning() {
    return this.timerId !== null;
  }
}

class ValueHandler {
  constructor(app, counterPref) {
    this.app = app;
    this.counterPref = counterPref;
  }

  reset() {
    this.resetTeams();
    this.resetStones();
  }

  resetTeams() {
    const names = [this.app.t('main_team1'), this.app.t('main_team2')];
    this.app.state.teams = [
      { name: names[0], color: DEFAULT_COLORS[0], points: 0 },
      { name: names[1], color: DEFAULT_COLORS[1], points: 0 },
    ];
    this.app.renderTeams();
  }

  setTeams(team1, team2) {
    const next = [];
    [team1, team2].forEach((team, index) => {
      const fallbackName = this.app.t(index === 0 ? 'main_team1' : 'main_team2');
      if (team) {
        next.push({
          name: team.name ?? fallbackName,
          color: team.color ?? DEFAULT_COLORS[index],
          points: typeof team.points === 'number' ? team.points : Number(team.points ?? 0),
        });
      } else {
        next.push({ name: fallbackName, color: DEFAULT_COLORS[index], points: 0 });
      }
    });
    this.app.state.teams = next;
    this.app.renderTeams();
  }

  flipTeams() {
    const [team1, team2] = this.app.state.teams;
    this.app.state.teams = [
      { ...team2 },
      { ...team1 },
    ];
    this.app.renderTeams();
  }

  setTeamColor(index, color) {
    const team = this.app.state.teams[index];
    if (!team) return;
    team.color = color;
    this.app.renderTeam(index);
  }

  getTeam(index) {
    const team = this.app.state.teams[index];
    return {
      name: team.name,
      color: team.color,
      points: team.points,
    };
  }

  getStones() {
    return this.cleanStones(this.app.state.stones);
  }

  setStones(value) {
    const cleaned = this.cleanStones(value);
    this.app.state.stones = cleaned;
    this.app.renderStones();
  }

  resetStones() {
    this.setStones(this.counterPref.getModeStart());
  }

  cleanStones(value) {
    let stones = Number.isFinite(value) ? Math.round(value) : 0;
    const min = this.counterPref.getModeMin();
    if (stones < min) {
      return this.counterPref.getModeStart();
    }
    let max = this.counterPref.getModeMax();
    if (stones > max) {
      const mode = this.counterPref.getMode();
      if (this.counterPref.isInfinityMode()) {
        return stones;
      }
      stones = stones % (mode * 2);
      max = this.counterPref.getModeMax();
      if (stones > max) {
        stones = stones % mode;
      }
    }
    if (this.counterPref.isReverse() && stones === 0) {
      return this.counterPref.getMode();
    }
    return stones;
  }

  saveHistoryEntry() {
    const entry = {
      team1: { ...this.getTeam(0) },
      team2: { ...this.getTeam(1) },
      stones: this.app.state.stones,
      mode: this.counterPref.getMode(),
      reverse: this.counterPref.isReverse(),
    };
    this.app.history = this.app.history.filter((item) => !deepEqual(item, entry));
    this.app.history.push(entry);
    if (this.app.history.length > HISTORY_LIMIT) {
      this.app.history.shift();
    }
  }

  getLastHistoryEntry() {
    return this.app.history.pop() ?? null;
  }

  clearHistory() {
    this.app.history = [];
  }

  applyHistoryEntry(entry) {
    if (!entry) {
      this.reset();
      return;
    }
    this.setTeams(entry.team1, entry.team2);
    this.setStones(entry.stones);
    if (this.counterPref.getMode() !== entry.mode) {
      this.app.updateModeFromHistory(entry.mode);
    }
    if (this.counterPref.isNormalModeIgnoringReverse() && entry.reverse !== this.counterPref.isReverse()) {
      this.counterPref.toggleReverse();
      this.app.onPreferencesUpdated();
    }
  }
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

class JuggerStonesWeb {
  constructor(i18n, prefStore) {
    this.i18n = i18n;
    this.prefStore = prefStore;
    this.counterPref = new CounterPreference(prefStore);
    this.sound = new SoundManager(prefStore);
    this.wakeLock = new WakeLockManager();
    this.timer = new TimerHandler(this, this.counterPref);
    this.valueHandler = new ValueHandler(this, this.counterPref);
    this.history = [];
    this.language = this.prefStore.get('language') || 'en';
    this.state = {
      teams: [
        { name: this.t('main_team1'), color: DEFAULT_COLORS[0], points: 0 },
        { name: this.t('main_team2'), color: DEFAULT_COLORS[1], points: 0 },
      ],
      stones: this.counterPref.getModeStart(),
      isPlaying: false,
    };
    this.elements = {};
  }

  t(key) {
    const strings = this.i18n[this.language] || this.i18n.en;
    return strings?.[key] ?? this.i18n.en?.[key] ?? key;
  }

  async init() {
    this.cacheElements();
    this.bindEvents();
    this.applyLanguage(this.language);
    this.syncSettingsForm();
    this.valueHandler.reset();
    if (this.counterPref.isKeepDisplayAwake()) {
      this.wakeLock.enable();
    }
    this.render();
  }

  cacheElements() {
    this.elements.teamNames = [...document.querySelectorAll('[data-role="team-name"]')];
    this.elements.teamPoints = [...document.querySelectorAll('[data-role="team-points"]')];
    this.elements.stones = document.querySelector('[data-role="stones"]');
    this.elements.playPause = document.querySelector('[data-role="playPause"]');
    this.elements.modeInfo = document.querySelector('[data-role="modeInfo"]');
    this.elements.status = document.querySelector('[data-role="status"]');
    this.elements.version = document.querySelector('[data-role="version"]');
    this.elements.emailLink = document.querySelector('[data-role="emailLink"]');
    this.elements.settingsDialog = document.getElementById('settingsDialog');
    this.elements.teamsDialog = document.getElementById('teamsDialog');
    this.elements.stonesDialog = document.getElementById('stonesDialog');
    this.elements.toastTemplate = document.getElementById('toastTemplate');
  }

  bindEvents() {
    document.querySelectorAll('[data-action="teamIncrease"]').forEach((button) => {
      const index = Number(button.dataset.team) - 1;
      button.addEventListener('click', () => this.adjustTeamPoints(index, 1));
    });

    document.querySelectorAll('[data-action="teamDecrease"]').forEach((button) => {
      const index = Number(button.dataset.team) - 1;
      button.addEventListener('click', () => this.adjustTeamPoints(index, -1));
      this.addLongPress(button, () => this.resetTeamPoints(index));
    });

    const stonesIncrease = document.querySelector('[data-action="stonesIncrease"]');
    const stonesDecrease = document.querySelector('[data-action="stonesDecrease"]');
    const stonesValue = this.elements.stones;

    stonesIncrease.addEventListener('click', () => this.incrementStones());
    stonesDecrease.addEventListener('click', () => this.decrementStones());

    this.addLongPress(stonesIncrease, () => {
      if (!this.timer.isRunning() && this.counterPref.isReverse()) {
        this.valueHandler.setStones(this.counterPref.getMode());
        return true;
      }
      return false;
    });

    this.addLongPress(stonesDecrease, () => {
      if (!this.timer.isRunning() && this.valueHandler.getStones() !== 0) {
        this.valueHandler.setStones(0);
        return true;
      }
      return false;
    });

    this.addLongPress(stonesValue, () => {
      if (this.timer.isRunning()) return false;
      this.openStonesDialog();
      return true;
    });

    document.querySelector('[data-action="toggleTimer"]').addEventListener('click', () => this.timer.toggle());
    document.querySelector('[data-action="stopTimer"]').addEventListener('click', () => this.timer.stop());

    const infoButton = this.elements.modeInfo;
    infoButton.addEventListener('click', () => this.handleModeToggle());
    this.addLongPress(infoButton, () => this.handleReverseToggle());

    document.querySelector('[data-action="openTeams"]').addEventListener('click', () => this.openTeamsDialog());
    document.querySelector('[data-action="setStones"]').addEventListener('click', () => this.openStonesDialog());
    document.querySelector('[data-action="history"]').addEventListener('click', () => this.applyLastHistory());
    document.querySelector('[data-action="openSettings"]').addEventListener('click', () => this.openSettingsDialog());

    document.querySelectorAll('[data-role="team-name"]').forEach((element, index) => {
      this.addLongPress(element, () => {
        this.openColorPicker(index);
        return true;
      });
    });

    document.querySelectorAll('[data-action="close"]').forEach((button) => {
      button.addEventListener('click', () => {
        const dialog = button.closest('dialog');
        if (dialog) dialog.close();
      });
    });

    this.elements.teamsDialog?.addEventListener('close', () => this.syncTeamsForm());

    this.elements.teamsDialog?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.target;
      const data = new FormData(form);
      this.applyTeamsForm(data);
      this.elements.teamsDialog.close();
    });

    this.elements.stonesDialog?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.target;
      const value = Number(form.elements.stonesValue.value);
      if (!Number.isFinite(value)) return;
      this.valueHandler.setStones(value);
      this.elements.stonesDialog.close();
    });

    document.querySelector('[data-action="resetStones"]').addEventListener('click', () => {
      this.valueHandler.resetStones();
    });

    document.querySelector('[data-action="swapTeams"]').addEventListener('click', () => {
      this.valueHandler.flipTeams();
      this.syncTeamsForm();
    });

    document.querySelector('[data-action="resetTeams"]').addEventListener('click', () => {
      this.valueHandler.resetTeams();
      this.syncTeamsForm();
    });

    this.elements.settingsDialog?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.applySettingsForm(new FormData(event.target));
      this.elements.settingsDialog.close();
    });

    const modeSelect = document.querySelector('select[name="mode"]');
    modeSelect?.addEventListener('change', () => this.updateSettingsDependencies());

    const intervalSelect = document.querySelector('select[name="interval"]');
    intervalSelect?.addEventListener('change', () => this.updateSettingsDependencies());

    document.querySelectorAll('select[name^="sound"]').forEach((select) => {
      select.addEventListener('change', (event) => {
        const id = event.target.value;
        const audio = new Audio(`assets/audio/${id}.mp3`);
        audio.play().catch(() => {});
      });
    });

    this.elements.settingsDialog?.addEventListener('cancel', () => {
      this.syncSettingsForm();
    });
  }

  addLongPress(element, handler) {
    let timeoutId = null;
    const start = (event) => {
      if (event.type === 'mousedown' && event.button !== 0) return;
      timeoutId = window.setTimeout(() => {
        const shouldPreventClick = handler();
        if (shouldPreventClick) {
          element.classList.add('long-press-active');
        }
      }, LONG_PRESS_DURATION);
    };
    const cancel = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
        element.classList.remove('long-press-active');
      }
    };
    element.addEventListener('mousedown', start);
    element.addEventListener('touchstart', start, { passive: true });
    element.addEventListener('mouseup', cancel);
    element.addEventListener('mouseleave', cancel);
    element.addEventListener('touchend', cancel);
    element.addEventListener('touchcancel', cancel);
  }

  adjustTeamPoints(index, delta) {
    const team = this.state.teams[index];
    if (!team) return;
    if (delta > 0) {
      const wasRunning = this.timer.isRunning();
      team.points += delta;
      if (this.counterPref.isPauseAfterPoint()) {
        this.timer.pause();
      }
      if (wasRunning && this.counterPref.isGongAfterPoint()) {
        this.sound.playGong();
      }
    } else if (delta < 0) {
      if (team.points <= 0) return;
      team.points = Math.max(0, team.points + delta);
    }
    this.renderTeam(index);
  }

  resetTeamPoints(index) {
    const team = this.state.teams[index];
    if (!team) return;
    team.points = 0;
    this.renderTeam(index);
  }

  incrementStones() {
    if (this.timer.isRunning()) return;
    if (this.valueHandler.getStones() < this.counterPref.getModeMax()) {
      this.valueHandler.setStones(this.state.stones + 1);
    }
  }

  decrementStones() {
    if (this.timer.isRunning()) return;
    if (this.valueHandler.getStones() > this.counterPref.getModeMin()) {
      this.valueHandler.setStones(this.state.stones - 1);
    }
  }

  setPlayState(isPlaying) {
    this.state.isPlaying = isPlaying;
    this.renderPlayPause();
  }

  renderPlayPause() {
    if (!this.elements.playPause) return;
    this.elements.playPause.textContent = this.state.isPlaying ? '||' : '>';
    this.elements.playPause.setAttribute('aria-pressed', String(this.state.isPlaying));
  }

  onTimerTick() {
    let stones = this.state.stones;
    const increment = this.counterPref.isReverse() ? -1 : 1;
    stones = Number.isFinite(stones) ? stones + increment : increment;

    if (Math.abs(stones) >= Number.MAX_SAFE_INTEGER) {
      stones = this.counterPref.getModeStart();
    }

    if (this.counterPref.isNormalModeIgnoringReverse()) {
      const mode = this.counterPref.getMode();
      stones = stones % (mode * 2);
    }

    this.state.stones = stones;
    this.renderStones();

    if (this.counterPref.isInfinityMode() && stones > 0 && stones % DEFAULT_PREFS.interval === 0) {
      this.showToast('main_toast_infinity');
    }

    const isReverse = this.counterPref.isReverse();
    const mode = this.counterPref.getMode();
    if ((isReverse && stones === 0) || (this.counterPref.isNormalMode() && stones === mode)) {
      stones = stones % mode;
      if (isReverse) {
        stones = mode;
      }
      this.state.stones = stones;
      this.renderStones();
      this.sound.playGong();
      if (this.counterPref.isPauseAfterGong()) {
        this.timer.pause();
      }
      return;
    }

    if (this.counterPref.isStoneCountdown(Math.abs(stones))) {
      this.sound.playStoneCountdown();
    } else {
      this.sound.playStone();
    }
  }

  handleModeToggle() {
    if (this.timer.isRunning()) return;
    this.counterPref.toggleNormalModeWithInfinity();
    this.onPreferencesUpdated();
    this.valueHandler.setStones(this.counterPref.getModeStart());
  }

  handleReverseToggle() {
    if (this.timer.isRunning()) return false;
    if (!this.counterPref.isNormalModeIgnoringReverse()) return false;
    this.counterPref.toggleReverse();
    this.onPreferencesUpdated();
    this.valueHandler.setStones(this.counterPref.getModeStart());
    return true;
  }

  openTeamsDialog() {
    this.syncTeamsForm();
    this.elements.teamsDialog.showModal();
  }

  openStonesDialog() {
    const input = this.elements.stonesDialog.querySelector('input[name="stonesValue"]');
    if (input) {
      input.value = this.state.stones;
      input.min = this.counterPref.getModeMin();
      input.max = this.counterPref.getModeMax();
    }
    this.elements.stonesDialog.showModal();
  }

  openSettingsDialog() {
    this.syncSettingsForm();
    this.updateSettingsDependencies();
    this.elements.settingsDialog.showModal();
  }

  openColorPicker(index) {
    const team = this.state.teams[index];
    if (!team) return;
    const inputName = index === 0 ? 'team1Color' : 'team2Color';
    const input = this.elements.teamsDialog.querySelector(`input[name="${inputName}"]`);
    if (input) {
      this.syncTeamsForm();
      input.value = team.color;
      this.elements.teamsDialog.showModal();
    }
  }

  applyLastHistory() {
    const entry = this.valueHandler.getLastHistoryEntry();
    this.valueHandler.applyHistoryEntry(entry);
    this.onPreferencesUpdated();
  }

  applyTeamsForm(data) {
    const team1 = {
      name: data.get('team1Name')?.toString().trim() || this.t('main_team1'),
      color: data.get('team1Color') || DEFAULT_COLORS[0],
      points: this.state.teams[0].points,
    };
    const team2 = {
      name: data.get('team2Name')?.toString().trim() || this.t('main_team2'),
      color: data.get('team2Color') || DEFAULT_COLORS[1],
      points: this.state.teams[1].points,
    };
    this.valueHandler.setTeams(team1, team2);
  }

  syncTeamsForm() {
    const dialog = this.elements.teamsDialog;
    if (!dialog) return;
    const [team1, team2] = this.state.teams;
    dialog.querySelector('input[name="team1Name"]').value = team1.name;
    dialog.querySelector('input[name="team1Color"]').value = team1.color;
    dialog.querySelector('input[name="team2Name"]').value = team2.name;
    dialog.querySelector('input[name="team2Color"]').value = team2.color;
  }

  syncSettingsForm() {
    const dialog = this.elements.settingsDialog;
    if (!dialog) return;
    const mode = this.prefStore.getNumber('mode');
    const interval = this.prefStore.getNumber('interval');
    dialog.querySelector('select[name="mode"]').value = String(mode);
    dialog.querySelector('input[name="modeCustom"]').value = String(this.prefStore.getNumber('modeCustom'));
    dialog.querySelector('select[name="interval"]').value = String(interval);
    dialog.querySelector('input[name="intervalCustom"]').value = String(this.prefStore.get('intervalCustom'));
    dialog.querySelector('input[name="reverse"]').checked = this.prefStore.getBoolean('reverse');
    dialog.querySelector('input[name="immediateStart"]').checked = this.prefStore.getBoolean('immediateStart');
    dialog.querySelector('input[name="gongAfterPoint"]').checked = this.prefStore.getBoolean('gongAfterPoint');
    dialog.querySelector('input[name="pauseAfterPoint"]').checked = this.prefStore.getBoolean('pauseAfterPoint');
    dialog.querySelector('input[name="pauseAfterGong"]').checked = this.prefStore.getBoolean('pauseAfterGong');
    dialog.querySelector('input[name="keepAwake"]').checked = this.prefStore.getBoolean('keepAwake');
    dialog.querySelector('select[name="soundStone"]').innerHTML = this.buildSoundOptions(SOUND_STONE_OPTIONS, this.prefStore.get('soundStone'));
    dialog.querySelector('select[name="soundStoneCountdown"]').innerHTML = this.buildSoundOptions(SOUND_STONE_OPTIONS, this.prefStore.get('soundStoneCountdown'));
    dialog.querySelector('select[name="soundGong"]').innerHTML = this.buildSoundOptions(SOUND_GONG_OPTIONS, this.prefStore.get('soundGong'));
    dialog.querySelector('select[name="language"]').innerHTML = this.buildLanguageOptions();
    dialog.querySelector('select[name="language"]').value = this.language;
    this.elements.version.textContent = `${this.t('pref_version').replace('%1$s', '1.8.1-web')}`;
    this.updateSettingsDependencies();
  }

  buildSoundOptions(options, current) {
    return options
      .map((option) => {
        const selected = option.id === current ? ' selected' : '';
        return `<option value="${option.id}"${selected}>${this.t(option.labelKey)}</option>`;
      })
      .join('');
  }

  buildLanguageOptions() {
    const languages = [
      { id: 'en', label: this.t('language_english_en') },
      { id: 'de', label: this.t('language_german_en') },
      { id: 'es', label: this.t('language_spanish_en') },
      { id: 'fr', label: this.t('language_french_en') },
      { id: 'pt', label: this.t('language_portuguese_en') },
    ];
    return languages
      .map(({ id, label }) => `<option value="${id}">${label}</option>`)
      .join('');
  }

  updateSettingsDependencies() {
    const dialog = this.elements.settingsDialog;
    if (!dialog) return;
    const modeSelect = dialog.querySelector('select[name="mode"]');
    const intervalSelect = dialog.querySelector('select[name="interval"]');
    const isCustomMode = modeSelect.value === '0';
    const isCustomInterval = intervalSelect.value === '0';
    dialog.querySelector('[data-settings="modeCustom"]').classList.toggle('hidden', !isCustomMode);
    dialog.querySelector('input[name="modeCustom"]').disabled = !isCustomMode;
    dialog.querySelector('[data-settings="intervalCustom"]').classList.toggle('hidden', !isCustomInterval);
    dialog.querySelector('input[name="intervalCustom"]').disabled = !isCustomInterval;
    dialog.querySelector('input[name="reverse"]').disabled = modeSelect.value === '-1';
  }

  applySettingsForm(data) {
    const updates = {
      mode: Number(data.get('mode')),
      modeCustom: Number(data.get('modeCustom')) || DEFAULT_PREFS.modeCustom,
      interval: Number(data.get('interval')),
      intervalCustom: Number(data.get('intervalCustom')) || DEFAULT_PREFS.intervalCustom,
      reverse: data.get('reverse') === 'on',
      immediateStart: data.get('immediateStart') === 'on',
      gongAfterPoint: data.get('gongAfterPoint') === 'on',
      pauseAfterPoint: data.get('pauseAfterPoint') === 'on',
      pauseAfterGong: data.get('pauseAfterGong') === 'on',
      keepAwake: data.get('keepAwake') === 'on',
      soundStone: data.get('soundStone'),
      soundStoneCountdown: data.get('soundStoneCountdown'),
      soundGong: data.get('soundGong'),
      language: data.get('language') || this.language,
    };
    const prevStone = this.prefStore.get('soundStone');
    const prevCountdown = this.prefStore.get('soundStoneCountdown');
    const previousMode = this.counterPref.getMode();
    if (prevCountdown === prevStone && updates.soundStone && updates.soundStone !== prevStone) {
      updates.soundStoneCountdown = updates.soundStone;
    }
    if (updates.mode === -1 && previousMode !== -1) {
      updates.modePrevious = previousMode;
    } else if (previousMode === -1 && updates.mode !== -1) {
      updates.modePrevious = -1;
    }
    if (updates.mode !== 0 && updates.mode !== -1) {
      updates.modeCustom = updates.mode;
    }
    if (updates.interval !== 0) {
      updates.intervalCustom = updates.interval / 1000;
    }
    this.prefStore.setMany(updates);
    this.language = updates.language;
    this.onPreferencesUpdated();
    if (updates.keepAwake) {
      this.wakeLock.enable();
    } else {
      this.wakeLock.disable();
    }
  }

  updateModeFromHistory(mode) {
    if (mode === -1) {
      this.prefStore.setMany({ mode: -1, modePrevious: this.counterPref.getMode() });
    } else {
      this.prefStore.setMany({ mode, modePrevious: -1 });
    }
    this.onPreferencesUpdated();
  }

  onPreferencesUpdated() {
    this.counterPref = new CounterPreference(this.prefStore);
    this.sound.updateFromPreferences();
    this.timer.counterPref = this.counterPref;
    this.valueHandler.counterPref = this.counterPref;
    this.renderModeInfo();
    this.syncSettingsForm();
    this.applyLanguage(this.prefStore.get('language'));
    this.render();
  }

  applyLanguage(language) {
    if (!this.i18n[language]) {
      language = 'en';
    }
    this.language = language;
    document.documentElement.lang = language;
    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.getAttribute('data-i18n');
      element.textContent = this.t(key);
    });
    this.render();
  }

  render() {
    this.renderTeams();
    this.renderStones();
    this.renderPlayPause();
    this.renderModeInfo();
  }

  renderTeams() {
    this.state.teams.forEach((team, index) => this.renderTeam(index));
  }

  renderTeam(index) {
    const team = this.state.teams[index];
    if (!team) return;
    const nameEl = this.elements.teamNames[index];
    const pointsEl = this.elements.teamPoints[index];
    if (nameEl) {
      nameEl.textContent = team.name;
      nameEl.style.color = team.color;
    }
    if (pointsEl) {
      pointsEl.textContent = team.points;
      pointsEl.style.color = team.color;
    }
  }

  renderStones() {
    if (this.elements.stones) {
      const cleaned = this.valueHandler.cleanStones(this.state.stones);
      this.state.stones = cleaned;
      this.elements.stones.textContent = cleaned;
    }
  }

  renderModeInfo() {
    const button = this.elements.modeInfo;
    if (!button) return;
    if (this.counterPref.isInfinityMode()) {
      button.innerHTML = '&#8734;';
      button.title = this.t('pref_mode_infinite');
    } else if (this.counterPref.isReverse()) {
      button.textContent = 'v';
      button.title = this.t('pref_reverse');
    } else {
      button.textContent = '^';
      button.title = this.t('pref_mode');
    }
  }

  showToast(key) {
    const template = this.elements.toastTemplate;
    if (!template) return;
    const clone = template.content.cloneNode(true);
    const toast = clone.querySelector('.toast');
    toast.textContent = this.t(key);
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3200);
  }
}

(async function bootstrap() {
  try {
    const i18n = await loadI18n();
    const prefStore = new PreferenceStore();
    const app = new JuggerStonesWeb(i18n, prefStore);
    await app.init();
    window.juggerStones = app;
  } catch (error) {
    console.error('Failed to start JuggerStones Web', error);
  }
})();
