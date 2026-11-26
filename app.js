// ==================== 1. STATE & STORAGE ====================
let userName = localStorage.getItem('nedia_user_name') || '';
let alarms = JSON.parse(localStorage.getItem('nedia_alarms_v2')) || [];
let uploadedAudioDataUrl = localStorage.getItem('nedia_custom_audio') || null;
let uploadedAudioName = localStorage.getItem('nedia_custom_audio_name') || '';
let activeRingingAlarmId = null;
let audioLoopTimer = null;
let customAudioPlayer = null;
let audioCtx = null;

// ==================== 2. DOM ELEMENTS ====================
const onboardingScreen = document.getElementById('onboarding-screen');
const mainApp = document.getElementById('main-app');
const registerNameInput = document.getElementById('register-name-input');
const saveNameBtn = document.getElementById('save-name-btn');
const userGreeting = document.getElementById('user-greeting');
const liveClock = document.getElementById('live-clock');

const hourInput = document.getElementById('alarm-hour');
const minuteInput = document.getElementById('alarm-minute');
const countdownPreview = document.getElementById('countdown-preview');
const alarmLabelInput = document.getElementById('alarm-label');
const soundSelect = document.getElementById('sound-select');
const customUploadBox = document.getElementById('custom-upload-box');
const customAudioFile = document.getElementById('custom-audio-file');
const uploadedFileNameSpan = document.getElementById('uploaded-file-name');
const previewSoundBtn = document.getElementById('preview-sound-btn');
const addAlarmBtn = document.getElementById('add-alarm-btn');
const alarmsListEl = document.getElementById('alarms-list');
const clearAllAlarmsBtn = document.getElementById('clear-all-alarms-btn');

const eveningBanner = document.getElementById('evening-reminder-banner');
const persuasiveText = document.getElementById('persuasive-text');
const dismissReminderBtn = document.getElementById('dismiss-reminder-btn');

const ringingModal = document.getElementById('ringing-modal');
const ringingTimeDisplay = document.getElementById('ringing-time-display');
const ringingLabelDisplay = document.getElementById('ringing-label-display');
const targetNameHint = document.getElementById('target-name-hint');
const dismissNameInput = document.getElementById('dismiss-name-input');
const dismissError = document.getElementById('dismiss-error');
const stopAlarmBtn = document.getElementById('stop-alarm-btn');

// ==================== 3. ONBOARDING & NAME REGISTRATION ====================
function initApp() {
  if (userName.trim()) {
    onboardingScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    updateUserDisplays();
  }
  if (uploadedAudioName) {
    uploadedFileNameSpan.textContent = `Saved: ${uploadedAudioName}`;
  }
  renderAlarms();
  checkEveningReminder();
}

function updateUserDisplays() {
  userGreeting.textContent = `Hey, ${userName}! 👋`;
  document.getElementById('update-name-input').value = userName;
}

saveNameBtn.addEventListener('click', () => {
  const val = registerNameInput.value.trim();
  if (!val) {
    alert('Please enter your name so you can unlock your alarms later! 😊');
    return;
  }
  userName = val;
  localStorage.setItem('nedia_user_name', userName);
  onboardingScreen.classList.add('hidden');
  mainApp.classList.remove('hidden');
  updateUserDisplays();
  requestNotificationPermission();
});

document.getElementById('update-name-btn').addEventListener('click', () => {
  const newName = document.getElementById('update-name-input').value.trim();
  if (!newName) return alert('Name cannot be empty!');
  userName = newName;
  localStorage.setItem('nedia_user_name', userName);
  updateUserDisplays();
  alert('Registered wake-up name updated! ✅');
});

// ==================== 4. PAGE NAVIGATION ====================
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.target).classList.add('active-page');
  });
});

// ==================== 5. DIGITAL TIME INPUT & COUNTDOWN CALCULATION ====================
function calculateTimeUntil(hour, minute) {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);

  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  const diffMs = target - now;
  const diffMinsTotal = Math.ceil(diffMs / 60000);
  const hrs = Math.floor(diffMinsTotal / 60);
  const mins = diffMinsTotal % 60;

  return { hrs, mins };
}

