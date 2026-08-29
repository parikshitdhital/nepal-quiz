
let DATA, PROVINCE_OF, CITIES, LANDMARKS, DISTRICT_FACTS;

// Province identity colors (borders/badges/streak pills). 0 = All Nepal scope.
const PROV_COLORS = {
  0: '#c9a24b', // gold - All Nepal
  1: '#e07a63', // Koshi - warm coral
  2: '#e6c877', // Madhesh - amber
  3: '#8fd89a', // Bagmati - mint green
  4: '#7ab8e0', // Gandaki - sky blue
  5: '#c48fe0', // Lumbini - violet
  6: '#e0a45f', // Karnali - ochre
  7: '#6fc9c2'  // Sudurpashchim - teal
};
const PROV_LABEL = {
  0:'Provinces Mode',1:'Province 1',2:'Province 2',3:'Province 3',
  4:'Province 4',5:'Province 5',6:'Province 6',7:'Province 7'
};
const MODE_LABEL = { district:'Districts', city:'Cities', landmark:'Landmarks', headquarters:'Headquarters' };
const MODE_COLOR = { district:'#c9a24b', city:'#7ab8e0', landmark:'#c48fe0', headquarters:'#e07a63' };

let districts; // populated after data loads

const svg = document.getElementById('map');
const mapViewport = document.getElementById('mapViewport');
const zoomResetBtn = document.getElementById('zoomReset');
const promptEl = document.getElementById('promptName');
const promptLabelEl = document.getElementById('promptLabel');
const feedbackEl = document.getElementById('feedback');
const streakNumEl = document.getElementById('streakNum');
const bestNumEl = document.getElementById('bestNum');
const bestInlineEl = document.getElementById('bestInline');
const toastEl = document.getElementById('toast');
const tapLabelEl = document.getElementById('tapLabel');
const reactionPop = document.getElementById('reactionPop');
const muteBtn = document.getElementById('muteBtn');
const provTab = document.getElementById('provTab');
const provPanel = document.getElementById('provPanel');
const provGrid = document.getElementById('provGrid');
const provTabLabel = document.getElementById('provTabLabel');
const provTabDot = document.getElementById('provTabDot');
const modeTab = document.getElementById('modeTab');
const modePanel = document.getElementById('modePanel');
const modeGrid = document.getElementById('modeGrid');
const modeTabLabel = document.getElementById('modeTabLabel');
const modeTabDot = document.getElementById('modeTabDot');
const recallTab = document.getElementById('recallTab');
const recallDropdown = document.getElementById('recallPanel_dropdown');
const recallGrid = document.getElementById('recallGrid');
const recallTabLabel = document.getElementById('recallTabLabel');
const recallTabDot = document.getElementById('recallTabDot');
const recallPanel = document.getElementById('recallPanel');
const recallInput = document.getElementById('recallInput');
const recallCheckBtn = document.getElementById('recallCheckBtn');
const recallSuggestions = document.getElementById('recallSuggestions');
const shadowSwitch = document.getElementById('shadowSwitch');
const infoSwitch = document.getElementById('infoSwitch');
const labelsSwitch = document.getElementById('labelsSwitch');
const labelsToggleWrap = document.getElementById('labelsToggleWrap');
const searchIconBtn = document.getElementById('searchIconBtn');
const searchWrap = document.getElementById('searchWrap');
const searchInput = document.getElementById('searchInput');
const searchMsg = document.getElementById('searchMsg');
const factPanel = document.getElementById('factPanel');
const factDistrict = document.getElementById('factDistrict');
const factHq = document.getElementById('factHq');
const factPop = document.getElementById('factPop');
const factArea = document.getElementById('factArea');
const factText = document.getElementById('factText');

let mode = 'district';
let scope = 0; // current province scope, 0 = All Nepal
let streaks = {};
let bests   = {};
let soundOn = true;
let shadowOn = false;
let infoOn = true;
let labelsOn = false;
let interactionType = 'tap'; // 'tap' | 'recall'
let tapCategory = 'district';
let recallCategory = 'district';
let recallLocked = false;
let currentTarget = null;
let lastAsked = null;
let locked = false;
let appearedCounts = {}; // namespaced by mode, drives weighting + shadowing

function scopeKey(){ return mode + ':' + scope; }
function ensureScopeState(key){
  if(!(key in streaks)) streaks[key] = 0;
  if(!(key in bests)) bests[key] = 0;
}
function appearedKey(name){ return mode + '::' + name; }

