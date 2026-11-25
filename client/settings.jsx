import React, {useEffect, useState} from 'react';
import {ChevronDown, Languages, Volume2} from 'lucide-react';
import {api} from './reader.js';

const choices = {auto: '中英互译', 'zh-Hans': '简体中文', en: '英语', ja: '日语', de: '德语', fr: '法语', es: '西班牙语'};

export function Settings() {
  const [saved, setSaved] = useState(null), [patch, setPatch] = useState({});
  const [status, setStatus] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api('settings', null, controller.signal).then(setSaved, error => { if (!controller.signal.aborted) setStatus(error.message); });
    return () => controller.abort();
  }, []);
  const values = {...saved?.values, ...patch};
  const change = (key, value) => { setPatch(previous => ({...previous, [key]: value})); setStatus(''); };
  const save = async event => {
    event.preventDefault(); setBusy(true); setStatus('');
    try { await api('settings', {patch, revision: saved.revision}); setSaved(await api('settings')); setPatch({}); setStatus('设置已保存'); }
    catch (error) { setStatus(error.message); } finally { setBusy(false); }
  };
  return <form className="drr-settings" onSubmit={save}>
    <h2>翻译与朗读</h2>
    {saved && <fieldset disabled={busy}>
      <label className="drr-language">目标语言<span className="drr-picker"><select value={values.target} onChange={event => change('target', event.target.value)}>{Object.entries(choices).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={14} aria-hidden="true"/></span></label>
      {['translate','speech'].map(kind => {
        const speech = kind === 'speech', hasKey = speech ? saved.hasSpeechKey : saved.hasTranslateKey;
        const title = speech ? '朗读' : '翻译';
        const Icon = speech ? Volume2 : Languages;
        return <section key={kind} className="drr-card"><header><h3><Icon size={18} aria-hidden="true"/>{title}</h3>
          <div className="drr-modes" role="radiogroup" aria-label={`${title}服务`}>
            {['auto','api'].map(mode => <label key={mode}><input type="radio" name={`${kind}-mode`} checked={values[kind+'Mode'] === mode} onChange={() => change(kind+'Mode',mode)}/><span>{mode === 'api' ? '自定义 API' : saved.mac ? '系统服务' : '未配置'}</span></label>)}
          </div></header>
          {values[kind+'Mode'] === 'api' && <div className="drr-fields">
            <label>API 地址<input type="url" required value={values[kind+'Url']} placeholder="http://127.0.0.1:8000/v1" onChange={event => change(kind+'Url', event.target.value.trim())}/></label>
            <label>模型名称<input required value={values[kind+'Model']} placeholder={speech ? '服务提供的语音模型 ID' : '服务提供的翻译模型 ID'} onChange={event => change(kind+'Model', event.target.value)}/></label>
            {speech && <label>音色<input value={values.voice} placeholder="alloy" onChange={event => change('voice', event.target.value)}/></label>}
            <label>API 密钥<input type="password" autoComplete="new-password" value={patch[kind+'Key'] || ''} placeholder={hasKey && values[kind+'Url'] === saved.values[kind+'Url'] && patch[kind+'Key'] === undefined ? '已保存，留空保留' : '可选'} onChange={event => change(kind+'Key', event.target.value)}/></label>
            {hasKey && <button type="button" className="drr-link" onClick={() => change(kind+'Key','')}>清除已保存的密钥</button>}
          </div>}
        </section>;
      })}
      <footer><span role="status">{status || (Object.keys(patch).length ? '有未保存的更改' : '')}</span><button className="drr-save" disabled={!Object.keys(patch).length}>{busy ? '保存中…' : '保存设置'}</button></footer>
    </fieldset>}
    {!saved && <p role="status">{status || '正在读取设置…'}</p>}
  </form>;
}
