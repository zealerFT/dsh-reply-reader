import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {defaults, callProvider, SetupError, endpoint, validate} from '../host/providers.js';

for (const platform of ['win32','linux']) {
  test(`${platform}: no provider never makes a network request`, async () => {
    for (const action of ['translate','speech']) await assert.rejects(callProvider(action,'Hello',defaults,{platform, request: assert.fail, native: assert.fail}), SetupError);
  });
}
test('macOS auto selects the native service independently for each action', async () => {
  for (const action of ['translate','speech']) assert.equal(await callProvider(action, 'Hello', defaults, {platform:'darwin', native: async kind => kind, request: assert.fail}), action);
});
test('API accepts a base URL or complete route; invalid addresses and models fail closed', () => {
  for (const url of ['http://127.0.0.1:9000/v1/','http://127.0.0.1:9000/v1/audio/speech']) assert.equal(endpoint(url,'speech').pathname,'/v1/audio/speech');
  for (const url of ['file:///tmp/test','http://example.com','https://user:pass@example.com','https://example.com/?token=abc']) assert.throws(() => endpoint(url,'translate'),SetupError);
  assert.throws(() => validate({...defaults, translateMode:'api',translateUrl:'https://example.com/v1'}),SetupError);
});
test('custom providers on Windows: real HTTP requests for translation and audio', async context => {
  const received = [];
  const server = createServer(async (req,res) => {
    const chunks=[]; for await (const chunk of req) chunks.push(chunk);
    received.push({url:req.url,body:JSON.parse(Buffer.concat(chunks)),auth:req.headers.authorization});
    if (req.url.endsWith('/speech')) { res.setHeader('content-type','audio/mpeg'); res.end('sample audio'); }
    else res.end(JSON.stringify({choices:[{message:{content:'测试译文'}}]}));
  });
  server.listen(0,'127.0.0.1'); await once(server,'listening'); context.after(()=>server.close());
  const url=`http://127.0.0.1:${server.address().port}/v1`;
  const config={...defaults, target:'zh-Hans',translateMode:'api',translateUrl:url,translateModel:'local-chat',translateKey:'test-key',speechMode:'api',speechUrl:url,speechModel:'local-voice',voice:'test-voice'};
  assert.deepEqual(await (await callProvider('translate','Hello',config,{platform:'win32'})).json(),{text:'测试译文'});
  const audio=await callProvider('speech','Hello',config,{platform:'win32'});
  assert.equal(audio.headers.get('content-type'),'audio/mpeg'); assert.equal(await audio.text(),'sample audio');
  assert.equal(received[0].url,'/v1/chat/completions'); assert.equal(received[0].auth,'Bearer test-key'); assert.equal(received[0].body.messages[1].content,'Hello');
  assert.deepEqual(received[1],{url:'/v1/audio/speech',auth:undefined,body:{model:'local-voice',input:'Hello',voice:'test-voice',response_format:'mp3'}});
});
test('malformed responses do not become visible translation or audio', async () => {
  for (const kind of ['speech','translate']) {
    const config={...defaults,[kind+'Mode']:'api',[kind+'Url']:'https://example.com/v1',[kind+'Model']:'test'};
    await assert.rejects(callProvider(kind,'Hello',config,{request:async()=>Response.json({})}));
    await assert.rejects(callProvider(kind,'Hello',config,{request:async()=>new Response('secret upstream error',{status:401})}),/HTTP 401/);
  }
});