// ---- Audio ----
let actx = null;
function ensureAudio(){
  if(!actx){ actx = new (window.AudioContext || window.webkitAudioContext)(); }
}
function playTone(freq, duration, type, startGain){
  if(!soundOn) return;
  ensureAudio();
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, actx.currentTime);
  gain.gain.setValueAtTime(startGain, actx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + duration);
  osc.connect(gain);
  gain.connect(actx.destination);
  osc.start();
  osc.stop(actx.currentTime + duration);
}
function playCorrect(){
  playTone(880, 0.12, 'sine', 0.18);
  setTimeout(()=>playTone(1320, 0.15, 'sine', 0.14), 80);
}
function playWrong(){
  playTone(180, 0.28, 'sawtooth', 0.12);
}

// ---- Reaction pop-ups (word banks + streak-milestone specials) ----
const CORRECT_WORDS = [
  "Bingo!!!","Yayyy!!!","Nailed it!","Boom!","Yasss!","Sharp!","Nice one!",
  "Ka-ching!","Correctamundo!","Smooth!","You got it!","Legend!","Sweet!",
  "That's it!","Bang on!","Woohoo!","Spot on!","Ez!","Crushed it!","Yes!!",
  "Perfect!","Solid!","Slick!","Score!","Zing!","Boom baby!","Chef's kiss!",
  "Too easy!","On point!","Clean hit!"
];
const WRONG_WORDS = [
  "Oops!","Yikes!","Seriously?","Not quite!","Nope!","Whoops!","Aw man!",
  "So close!","Nah!","Hmm, no.","Not this time!","Argh!","Miss!","Try again!",
  "Wrong turn!","Off by a mile!","Ouch!","Nuh-uh!","Way off!","Uh-oh!",
  "Nope, not it.","Big miss!","Wrong district!","That's a no.","Swing and a miss!",
  "Close, but no.","Nada.","Wrongo!","Not even close!","Whiff!"
];
const MILESTONE_WORDS = {
  5: "ON A ROLL!", 10: "ON FIRE! 🔥", 15: "UNREAL!", 20: "UNSTOPPABLE!",
  25: "LEGENDARY!", 50: "GODLIKE!", 100: "certified nepal expert."
};

let lastCorrectWord = null, lastWrongWord = null;

function pickWord(bank, lastPicked){
  let word = bank[Math.floor(Math.random() * bank.length)];
  if(bank.length > 1){
    while(word === lastPicked){
      word = bank[Math.floor(Math.random() * bank.length)];
    }
  }
  return word;
}

function showReaction(kind, streakAfter){
  const milestoneWord = (kind === 'correct') ? MILESTONE_WORDS[streakAfter] : null;
  let word;
  if(milestoneWord){
    word = milestoneWord;
  } else if(kind === 'correct'){
    word = pickWord(CORRECT_WORDS, lastCorrectWord);
    lastCorrectWord = word;
  } else {
    word = pickWord(WRONG_WORDS, lastWrongWord);
    lastWrongWord = word;
  }

  reactionPop.textContent = word;
  reactionPop.className = 'reaction-pop'; // clear animation state
  void reactionPop.offsetWidth; // force reflow so the animation restarts even on rapid re-trigger
  reactionPop.classList.add(kind);
}

// ---- Build SVG (colored by province for border clarity) ----
function buildMap(){
  districts = DATA.districts;
  document.getElementById('map').setAttribute('viewBox', DATA.viewBox);

  districts.forEach(d => {
    const prov = PROVINCE_OF[d.name] || 0;
    const baseColor = PROV_COLORS[prov];
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d.d);
    path.setAttribute('class', 'district');
    path.setAttribute('data-name', d.name);
    path.setAttribute('data-prov', prov);
    path.style.fill = shade(baseColor, -0.72);
    path.style.stroke = baseColor;
    path.addEventListener('click', () => handleTap(d.name, path));
    svg.appendChild(path);
  });

  // Label layer (for shadowing) - placed after all paths so it draws on top
  districts.forEach(d => {
    const path = pathFor(d.name);
    const bbox = path.getBBox();
    const cx = bbox.x + bbox.width/2;
    const cy = bbox.y + bbox.height/2;
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', cx);
    label.setAttribute('y', cy);
    label.setAttribute('class', 'district-label');
    label.setAttribute('data-name', d.name);
    label.textContent = d.name;
    svg.appendChild(label);
  });

  buildMarkerLayer(CITIES, 'city-layer');
  buildMarkerLayer(LANDMARKS, 'landmark-layer');
}

function labelFor(name){
  return svg.querySelector(`text.district-label[data-name="${CSS.escape(name)}"]`);
}

