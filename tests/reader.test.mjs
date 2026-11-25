import test from 'node:test';
import assert from 'node:assert/strict';
import {Reader, resultMount, findText} from '../client/reader.js';

test('result stays in the clicked turn, including when the optional tail seat is absent', () => {
  const mount = {}, tail = {querySelector:()=>mount}, button = {closest:()=>tail};
  assert.equal(resultMount(button), mount);
  tail.querySelector=()=>null; assert.equal(resultMount(button), tail);
  assert.equal(resultMount(null), undefined);
});

test('selects the clicked finalized reply, never another message, reasoning or tool output', () => {
  const node = (id,text) => ({kind:'turn-tail',data:{closing:{finalNode:{messageId:id},blocks:[{kind:'reasoning',text:'hidden'},{kind:'text',text},{kind:'tool',text:'hidden'},{kind:'text',text:'!'}]}}});
  const nodes=[node('first','One'),node('second','Two')]; const store={values:()=>nodes};
  assert.equal(findText(store,'first'),'One!'); assert.equal(findText(store,'second'),'Two!'); assert.equal(findText(store,'gone'),'');
});
test('translation cancel/retry ignores late results, and sessions stay independent', async () => {
  const queued=[]; const reader=new Reader((kind,data,signal)=>new Promise(resolve=>queued.push({resolve,signal})));
  const first=reader.translate('session-a',()=>'first'); await reader.translate('session-a');
  assert.equal(queued[0].signal.aborted,true); const next=reader.translate('session-a',()=>'second');
  queued[0].resolve({text:'stale'}); await first; assert.equal(reader.get('session-a').loading,true);
  queued[1].resolve({text:'correct'}); await next; assert.equal(reader.get('session-a').translation,'correct'); assert.deepEqual(reader.get('session-b'),{});
  await reader.translate('session-a'); assert.equal(reader.get('session-a').translation,'');
});
test('switching playback aborts the previous synthesis; unmount releases the next one', async () => {
  const queued=[];const reader=new Reader((kind,data,signal)=>new Promise(resolve=>queued.push({resolve,signal})));
  const first=reader.speak('first',()=>'One'); const next=reader.speak('second',()=>'Two');
  assert.equal(queued[0].signal.aborted,true); assert.equal(reader.get('first').speaking,false);
  reader.clear('second'); assert.equal(queued[1].signal.aborted,true);
  for (const job of queued) job.resolve(new Blob([])); await Promise.all([first,next]); assert.deepEqual(reader.get('second'),{});
});
