import test from "node:test";
import assert from "node:assert/strict";
import { AudioTimeline, AUDIO_TRACKS } from "../audio-timeline.js";

function fixture(state = "running") {
  let clock = 0;
  const starts = [];
  let requests = 0;
  let contexts = 0;
  const context = {
    state, currentTime: 100, destination: {},
    addEventListener() {}, resume: () => Promise.resolve(),
    decodeAudioData: async (bytes) => ({ duration: bytes.duration }),
    createBufferSource() {
      const source = { connect() {}, disconnect() {}, stop() { this.stopped = true; },
        start(when, offset) { starts.push({ source, when, offset }); } };
      return source;
    },
  };
  const audio = new AudioTimeline({
    now: () => clock,
    createContext: () => { contexts++; return context; },
    fetchAudio: async (url) => {
      requests++;
      return { ok: true, arrayBuffer: async () => ({ duration: url.includes("g_ui_load") ? 6.568563 : 11.067937 }) };
    },
  });
  return { audio, starts, context, setClock: (time) => { clock = time; },
    counts: () => ({ requests, contexts }) };
}

test("默认静音不创建上下文、不加载音频；常量对应两条起播时间", () => {
  const f = fixture();
  f.audio.play(0);
  assert.deepEqual(f.counts(), { requests: 0, contexts: 0 });
  assert.deepEqual(AUDIO_TRACKS.map((track) => track.start), [0.5, 1]);
  assert.equal(f.audio.playing, false);
});

test("启用后分别调度 0.5s 和 1s，允许同时播放", async () => {
  const f = fixture();
  f.audio.enable();
  await f.audio.loading;
  f.audio.play(0);
  assert.deepEqual(f.starts.slice(-2).map(({ when, offset }) => [when, offset]), [[100.5, 0], [101, 0]]);
  assert.deepEqual(f.counts(), { requests: 2, contexts: 1 });
});

test("动画结束后仍播放音频，直到最后一段音频结束", async () => {
  const f = fixture();
  f.audio.enable();
  await f.audio.loading;
  f.audio.play(0);
  f.setClock(6.5);
  assert.equal(f.audio.playing, true);
  assert.equal(f.audio.sources.some((source) => source.stopped), false);
  f.setClock(12.08);
  assert.equal(f.audio.playing, false);
});

test("暂停、拖动、重播同步；晚解除静音从对应音频偏移开始", async () => {
  const f = fixture();
  f.audio.play(0);
  f.setClock(3);
  f.audio.enable();
  await f.audio.loading;
  assert.deepEqual(f.starts.slice(-2).map(({ offset }) => offset), [2.5, 2]);
  const sources = [...f.audio.sources];
  f.audio.pause();
  assert.equal(f.audio.time, 3);
  assert.ok(sources.every((source) => source.stopped));
  f.setClock(4);
  assert.equal(f.audio.time, 3);
  f.audio.seek(1.5);
  f.audio.play(1.5);
  assert.deepEqual(f.starts.slice(-2).map(({ offset }) => offset), [1, 0.5]);
  f.audio.play(0);
  assert.deepEqual(f.starts.slice(-2).map(({ when, offset }) => [when, offset]), [[100.5, 0], [101, 0]]);
});

test("浏览器阻止有声自动播放时不启动音轨，点击恢复后同步", async () => {
  const f = fixture("suspended");
  f.audio.enable();
  await f.audio.loading;
  f.audio.play(0);
  assert.equal(f.audio.audible, false);
  assert.equal(f.audio.playing, false);
  assert.equal(f.starts.length, 0);
  f.setClock(2);
  f.context.state = "running";
  f.audio.enable();
  assert.deepEqual(f.starts.slice(-2).map(({ offset }) => offset), [1.5, 1]);
  f.audio.disable();
  assert.equal(f.audio.sources.length, 0);
  assert.equal(f.audio.playing, false);
});

test("所有音轨结束后播放按钮状态可恢复", async () => {
  const f = fixture();
  f.audio.enable();
  await f.audio.loading;
  f.audio.play(0);
  for (const source of [...f.audio.sources]) source.onended();
  assert.equal(f.audio.playing, false);
});