// ---- Marker layers (cities / landmarks) ----
function buildMarkerLayer(items, layerClass){
  items.forEach(item => {
    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    hit.setAttribute('cx', item.x);
    hit.setAttribute('cy', item.y);
    hit.setAttribute('r', 14);
    hit.setAttribute('class', 'marker-hit ' + layerClass);
    hit.setAttribute('data-name', item.name);
    hit.setAttribute('data-prov', item.prov);
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', item.x);
    dot.setAttribute('cy', item.y);
    dot.setAttribute('r', 5);
    dot.setAttribute('class', 'marker ' + layerClass);
    dot.setAttribute('data-name', item.name);
    dot.setAttribute('data-prov', item.prov);
    const tap = () => handleTap(item.name, dot);
    hit.addEventListener('click', tap);
    dot.addEventListener('click', tap);
    svg.appendChild(hit);
    svg.appendChild(dot);
  });
}

function markerFor(layerClass, name){
  return svg.querySelector(`circle.marker.${layerClass}[data-name="${CSS.escape(name)}"]`);
}
function elementFor(name){
  if(mode === 'district' || mode === 'headquarters') return pathFor(name);
  if(mode === 'city') return markerFor('city-layer', name);
  return markerFor('landmark-layer', name);
}
function currentItemSet(){
  if(mode === 'district' || mode === 'headquarters') return districts;
  if(mode === 'city') return CITIES;
  return LANDMARKS;
}
function itemProvince(name){
  if(mode === 'district' || mode === 'headquarters') return PROVINCE_OF[name] || 0;
  const item = currentItemSet().find(x => x.name === name);
  return item ? item.prov : 0;
}

function coreName(raw){
  // strips a parenthetical qualifier, e.g. "Bhadrapur (Chandragadhi)" -> "Bhadrapur"
  const idx = raw.indexOf('(');
  return (idx === -1 ? raw : raw.slice(0, idx)).trim();
}

