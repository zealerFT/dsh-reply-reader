import test from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../host/index.js';
import {defaults} from '../host/providers.js';

test('settings never echo keys, preserve keys on unrelated edits, clear on endpoint change and reject stale saves', async () => {
  const routes=new Map(), values={...defaults, translateKey:'test-secret'}; let revision=0;
  const ctx={effect:fn=>fn(),connection:{fetch:{register:route=>routes.set(route.path,route)}},settings:{configure:()=>()=>{},describe:()=>[{ns:'reply-reader',revision}],mutate:async(ns,ops)=>{for(const op of ops) values[op.path[0]]=op.value;revision++;}}};
  apply(ctx,Object.fromEntries(Object.keys(values).map(key=>[key,{get:()=>values[key]}])));
  const request=body=>routes.get('/api/dsh-reply-reader/settings').fetch(new Request('http://localhost/api/dsh-reply-reader/settings',body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{}));
  const initial=await (await request()).json(); assert.equal(initial.hasTranslateKey,true);assert.ok(!JSON.stringify(initial).includes('test-secret'));
  assert.equal((await request({revision:0,patch:{target:'fr'}})).status,200); assert.equal(values.translateKey,'test-secret');
  assert.notEqual((await request({revision:0,patch:{target:'en'}})).status,200); assert.equal(values.target,'fr');
  assert.equal((await request({revision:1,patch:{translateUrl:'https://example.com/v1'}})).status,200); assert.equal(values.translateKey,'');
});