function updateCountdownPreview() {
  const h = parseInt(hourInput.value, 10);
  const m = parseInt(minuteInput.value, 10);

  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    countdownPreview.textContent = '⏳ Enter valid hours (00-23) and minutes (00-59)';
    return;
  }

  const { hrs, mins } = calculateTimeUntil(h, m);
  countdownPreview.textContent = `⏳ Alarm will ring in ${hrs} hour${hrs !== 1 ? 's' : ''} and ${mins} minute${mins !== 1 ? 's' : ''}`;
}

hourInput.addEventListener('input', () => {
  if (hourInput.value.length > 2) hourInput.value = hourInput.value.slice(0, 2);
  updateCountdownPreview();
});

minuteInput.addEventListener('input', () => {
  if (minuteInput.value.length > 2) minuteInput.value = minuteInput.value.slice(0, 2);
  updateCountdownPreview();
});

// ==================== 6. BUILT-IN & UPLOADED AUDIO ENGINE ====================
soundSelect.addEventListener('change', () => {
  if (soundSelect.value === 'custom') {
    customUploadBox.classList.remove('hidden');
  } else {
    customUploadBox.classList.add('hidden');
  }
});

customAudioFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 4 * 1024 * 1024) {
    alert('Please select an audio file under 4MB so it saves cleanly to your device storage!');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    uploadedAudioDataUrl = evt.target.result;
    uploadedAudioName = file.name;
    localStorage.setItem('nedia_custom_audio', uploadedAudioDataUrl);
    localStorage.setItem('nedia_custom_audio_name', uploadedAudioName);
    uploadedFileNameSpan.textContent = `✅ Ready: ${file.name}`;
  };
  reader.readAsDataURL(file);
});

function playBuiltInTone(type) {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  if (type === 'builtin-chime') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.2); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.4); // G5
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
    osc.start(now);
    osc.stop(now + 0.8);
  } else if (type === 'builtin-digital') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.setValueAtTime(0, now + 0.15);
    gain.gain.setValueAtTime(0.25, now + 0.25);
    gain.gain.setValueAtTime(0, now + 0.4);
    osc.start(now);
    osc.stop(now + 0.45);
  } else {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(432, now);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc.start(now);
    osc.stop(now + 1.2);
  }
}

function startAlarmSound(soundType) {
  stopAlarmSound();
  if (soundType === 'custom' && uploadedAudioDataUrl) {
    customAudioPlayer = new Audio(uploadedAudioDataUrl);
    customAudioPlayer.loop = true;
    customAudioPlayer.play().catch(() => playBuiltInTone('builtin-chime'));
  } else {
    playBuiltInTone(soundType);
    audioLoopTimer = setInterval(() => playBuiltInTone(soundType), 1300);
  }
}

function stopAlarmSound() {
  if (audioLoopTimer) {
    clearInterval(audioLoopTimer);
    audioLoopTimer = null;
  }
  if (customAudioPlayer) {
    customAudioPlayer.pause();
    customAudioPlayer.currentTime = 0;
    customAudioPlayer = null;
  }
}

previewSoundBtn.addEventListener('click', () => {
  const chosen = soundSelect.value;
  if (chosen === 'custom' && uploadedAudioDataUrl) {
    const temp = new Audio(uploadedAudioDataUrl);
    temp.play();
    setTimeout(() => temp.pause(), 3000);
  } else {
    playBuiltInTone(chosen);
  }
});

// ==================== 7. SAVE, RENDER & MANAGE ALARMS ====================
function saveAlarms() {
  localStorage.setItem('nedia_alarms_v2', JSON.stringify(alarms));
  renderAlarms();
  checkEveningReminder();
}