function shade(hex, amt){
  // darken a hex color toward background for fill, keep hue readable
  const c = hex.replace('#','');
  const r = parseInt(c.substring(0,2),16), g = parseInt(c.substring(2,4),16), b = parseInt(c.substring(4,6),16);
  const mix = (v)=> Math.round(v + (amt>0? (255-v)*amt : v*amt));
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

function pathFor(name){
  return svg.querySelector(`path[data-name="${CSS.escape(name)}"]`);
}
function poolForScope(){
  const set = currentItemSet();
  if(scope === 0) return set;
  if(mode === 'district' || mode === 'headquarters') return set.filter(d => PROVINCE_OF[d.name] === scope);
  return set.filter(d => d.prov === scope);
}

function applyLayerVisibility(){
  const districtInteractiveMode = (mode === 'district' || mode === 'headquarters');
  svg.querySelectorAll('path.district').forEach(p => {
    p.classList.toggle('bg-mode', !districtInteractiveMode);
  });
  svg.querySelectorAll('.city-layer').forEach(el => {
    el.style.display = (mode === 'city') ? '' : 'none';
  });
  svg.querySelectorAll('.landmark-layer').forEach(el => {
    el.style.display = (mode === 'landmark') ? '' : 'none';
  });
}

function applyDimming(){
  applyLayerVisibility();
  const pool = new Set(poolForScope().map(d=>d.name));

  if(mode === 'district' || mode === 'headquarters'){
    svg.querySelectorAll('path.district').forEach(p=>{
      const name = p.getAttribute('data-name');
      p.classList.toggle('dimmed', !pool.has(name));
    });
  } else {
    const layerClass = mode === 'city' ? 'city-layer' : 'landmark-layer';
    svg.querySelectorAll(`.${layerClass}`).forEach(el=>{
      const name = el.getAttribute('data-name');
      el.classList.toggle('dimmed', !pool.has(name));
    });
  }
  refreshShadowLabels();
}

function refreshShadowLabels(){
  const pool = new Set(poolForScope().map(d=>d.name));
  const labelsEligible = (mode === 'city' || mode === 'landmark' || mode === 'headquarters');
  districts.forEach(d => {
    const lbl = labelFor(d.name);
    const inScope = pool.has(d.name);
    let show = false;
    if(mode === 'district' || mode === 'headquarters'){
      const seen = (appearedCounts[appearedKey(d.name)] || 0) > 0;
      show = shadowOn && inScope && seen;
    }
    if(labelsOn && labelsEligible && inScope){
      show = true;
    }
    lbl.classList.toggle('show', show);
  });
}

function pickNext(){
  const pool = poolForScope();
  let candidates = pool.filter(d => d.name !== lastAsked);
  if(candidates.length === 0) candidates = pool;

  // Weighted so already-asked items show up less often, but never zero (still infinite/all-inclusive)
  const weights = candidates.map(d => 1 / (1 + (appearedCounts[appearedKey(d.name)] || 0)));
  const total = weights.reduce((a,b)=>a+b, 0);
  let r = Math.random() * total;
  let choice = candidates[candidates.length-1];
  for(let i=0; i<candidates.length; i++){
    r -= weights[i];
    if(r <= 0){ choice = candidates[i]; break; }
  }

  lastAsked = choice.name;
  currentTarget = choice.name;
  clearRecallGlow();

  if(interactionType === 'recall'){
    recallInput.value = '';
    recallSuggestions.innerHTML = '';
    if(mode === 'headquarters'){
      promptLabelEl.textContent = 'Type the headquarters of';
      promptEl.textContent = choice.name;
    } else {
      const singular = MODE_LABEL[mode].replace(/s$/, '').toLowerCase();
      promptLabelEl.textContent = 'Type the highlighted ' + singular;
      promptEl.textContent = '';
      const el = elementFor(choice.name);
      if(el) el.classList.add('recall-glow');
    }
  } else {
    if(mode === 'headquarters' && DISTRICT_FACTS[choice.name]){
      promptLabelEl.textContent = 'Tap the district whose HQ is';
      promptEl.textContent = coreName(DISTRICT_FACTS[choice.name][0]);
    } else {
      promptLabelEl.textContent = 'Tap on';
      promptEl.textContent = choice.name;
    }
  }
  feedbackEl.textContent = '';
  feedbackEl.className = 'feedback';
  locked = false;
  refreshShadowLabels();
}

function resetPaintedPaths(){
  svg.querySelectorAll('path.district, circle.marker').forEach(p=>{
    p.classList.remove('correct','wrong','locked');
  });
  svg.querySelectorAll('circle.marker-hit').forEach(p=>{
    p.classList.remove('locked');
  });
}

function unlockTapping(){
  svg.querySelectorAll('.locked').forEach(p => p.classList.remove('locked'));
}

function showTapLabel(name){
  tapLabelEl.textContent = name;
  tapLabelEl.classList.add('show');
  setTimeout(()=> tapLabelEl.classList.remove('show'), 1000);
}

function handleTap(name, el){
  if(interactionType === 'recall') return; // map isn't the answer surface in Recall Mode
  if(locked) return;
  locked = true;
  resetPaintedPaths(); // clear previous question's highlight now that a new attempt is happening
  svg.querySelectorAll('path.district, circle.marker, circle.marker-hit').forEach(p=>p.classList.add('locked'));
  showTapLabel(name);

  const key = scopeKey();
  ensureScopeState(key);
  const correctEl = elementFor(currentTarget);

  if(name === currentTarget){
    el.classList.add('correct');
    feedbackEl.textContent = 'Correct — ' + currentTarget;
    feedbackEl.className = 'feedback ok';
    playCorrect();
    streaks[key]++;
    showReaction('correct', streaks[key]);
    if(streaks[key] > bests[key]){
      bests[key] = streaks[key];
      saveBest(key, bests[key]);
      showToast('New best (' + MODE_LABEL[mode] + ' · ' + PROV_LABEL[scope] + '): ' + bests[key]);
    }
  } else {
    el.classList.add('wrong');
    if(correctEl) correctEl.classList.add('correct');
    feedbackEl.textContent = 'That was ' + name + ' — ' + currentTarget + ' is highlighted';
    feedbackEl.className = 'feedback bad';
    playWrong();
    showReaction('wrong', null);
    streaks[key] = 0;
  }
  appearedCounts[appearedKey(currentTarget)] = (appearedCounts[appearedKey(currentTarget)] || 0) + 1;
  updateScores();
  refreshShadowLabels();
  showFactPanel(currentTarget);

  setTimeout(() => {
    unlockTapping();
    pickNext();
  }, 1000);
}

function updateScores(){
  const key = scopeKey();
  ensureScopeState(key);
  streakNumEl.textContent = streaks[key];
  bestNumEl.textContent = bests[key];
  bestInlineEl.textContent = bests[key];
}

function showToast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(()=> toastEl.classList.remove('show'), 1800);
}

// ---- Province selector UI ----
function buildProvinceUI(){
  for(let p=0; p<=7; p++){
    const opt = document.createElement('div');
    opt.className = 'prov-opt' + (p===scope ? ' active' : '');
    opt.setAttribute('data-scope', p);
    opt.innerHTML = `<div class="sw" style="background:${PROV_COLORS[p]}"></div><div>${p===0?'All':'P'+p}</div>`;
    opt.addEventListener('click', () => selectScope(p));
    provGrid.appendChild(opt);
  }
}

