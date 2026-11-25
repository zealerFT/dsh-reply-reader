import React, {useCallback, useEffect, useRef, useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {Languages, Volume2, Square, X, LoaderCircle} from 'lucide-react';
import {Reader, findText, resultMount} from './reader.js';
import {Settings} from './settings.jsx';
import css from './style.css';

const section = 'reply-reader';
const keyFor = (sessionId, messageId) => JSON.stringify([sessionId, messageId]);
function useRow(reader, key) {
  const subscribe = useCallback(notify => reader.subscribe(key, notify), [reader, key]);
  return useSyncExternalStore(subscribe, () => reader.get(key));
}
function IconButton({label, Icon, active, click, spinning, buttonRef}) {
  return <button ref={buttonRef} type="button" className="drr-icon" onClick={click} aria-pressed={active} aria-label={label} title={label}><Icon aria-hidden="true" className={spinning ? 'drr-spin' : undefined}/></button>;
}
function Actions({reader, openSettings, sessionId, messageId, useChat}) {
  const key = keyFor(sessionId, messageId), row = useRow(reader, key);
  const button = useRef(null);
  const nodes = useChat(snapshot => snapshot.nodes);
  const text = () => findText(nodes, messageId);
  useEffect(() => () => reader.clear(key), [reader, key]);
  const show = row.translation || row.error || row.loading;
  const container = show && resultMount(button.current);
  const result = show ? <Result reader={reader} row={row} rowKey={key} openSettings={openSettings}/> : null;
  return <><IconButton buttonRef={button} label={row.speaking ? '停止朗读' : '朗读原文'} Icon={row.speaking ? Square : Volume2} active={!!row.speaking} click={() => reader.speak(key, text)}/>
    <IconButton label={row.loading ? '取消翻译' : row.translation ? '收起译文' : '翻译'} Icon={row.loading ? LoaderCircle : Languages} spinning={row.loading} active={!!(row.loading || row.translation)} click={() => reader.translate(key, text)}/>{container ? createPortal(result, container) : result}</>;
}
function Result({reader, row, rowKey: key, openSettings}) {
  return <aside className="drr-result" aria-live="polite">
    {row.loading && <span role="status">正在翻译…</span>}
    {row.translation && <><header><strong>译文</strong><IconButton label={row.speaking ? '停止朗读' : '朗读译文'} Icon={row.speaking ? Square : Volume2} click={() => reader.speak(key, () => row.translation)}/><IconButton label="收起译文" Icon={X} click={() => reader.translate(key)}/></header><div dir="auto">{row.translation}</div></>}
    {row.error && <p role="alert">{row.error} <button type="button" className="drr-link" onClick={openSettings}>前往设置</button></p>}
  </aside>;
}
function ResultMount() { return <div data-drr-result-seat=""/>; }
export const inject = ['slots'];
export function apply(ctx) {
  const reader = new Reader();
  const openSettings = () => ctx.slots.entries('sidebar.settings')[0]?.store?.create()?.actions.openSection(section);
  ctx.effect(() => {
    const style = document.createElement('style'); style.textContent = css; document.head.append(style);
    return () => { style.remove(); reader.dispose(); };
  });
  for (const [name, component] of [['conversation.chat.assistant-actions', Actions], ['conversation.chat.turnTail', ResultMount], ['settings.section', Settings]]) {
    ctx.slots.inject(name, () => ctx.slots.register({name, id: section, order: name === 'settings.section' ? 75 : 20, label: '翻译与朗读', inject: () => ({reader, openSettings})}, component));
  }
}