addAlarmBtn.addEventListener('click', () => {
  const h = parseInt(hourInput.value, 10);
  const m = parseInt(minuteInput.value, 10);

  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    alert('Please enter a valid hour (00-23) and minute (00-59)! ⏰');
    return;
  }

  const formattedTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const { hrs, mins } = calculateTimeUntil(h, m);

  const newAlarm = {
    id: Date.now(),
    hour: h,
    minute: m,
    timeStr: formattedTime,
    label: alarmLabelInput.value.trim() || 'Wake Up Alarm ☀️',
    sound: soundSelect.value,
    enabled: true
  };

  alarms.push(newAlarm);
  saveAlarms();

  alert(`✅ Alarm set for ${formattedTime}!\n⏳ Rings in ${hrs} hour(s) and ${mins} minute(s).`);
  hourInput.value = '';
  minuteInput.value = '';
  alarmLabelInput.value = '';
  countdownPreview.textContent = '⏳ Enter hours and minutes to see time remaining';
});

function renderAlarms() {
  alarmsListEl.innerHTML = '';
  if (alarms.length === 0) {
    alarmsListEl.innerHTML = '<p class="empty-state">No alarms set yet. Add one above! 😴</p>';
    return;
  }

  alarms.forEach(alarm => {
    const { hrs, mins } = calculateTimeUntil(alarm.hour, alarm.minute);
    const div = document.createElement('div');
    div.className = 'alarm-item';
    div.innerHTML = `
      <div class="alarm-info">
        <h4>${alarm.timeStr}</h4>
        <p>${alarm.label} • ${alarm.enabled ? `In ${hrs}h ${mins}m` : 'Off'}</p>
      </div>
      <div class="alarm-actions">
        <button class="toggle-btn ${alarm.enabled ? 'toggle-on' : 'toggle-off'}" onclick="toggleAlarm(${alarm.id})">
          ${alarm.enabled ? 'ON' : 'OFF'}
        </button>
        <button class="delete-item-btn" onclick="deleteAlarm(${alarm.id})">🗑️</button>
      </div>
    `;
    alarmsListEl.appendChild(div);
  });
}

window.toggleAlarm = function(id) {
  alarms = alarms.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
  saveAlarms();
};

window.deleteAlarm = function(id) {
  alarms = alarms.filter(a => a.id !== id);
  saveAlarms();
};

clearAllAlarmsBtn.addEventListener('click', () => {
  if (confirm('Delete all saved alarms?')) {
    alarms = [];
    saveAlarms();
  }
});

// ==================== 8. RINGING & NAME-TO-STOP CHALLENGE ====================
function triggerAlarm(alarm) {
  activeRingingAlarmId = alarm.id;
  ringingTimeDisplay.textContent = alarm.timeStr;
  ringingLabelDisplay.textContent = alarm.label;
  targetNameHint.textContent = userName;
  dismissNameInput.value = '';
  dismissError.classList.add('hidden');
  ringingModal.classList.remove('hidden');

  startAlarmSound(alarm.sound);

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`⏰ Nedia Alarm: ${alarm.timeStr}`, {
      body: `${alarm.label} — Open Nedia and type "${userName}" to stop!`,
      requireInteraction: true
    });
  }
}

stopAlarmBtn.addEventListener('click', () => {
  const typed = dismissNameInput.value.trim().toLowerCase();
  if (typed === userName.trim().toLowerCase()) {
    stopAlarmSound();
    ringingModal.classList.add('hidden');
    alarms = alarms.map(a => a.id === activeRingingAlarmId ? { ...a, enabled: false } : a);
    activeRingingAlarmId = null;
    saveAlarms();
  } else {
    dismissError.classList.remove('hidden');
  }
});

// ==================== 9. 7:00 PM PERSUASIVE REMINDERS ====================
const persuasiveQuotes = [
  "Great mornings start the night before! Set your alarm now so you wake up ahead of the crowd. 🌟",
  "Don't leave tomorrow to chance—lock in your wake-up time now and sleep peacefully! 😴✨",
  "Champions prepare ahead. Take 5 seconds to set your morning alarm right now! 🏆⏰"
];

let reminderDismissedToday = false;

function checkEveningReminder() {
  const now = new Date();
  const hasEnabledAlarm = alarms.some(a => a.enabled);

  if (now.getHours() >= 19 && !hasEnabledAlarm && !reminderDismissedToday) {
    const quote = persuasiveQuotes[now.getDate() % persuasiveQuotes.length];
    persuasiveText.textContent = `Hey ${userName || 'friend'}! ${quote}`;
    eveningBanner.classList.remove('hidden');

    const todayKey = `nedia_reminded_${now.toDateString()}`;
    if (!localStorage.getItem(todayKey) && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('🌙 Did you forget your alarm?', {
        body: `${userName}, it's 7:00 PM! Set your alarm now so tomorrow starts strong.`
      });
      localStorage.setItem(todayKey, 'true');
    }
  } else {
    eveningBanner.classList.add('hidden');
  }
}