function selectScope(p){
  scope = p;
  provTabLabel.textContent = PROV_LABEL[p];
  provTabDot.style.background = PROV_COLORS[p];
  document.querySelectorAll('.prov-opt').forEach(o=>{
    o.classList.toggle('active', parseInt(o.getAttribute('data-scope'),10) === p);
  });
  closePanel();
  applyDimming();
  updateScores();
  lastAsked = null;
  pickNext();
}

// ---- Mode selector UI ----
function buildModeUI(){
  ['district','city','landmark','headquarters'].forEach(m => {
    const opt = document.createElement('div');
    opt.className = 'prov-opt' + (m===mode ? ' active' : '');
    opt.setAttribute('data-mode', m);
    opt.innerHTML = `<div class="sw" style="background:${MODE_COLOR[m]}"></div><div>${MODE_LABEL[m]}</div>`;
    opt.addEventListener('click', () => selectMode(m));
    modeGrid.appendChild(opt);
  });
}

function selectMode(m){
  interactionType = 'tap';
  tapCategory = m;
  mode = m;
  modeTabLabel.textContent = MODE_LABEL[m];
  modeTabDot.style.background = MODE_COLOR[m];
  document.querySelectorAll('#modeGrid .prov-opt').forEach(o=>{
    o.classList.toggle('active', o.getAttribute('data-mode') === m);
  });
  closeModePanel();
  exitRecallUI();
  applyDimming();
  updateScores();
  factPanel.style.display = 'none';

  const labelsEligible = (m === 'city' || m === 'landmark' || m === 'headquarters');
  labelsToggleWrap.style.display = labelsEligible ? '' : 'none';
  if(!labelsEligible && labelsOn){
    labelsOn = false;
    labelsSwitch.classList.remove('on');
    refreshShadowLabels();
  }

  lastAsked = null;
  pickNext();
}

function buildRecallModeUI(){
  ['district','city','landmark','headquarters'].forEach(m => {
    const opt = document.createElement('div');
    opt.className = 'prov-opt' + (m===recallCategory ? ' active' : '');
    opt.setAttribute('data-mode', m);
    opt.innerHTML = `<div class="sw" style="background:${MODE_COLOR[m]}"></div><div>${MODE_LABEL[m]}</div>`;
    opt.addEventListener('click', () => selectRecallMode(m));
    recallGrid.appendChild(opt);
  });
}

function selectRecallMode(m){
  interactionType = 'recall';
  recallCategory = m;
  mode = m;
  recallTabLabel.textContent = MODE_LABEL[m];
  recallTabDot.style.background = MODE_COLOR[m];
  document.querySelectorAll('#recallGrid .prov-opt').forEach(o=>{
    o.classList.toggle('active', o.getAttribute('data-mode') === m);
  });
  closeRecallDropdown();
  enterRecallUI();
  applyDimming();
  updateScores();
  factPanel.style.display = 'none';

  const labelsEligible = (m === 'city' || m === 'landmark' || m === 'headquarters');
  labelsToggleWrap.style.display = labelsEligible ? '' : 'none';
  if(!labelsEligible && labelsOn){
    labelsOn = false;
    labelsSwitch.classList.remove('on');
    refreshShadowLabels();
  }

  lastAsked = null;
  pickNext();
  recallInput.focus();
}

function enterRecallUI(){
  recallPanel.classList.add('show');
}
function exitRecallUI(){
  recallPanel.classList.remove('show');
  clearRecallGlow();
  recallInput.value = '';
  recallSuggestions.innerHTML = '';
}
function clearRecallGlow(){
  svg.querySelectorAll('.recall-glow').forEach(el => el.classList.remove('recall-glow'));
}

function toggleRecallDropdown(){
  const isOpen = recallDropdown.classList.toggle('open');
  recallTab.classList.toggle('open', isOpen);
  if(isOpen){ closeModePanel(); closePanel(); }
}
function closeRecallDropdown(){
  recallDropdown.classList.remove('open');
  recallTab.classList.remove('open');
}
recallTab.addEventListener('click', toggleRecallDropdown);

function expectedRecallAnswer(){
  if(mode === 'headquarters' && DISTRICT_FACTS[currentTarget]){
    return coreName(DISTRICT_FACTS[currentTarget][0]);
  }
  return currentTarget;
}

