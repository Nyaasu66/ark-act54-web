// 相对于动画起点的秒数；两条音轨独立调度，允许重叠。
export const LOAD_SOUND_START_SECONDS = 0;
export const INTRO_MUSIC_START_SECONDS = 1;
export const AUDIO_TRACKS = [
  { url: "./assets/audio/act54side_g_ui_load.m4a", start: LOAD_SOUND_START_SECONDS },
  { url: "./assets/audio/m_sys_act54side_intro.m4a", start: INTRO_MUSIC_START_SECONDS },
];
export const AUDIO_PREFERENCE_KEY = "act54side.audio-enabled";

export class AudioTimeline {
  constructor({ tracks = AUDIO_TRACKS, createContext = () => new AudioContext(),
    fetchAudio = (url) => fetch(url), now = () => performance.now() / 1000,
    onChange = () => {} } = {}) {
    Object.assign(this, { tracks, createContext, fetchAudio, now, onChange });
    this.enabled = false;
    this.active = false;
    this.position = 0;
    this.sources = [];
  }

  get time() {
    return this.active ? this.position + this.now() - this.startedAt : this.position;
  }

  get audible() {
    return this.enabled && this.context?.state === "running";
  }

  get playing() {
    return this.active && this.audible && !this.error &&
      (!this.buffers || (this.sources.length > 0 &&
        this.tracks.some((track, i) => this.time < track.start + this.buffers[i].duration)));
  }

  enable() {
    this.enabled = true;
    this.error = null;
    try {
      if (!this.context) {
        this.context = this.createContext();
        this.context.addEventListener("statechange", () => {
          this.schedule();
          this.onChange();
        });
      }
      // 必须在点击事件中直接调用；刷新时浏览器仍可阻止恢复。
      this.context.resume().then(() => {
        this.schedule();
        this.onChange();
      }).catch(() => this.onChange());
      if (!this.loading) {
        this.loading = Promise.all(this.tracks.map(async (track) => {
          const response = await this.fetchAudio(track.url);
          if (!response.ok) throw new Error(`音频加载失败：${track.url}`);
          return this.context.decodeAudioData(await response.arrayBuffer());
        })).then((buffers) => {
          this.buffers = buffers;
          this.schedule();
        }).catch((error) => {
          this.error = error;
          this.loading = null;
        }).finally(() => this.onChange());
      }
    } catch (error) {
      this.error = error;
    }
    this.schedule();
    this.onChange();
  }

  disable() {
    this.enabled = false;
    this.stopSources();
    this.onChange();
  }

  stopSources() {
    for (const source of this.sources) {
      source.onended = null;
      source.stop();
      source.disconnect();
    }
    this.sources = [];
  }

  schedule() {
    this.stopSources();
    if (!this.active || !this.audible || !this.buffers) return;
    const time = this.time;
    this.tracks.forEach((track, i) => {
      const offset = Math.max(0, time - track.start);
      if (offset >= this.buffers[i].duration) return;
      const source = this.context.createBufferSource();
      source.buffer = this.buffers[i];
      source.connect(this.context.destination);
      source.onended = () => {
        this.sources = this.sources.filter((item) => item !== source);
        source.disconnect();
        this.onChange();
      };
      this.sources.push(source);
      source.start(this.context.currentTime + Math.max(0, track.start - time), offset);
    });
  }

  play(time) {
    this.position = time;
    this.startedAt = this.now();
    this.active = true;
    this.schedule();
    this.onChange();
  }

  pause() {
    this.position = this.time;
    this.active = false;
    this.stopSources();
    this.onChange();
  }

  seek(time) {
    this.pause();
    this.position = time;
  }
}