dismissReminderBtn.addEventListener('click', () => {
  reminderDismissedToday = true;
  eveningBanner.classList.add('hidden');
});

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission();
  }
}

document.getElementById('enable-notif-btn').addEventListener('click', () => {
  if (!('Notification' in window)) {
    alert('Notifications are not supported in this browser.');
    return;
  }
  Notification.requestPermission().then(perm => {
    alert(perm === 'granted' ? '✅ Notifications enabled!' : '⚠️ Permission denied in browser settings.');
  });
});

// ==================== 10. MASTER CLOCK LOOP ====================
setInterval(() => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  liveClock.textContent = `${hh}:${mm}:${ss}`;

  if (now.getSeconds() === 0) {
    checkEveningReminder();
    alarms.forEach(alarm => {
      if (alarm.enabled && alarm.hour === now.getHours() && alarm.minute === now.getMinutes() && !activeRingingAlarmId) {
        triggerAlarm(alarm);
      }
    });
  }
}, 1000);

// ==================== 11. STUDY STOPWATCH ====================
let swStartTime = 0;
let swElapsed = 0;
let swInterval = null;
let laps = [];

const swDisplay = document.getElementById('stopwatch-display');
const swMsDisplay = document.getElementById('stopwatch-ms');
const swStartBtn = document.getElementById('sw-start-btn');
const swLapBtn = document.getElementById('sw-lap-btn');
const swResetBtn = document.getElementById('sw-reset-btn');
const lapsList = document.getElementById('laps-list');
const lapCount = document.getElementById('lap-count');

function formatStopwatch(ms) {
  const totalSec = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const centis = Math.floor((ms % 1000) / 10);
  return {
    main: `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
    ms: `.${String(centis).padStart(2, '0')}`
  };
}

swStartBtn.addEventListener('click', () => {
  if (!swInterval) {
    swStartTime = Date.now() - swElapsed;
    swInterval = setInterval(() => {
      swElapsed = Date.now() - swStartTime;
      const formatted = formatStopwatch(swElapsed);
      swDisplay.textContent = formatted.main;
      swMsDisplay.textContent = formatted.ms;
    }, 30);
    swStartBtn.textContent = '⏸️ Pause';
    swLapBtn.disabled = false;
  } else {
    clearInterval(swInterval);
    swInterval = null;
    swStartBtn.textContent = '▶️ Resume';
  }
});

swLapBtn.addEventListener('click', () => {
  if (!swElapsed) return;
  const formatted = formatStopwatch(swElapsed);
  laps.unshift(`Lap ${laps.length + 1} — ${formatted.main}${formatted.ms}`);
  lapCount.textContent = `${laps.length} Lap${laps.length !== 1 ? 's' : ''}`;
  lapsList.innerHTML = laps.map(l => `<li><span>📖 ${l}</span><span>✅</span></li>`).join('');
});

swResetBtn.addEventListener('click', () => {
  clearInterval(swInterval);
  swInterval = null;
  swElapsed = 0;
  laps = [];
  swDisplay.textContent = '00:00:00';
  swMsDisplay.textContent = '.00';
  swStartBtn.textContent = '▶️ Start';
  swLapBtn.disabled = true;
  lapCount.textContent = '0 Laps';
  lapsList.innerHTML = '<li class="empty-state">No laps recorded yet. Start studying! 🧠</li>';
});

// ==================== 12. SERVICE WORKER & PWA INSTALL ====================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW error:', err));
  });
}

let deferredInstallPrompt = null;
const installAppBtn = document.getElementById('install-app-btn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  installAppBtn.classList.remove('hidden');
});

installAppBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    installAppBtn.classList.add('hidden');
  }
  deferredInstallPrompt = null;
});

initApp();