function recallPool(){
  if(mode === 'headquarters'){
    return Object.values(DISTRICT_FACTS).map(f => coreName(f[0]));
  }
  return currentItemSet().map(x => x.name);
}

function submitRecall(typedRaw){
  if(recallLocked || interactionType !== 'recall') return;
  const typed = (typedRaw || '').trim();
  if(!typed) return;

  recallLocked = true;
  recallInput.disabled = true;
  recallCheckBtn.disabled = true;
  recallSuggestions.innerHTML = '';

  const expected = expectedRecallAnswer();
  const key = scopeKey();
  ensureScopeState(key);
  const isCorrect = typed.toLowerCase() === expected.toLowerCase();

  if(mode !== 'headquarters'){
    const el = elementFor(currentTarget);
    if(el){ el.classList.remove('recall-glow'); el.classList.add('correct'); }
  }

  if(isCorrect){
    feedbackEl.textContent = 'Correct — ' + expected;
    feedbackEl.className = 'feedback ok';
    playCorrect();
    streaks[key]++;
    showReaction('correct', streaks[key]);
    if(streaks[key] > bests[key]){
      bests[key] = streaks[key];
      saveBest(key, bests[key]);
      showToast('New best (' + MODE_LABEL[mode] + ' · ' + PROV_LABEL[scope] + '): ' + bests[key]);
    }
  } else {
    feedbackEl.textContent = 'You typed "' + typed + '" — correct: ' + expected;
    feedbackEl.className = 'feedback bad';
    playWrong();
    showReaction('wrong', null);
    streaks[key] = 0;
  }

  appearedCounts[appearedKey(currentTarget)] = (appearedCounts[appearedKey(currentTarget)] || 0) + 1;
  updateScores();
  refreshShadowLabels();
  showFactPanel(currentTarget);

  setTimeout(() => {
    recallLocked = false;
    recallInput.disabled = false;
    recallCheckBtn.disabled = false;
    pickNext();
    recallInput.focus();
  }, 1200);
}

recallInput.addEventListener('input', () => {
  const val = recallInput.value.trim().toLowerCase();
  recallSuggestions.innerHTML = '';
  if(!val) return;
  const pool = recallPool();
  const seen = new Set();
  const matches = [];
  for(const n of pool){
    if(n.toLowerCase().startsWith(val) && !seen.has(n)){
      seen.add(n);
      matches.push(n);
      if(matches.length >= 6) break;
    }
  }
  matches.forEach(name => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'recall-chip';
    chip.textContent = name;
    chip.addEventListener('click', () => {
      recallInput.value = name;
      submitRecall(name);
    });
    recallSuggestions.appendChild(chip);
  });
});
recallInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter'){
    e.preventDefault();
    submitRecall(recallInput.value);
  }
});
recallCheckBtn.addEventListener('click', () => submitRecall(recallInput.value));

function escapeAttr(s){
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}

// ---- Search ----
let searchTimer = null;
let currentSearchMatch = null;

function clearSearchHighlight(){
  if(currentSearchMatch){
    const el = elementFor(currentSearchMatch);
    if(el) el.classList.remove('searched');
    currentSearchMatch = null;
  }
}

function runSearch(){
  const raw = searchInput.value.trim();
  const q = raw.toLowerCase();
  clearSearchHighlight();
  if(searchTimer) clearTimeout(searchTimer);

  if(!q){
    searchMsg.textContent = '';
    searchMsg.className = 'search-msg';
    return;
  }

  const set = currentItemSet();
  const match =
    set.find(d => d.name.toLowerCase() === q) ||
    set.find(d => d.name.toLowerCase().startsWith(q)) ||
    set.find(d => d.name.toLowerCase().includes(q));

  if(match){
    const el = elementFor(match.name);
    el.classList.add('searched');
    currentSearchMatch = match.name;
    searchMsg.textContent = 'Found: ' + match.name;
    searchMsg.className = 'search-msg';
  } else {
    searchMsg.textContent = 'No ' + MODE_LABEL[mode].toLowerCase().slice(0,-1) + ' matches "' + raw + '"';
    searchMsg.className = 'search-msg err';
  }
}
searchInput.addEventListener('input', runSearch);

function togglePanel(){
  const isOpen = provPanel.classList.toggle('open');
  provTab.classList.toggle('open', isOpen);
  if(isOpen){ closeModePanel(); closeRecallDropdown(); }
}
function closePanel(){
  provPanel.classList.remove('open');
  provTab.classList.remove('open');
}
provTab.addEventListener('click', togglePanel);

