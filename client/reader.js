export async function api(action, body, signal) {
  const send = globalThis.__DSH_TRANSPORT__?.fetch ?? fetch;
  const res = await send(`api/dsh-reply-reader/${action}`, {method: body ? 'POST' : 'GET', cache: 'no-store', signal, ...(body && {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})});
  if (!res.ok) {
    const failure = await res.json().catch(() => ({}));
    throw Object.assign(new Error(failure.error || `无法访问插件服务（HTTP ${res.status}）`), {setup: !!failure.setup});
  }
  return action === 'speech' ? res.blob() : res.json();
}

export function findText(nodes, messageId) {
  const closing = nodes.values().find(node => node.kind === 'turn-tail' && node.data.closing?.finalNode.messageId === messageId)?.data.closing;
  return closing?.blocks.filter(block => block.kind === 'text').map(block => block.text).join('') || '';
}

export function resultMount(button) {
  const tail = button?.closest('[data-turn-tail]');
  return tail?.querySelector('[data-drr-result-seat]') ?? tail;
}

const empty = Object.freeze({});
export class Reader {
  rows = new Map();
  listeners = new Map();
  pending = new Map();
  playing = null;
  constructor(request = api) { this.request = request; }
  get(key) { return this.rows.get(key) || empty; }
  subscribe(key, notify) {
    const set = this.listeners.get(key) || new Set();
    this.listeners.set(key, set.add(notify));
    return () => { set.delete(notify); if (!set.size) this.listeners.delete(key); };
  }
  update(key, patch) {
    this.rows.set(key, {...this.get(key), ...patch});
    for (const notify of this.listeners.get(key) || []) notify();
  }
  stop() {
    const player = this.playing;
    if (!player) return;
    this.playing = null;
    player.controller.abort();
    if (player.audio) { player.audio.onended = null; player.audio.onerror = null; player.audio.pause(); }
    if (player.url) URL.revokeObjectURL(player.url);
    this.update(player.key, {speaking: false});
  }
  async speak(key, getText) {
    const same = this.playing?.key === key;
    this.stop();
    if (same) return;
    const player = {key, controller: new AbortController()};
    this.playing = player;
    this.update(key, {speaking: true, error: null});
    try {
      const blob = await this.request('speech', {text: getText()}, player.controller.signal);
      if (this.playing !== player) return;
      player.url = URL.createObjectURL(blob);
      player.audio = new Audio(player.url);
      player.audio.onended = () => { if (this.playing === player) this.stop(); };
      player.audio.onerror = () => {
        if (this.playing !== player) return;
        this.stop(); this.update(key, {error: '此音频无法播放，请检查朗读服务的输出格式。', setup: true});
      };
      await player.audio.play();
    } catch (error) {
      if (this.playing !== player) return;
      this.stop(); this.update(key, {error: error.message, setup: error.setup});
    }
  }
  async translate(key, getText) {
    const pending = this.pending.get(key);
    if (pending) { pending.abort(); this.pending.delete(key); this.update(key, {loading: false}); return; }
    if (this.get(key).translation) { this.update(key, {translation: '', error: null}); return; }
    const controller = new AbortController();
    this.pending.set(key, controller); this.update(key, {loading: true, error: null});
    try {
      const result = await this.request('translate', {text: getText()}, controller.signal);
      if (!controller.signal.aborted) this.update(key, {translation: result.text});
    } catch (error) {
      if (!controller.signal.aborted) this.update(key, {error: error.message, setup: error.setup});
    } finally {
      if (this.pending.get(key) === controller) { this.pending.delete(key); this.update(key, {loading: false}); }
    }
  }
  clear(key) {
    if (this.playing?.key === key) this.stop();
    this.pending.get(key)?.abort(); this.pending.delete(key); this.rows.delete(key);
  }
  dispose() { this.stop(); for (const task of this.pending.values()) task.abort(); this.pending.clear(); this.rows.clear(); this.listeners.clear(); }
}
