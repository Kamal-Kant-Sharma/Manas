// Web Speech API wrapper — offline, no external calls.
// Provides `speak(text, opts)` and voice discovery.

let cachedVoices = null;

export function getVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  if (cachedVoices && cachedVoices.length) return cachedVoices;
  cachedVoices = window.speechSynthesis.getVoices();
  return cachedVoices;
}

// Some browsers load voices async
if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

export function speak(text, { rate = 1, pitch = 1, volume = 1, voiceName = null } = {}) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel(); // never overlap
    const u = new SpeechSynthesisUtterance(String(text));
    u.rate = rate;
    u.pitch = pitch;
    u.volume = volume;
    const voices = getVoices();
    if (voiceName) {
      const v = voices.find((x) => x.name === voiceName);
      if (v) u.voice = v;
    }
    window.speechSynthesis.speak(u);
  } catch (e) {
    console.warn("speak failed", e);
  }
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

// Simple beep tone via WebAudio — used for feedback / metronome
let _ctx = null;
function ctx() {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    _ctx = AC ? new AC() : null;
  }
  return _ctx;
}

export function beep({ freq = 660, duration = 80, volume = 0.15 } = {}) {
  const c = ctx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration / 1000);
}