function toggleModePanel(){
  const isOpen = modePanel.classList.toggle('open');
  modeTab.classList.toggle('open', isOpen);
  if(isOpen){ closePanel(); closeRecallDropdown(); }
}
function closeModePanel(){
  modePanel.classList.remove('open');
  modeTab.classList.remove('open');
}
modeTab.addEventListener('click', toggleModePanel);

shadowSwitch.addEventListener('click', () => {
  shadowOn = !shadowOn;
  shadowSwitch.classList.toggle('on', shadowOn);
  refreshShadowLabels();
});

infoSwitch.addEventListener('click', () => {
  infoOn = !infoOn;
  infoSwitch.classList.toggle('on', infoOn);
  if(!infoOn) factPanel.style.display = 'none';
});

labelsSwitch.addEventListener('click', () => {
  labelsOn = !labelsOn;
  labelsSwitch.classList.toggle('on', labelsOn);
  refreshShadowLabels();
});

searchIconBtn.addEventListener('click', () => {
  const isOpen = searchWrap.classList.toggle('open');
  searchIconBtn.classList.toggle('active', isOpen);
  if(isOpen){
    searchInput.focus();
  } else {
    searchInput.value = '';
    runSearch();
  }
});

muteBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  muteBtn.textContent = soundOn ? 'SOUND ON' : 'SOUND OFF';
  muteBtn.classList.toggle('active', soundOn);
  if(soundOn) ensureAudio();
});

// ---- Persistence ----
const ALL_MODES = ['district','city','landmark','headquarters'];
function allScopeKeys(){
  const keys = [];
  ALL_MODES.forEach(m => { for(let p=0;p<=7;p++) keys.push(m+':'+p); });
  return keys;
}
async function loadBests(){
  for(const key of allScopeKeys()){
    try{
      const res = await storage.get('nepal-quiz-best-' + key);
      if(res && res.value) bests[key] = parseInt(res.value,10) || 0;
    }catch(e){ /* no saved value yet */ }
  }
  updateScores();
}
async function saveBest(key, val){
  try{
    await storage.set('nepal-quiz-best-' + key, String(val));
  }catch(e){ /* ignore */ }
}

// ---- Local storage shim (matches the get/set shape the app expects) ----
const storage = {
  async get(key){
    const v = localStorage.getItem(key);
    return v === null ? null : { key, value: v };
  },
  async set(key, value){
    localStorage.setItem(key, value);
    return { key, value };
  }
};

// ---- Data loading ----
async function loadData(){
  const [districtsData, provinceData, citiesData, landmarksData, factsData] = await Promise.all([
    fetch('districts.json').then(r => r.json()),
    fetch('provinces.json').then(r => r.json()),
    fetch('cities.json').then(r => r.json()),
    fetch('landmarks.json').then(r => r.json()),
    fetch('facts.json').then(r => r.json()),
  ]);
  DATA = districtsData;
  PROVINCE_OF = provinceData;
  CITIES = citiesData;
  LANDMARKS = landmarksData;
  DISTRICT_FACTS = factsData;
}

function showFactPanel(name){
  if(!infoOn || (mode !== 'district' && mode !== 'headquarters') || !DISTRICT_FACTS[name]){
    factPanel.style.display = 'none';
    return;
  }
  const [hq, pop, area, fact] = DISTRICT_FACTS[name];
  factDistrict.textContent = name;
  factHq.textContent = 'HQ: ' + hq;
  factPop.textContent = pop.toLocaleString() + ' people';
  factArea.textContent = area.toLocaleString() + ' km²';
  factText.textContent = fact;
  factPanel.style.display = '';
}

// ---- Map pinch-zoom / pan via native SVG viewBox (stays vector-crisp at any zoom — no raster upscaling) ----
let baseVB = { x:0, y:0, w:1000, h:572 }; // set from DATA.viewBox once loaded
let vb = { x:0, y:0, w:1000, h:572 };     // current visible viewBox window
const MIN_SCALE = 1, MAX_SCALE = 6;

function initViewBox(){
  const parts = DATA.viewBox.split(' ').map(Number);
  baseVB = { x:parts[0], y:parts[1], w:parts[2], h:parts[3] };
  vb = { ...baseVB };
  applyViewBox();
}
function applyViewBox(){
  svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
}
function currentScale(){
  return baseVB.w / vb.w;
}

function clampViewBox(){
  vb.w = Math.min(baseVB.w, Math.max(baseVB.w / MAX_SCALE, vb.w));
  vb.h = Math.min(baseVB.h, Math.max(baseVB.h / MAX_SCALE, vb.h));
  vb.x = Math.min(baseVB.x + (baseVB.w - vb.w), Math.max(baseVB.x, vb.x));
  vb.y = Math.min(baseVB.y + (baseVB.h - vb.h), Math.max(baseVB.y, vb.y));
}

