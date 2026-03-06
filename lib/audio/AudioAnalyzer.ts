export interface AudioSignals {
  level: number;
  presence: number;
  attack: number;
  brightness: number;
  speaking: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, alpha: number) =>
  from + (to - from) * alpha;

export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private previousPresence = 0;
  private smoothedLevel = 0;
  private smoothedPresence = 0;
  private smoothedBrightness = 0;
  private smoothedSpeaking = 0;

  async start() {
    if (this.audioContext) {
      await this.audioContext.resume();
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });

    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) {
      throw new Error("Web Audio API is not available in this browser.");
    }

    this.audioContext = new AudioContextCtor();
    const source = this.audioContext.createMediaStreamSource(stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.68;
    source.connect(this.analyser);
    this.dataArray = new Uint8Array(
      new ArrayBuffer(this.analyser.frequencyBinCount),
    );
  }

  async resume() {
    if (this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  getSignals(): AudioSignals {
    if (!this.analyser || !this.dataArray || !this.audioContext) {
      return { level: 0, presence: 0, attack: 0, brightness: 0, speaking: 0 };
    }

    this.analyser.getByteFrequencyData(this.dataArray);
    const nyquist = this.audioContext.sampleRate / 2;
    const binWidth = nyquist / this.dataArray.length;

    let fullEnergy = 0;
    let speechEnergy = 0;
    let lowMidEnergy = 0;
    let highMidEnergy = 0;

    for (let i = 0; i < this.dataArray.length; i += 1) {
      const frequency = i * binWidth;
      const value = this.dataArray[i] / 255;
      fullEnergy += value;

      if (frequency >= 170 && frequency <= 3600) {
        speechEnergy += value;
      }
      if (frequency >= 170 && frequency <= 900) {
        lowMidEnergy += value;
      }
      if (frequency >= 1200 && frequency <= 4200) {
        highMidEnergy += value;
      }
    }

    const normalizedLevel = clamp01((fullEnergy / this.dataArray.length) * 2.1);
    const normalizedPresence = clamp01(
      (speechEnergy / this.dataArray.length) * 3.2,
    );
    const brightness = clamp01(
      highMidEnergy / Math.max(lowMidEnergy, 0.0001) / 2.2,
    );

    this.smoothedLevel = lerp(this.smoothedLevel, normalizedLevel, 0.18);
    this.smoothedPresence = lerp(
      this.smoothedPresence,
      normalizedPresence,
      0.22,
    );
    this.smoothedBrightness = lerp(this.smoothedBrightness, brightness, 0.14);

    const rawAttack =
      Math.max(0, this.smoothedPresence - this.previousPresence) * 5.5;
    this.previousPresence = this.smoothedPresence;
    const attack = clamp01(rawAttack);

    const speakingTarget = this.smoothedPresence > 0.06 ? 1 : 0;
    this.smoothedSpeaking = lerp(
      this.smoothedSpeaking,
      speakingTarget,
      speakingTarget ? 0.2 : 0.05,
    );

    return {
      level: this.smoothedLevel,
      presence: this.smoothedPresence,
      attack,
      brightness: this.smoothedBrightness,
      speaking: this.smoothedSpeaking,
    };
  }
}
