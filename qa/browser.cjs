// Small acceptance harness using the Chrome DevTools Protocol. Run with Node 22+.
const fs = require('fs');
const path = require('path');
async function connect() {
  const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
  const target = targets.find(t => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0; const pending = new Map(), events = [];
  ws.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.id) { const p = pending.get(data.id); pending.delete(data.id); data.error ? p.reject(data.error) : p.resolve(data.result); }
    else events.push(data);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id:n, method, params })); });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue:true, awaitPromise:true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const screenshot = async name => { const image = await send('Page.captureScreenshot', { format:'png' }); fs.writeFileSync(path.join(__dirname, name + '.png'), Buffer.from(image.data, 'base64')); };
  const click = async selector => {
    const box = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await send('Input.dispatchMouseEvent', { type:'mousePressed', ...box, button:'left', clickCount:1 });
    await send('Input.dispatchMouseEvent', { type:'mouseReleased', ...box, button:'left', clickCount:1 });
  };
  return {ws,send,evaluate,wait,screenshot,click,events};
}
module.exports = { connect };
if (require.main === module) (async()=>{
  const b=await connect();
  await b.send('Runtime.enable'); await b.send('Log.enable');
  await b.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await b.send('Page.navigate',{url:'http://127.0.0.1:5174'});
  await b.wait(3500);
  console.log(JSON.stringify({state:await b.evaluate('window.__structura?.state()'),error:await b.evaluate('document.getElementById("fallback")?.hidden ? null : document.body.innerText.slice(0,800)'),events:b.events.filter(e=>e.method==='Runtime.exceptionThrown'||e.method==='Log.entryAdded')},null,2));
  await b.screenshot('desktop-assembled'); b.ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
