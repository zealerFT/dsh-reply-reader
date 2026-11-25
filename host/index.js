import z from '@deepseek-ai/schemastery';
import { defaults, modes, languages, validate, callProvider, SetupError } from './providers.js';

const namespace = 'reply-reader';
const fields = Object.keys(defaults);
const isKey = field => field.endsWith('Key');
export const Config = z.object(Object.fromEntries(fields.map(field => {
  const schema = field === 'target' ? z.union(Object.keys(languages)) : field.endsWith('Mode') ? z.union(modes)
    : isKey(field) ? z.string().role('secret') : z.string();
  return [field, schema.default(defaults[field]).volatile()];
})));
export const inject = ['connection', 'settings'];

export function apply(ctx, config) {
  const unload = new AbortController();
  ctx.effect(() => () => unload.abort());
  ctx.effect(() => ctx.settings.configure({auto: false}, ctx.fiber));
  const values = () => Object.fromEntries(fields.map(field => [field, config[field].get()]));
  const revision = () => ctx.settings.describe({redactSecrets: true}).find(item => item.ns === namespace)?.revision;
  for (const action of ['settings', 'translate', 'speech']) {
    ctx.connection.fetch.register({path: `/api/dsh-reply-reader/${action}`, methods: action === 'settings' ? ['GET', 'POST'] : ['POST'], requestBody: 'buffered', async fetch(req) {
      try {
        const current = values();
        if (req.method === 'GET') {
          const publicValues = Object.fromEntries(fields.filter(field => !isKey(field)).map(field => [field, current[field]]));
          return Response.json({values: publicValues, hasTranslateKey: !!current.translateKey, hasSpeechKey: !!current.speechKey, mac: process.platform === 'darwin', revision: revision()}, {headers: {'Cache-Control': 'no-store'}});
        }
        if (req.headers.get('content-type')?.split(';')[0] !== 'application/json') return new Response(null, {status: 415});
        const data = await req.json();
        if (action === 'settings') {
          if (!Number.isSafeInteger(data.revision) || data.revision !== revision()) throw new Error('设置已变化，请重新打开此页后再保存。');
          const patch = data.patch;
          if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.entries(patch).some(([field, value]) => !fields.includes(field) || typeof value !== 'string' || value.length > 4096)) throw new Error('设置格式无效。');
          for (const kind of ['translate', 'speech']) {
            if (patch[kind + 'Url'] !== undefined && patch[kind + 'Url'] !== current[kind + 'Url'] && !Object.hasOwn(patch, kind + 'Key')) patch[kind + 'Key'] = '';
          }
          validate({...current, ...patch});
          await ctx.settings.mutate(namespace, Object.entries(patch).map(([field, value]) => ({op: 'set', path: [field], value})), data.revision);
          return Response.json({saved: true});
        }
        const signal = AbortSignal.any([req.signal, unload.signal, AbortSignal.timeout(120000)]);
        return await callProvider(action, data.text, current, {signal});
      } catch (error) {
        const setup = error instanceof SetupError;
        const message = error.name === 'TimeoutError' ? '服务超时，请重试。' : error.message === 'fetch failed' ? '无法连接模型服务，请检查服务状态和地址。' : error.message;
        return Response.json({error: message, setup}, {status: setup ? 422 : 400});
      }
    }});
  }
}