function resetMapZoom(){
  vb = { ...baseVB };
  applyViewBox();
}
zoomResetBtn.addEventListener('click', resetMapZoom);

// Convert a screen point (relative to the viewport element) into map content coordinates
function screenToContent(relX, relY){
  const rect = mapViewport.getBoundingClientRect();
  return {
    x: vb.x + (relX / rect.width) * vb.w,
    y: vb.y + (relY / rect.height) * vb.h
  };
}

const activePointers = new Map();
let pinchStartDist = 0;
let pinchStartScale = 1;
let panStart = null; // { screenX, screenY, vbX, vbY }

function dist(p1, p2){
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}
function midpoint(p1, p2){
  return { x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2 };
}

mapViewport.addEventListener('pointerdown', (e) => {
  try{ mapViewport.setPointerCapture(e.pointerId); }catch(err){ /* ignore capture failures */ }
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if(activePointers.size === 2){
    const pts = [...activePointers.values()];
    pinchStartDist = dist(pts[0], pts[1]);
    pinchStartScale = currentScale();
  } else if(activePointers.size === 1){
    panStart = { screenX: e.clientX, screenY: e.clientY, vbX: vb.x, vbY: vb.y };
  }
});

mapViewport.addEventListener('pointermove', (e) => {
  if(!activePointers.has(e.pointerId)) return;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if(activePointers.size === 2){
    const pts = [...activePointers.values()];
    const newDist = dist(pts[0], pts[1]);
    if(pinchStartDist > 0){
      let newScale = pinchStartScale * (newDist / pinchStartDist);
      newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));

      const rect = mapViewport.getBoundingClientRect();
      const mid = midpoint(pts[0], pts[1]);
      const midRelX = mid.x - rect.left;
      const midRelY = mid.y - rect.top;

      // Keep the map point under the fingers fixed while the viewBox window resizes
      const content = screenToContent(midRelX, midRelY);
      vb.w = baseVB.w / newScale;
      vb.h = baseVB.h / newScale;
      vb.x = content.x - (midRelX / rect.width) * vb.w;
      vb.y = content.y - (midRelY / rect.height) * vb.h;

      clampViewBox();
      applyViewBox();
    }
  } else if(activePointers.size === 1 && panStart && currentScale() > 1){
    const rect = mapViewport.getBoundingClientRect();
    const dxScreen = e.clientX - panStart.screenX;
    const dyScreen = e.clientY - panStart.screenY;
    vb.x = panStart.vbX - (dxScreen / rect.width) * vb.w;
    vb.y = panStart.vbY - (dyScreen / rect.height) * vb.h;
    clampViewBox();
    applyViewBox();
  }
});

function endPointer(e){
  activePointers.delete(e.pointerId);
  if(activePointers.size < 2) pinchStartDist = 0;
  if(activePointers.size === 1){
    // A pinch just ended with one finger lifted first (the normal way people release a pinch).
    // Re-anchor the pan reference to the CURRENT zoomed viewBox and the surviving finger's
    // current position — otherwise it snaps back to wherever that finger was before the zoom.
    const remaining = [...activePointers.values()][0];
    panStart = { screenX: remaining.x, screenY: remaining.y, vbX: vb.x, vbY: vb.y };
  } else if(activePointers.size === 0){
    panStart = null;
  }
}
mapViewport.addEventListener('pointerup', endPointer);
mapViewport.addEventListener('pointercancel', endPointer);
mapViewport.addEventListener('pointerleave', endPointer);

// Desktop scroll-wheel zoom, centered on cursor position
mapViewport.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = e.deltaY < 0 ? 1.1 : 0.9;
  let newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, currentScale() * delta));

  const rect = mapViewport.getBoundingClientRect();
  const cursorX = e.clientX - rect.left;
  const cursorY = e.clientY - rect.top;
  const content = screenToContent(cursorX, cursorY);

  vb.w = baseVB.w / newScale;
  vb.h = baseVB.h / newScale;
  vb.x = content.x - (cursorX / rect.width) * vb.w;
  vb.y = content.y - (cursorY / rect.height) * vb.h;

  clampViewBox();
  applyViewBox();
}, { passive:false });

// ---- Init ----
(async function init(){
  await loadData();
  buildMap();
  initViewBox();
  buildModeUI();
  buildRecallModeUI();
  buildProvinceUI();
  applyDimming();
  await loadBests();
  pickNext();
})();
