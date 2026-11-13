const {connect}=require('./browser.cjs');
(async()=>{
  const b=await connect(); await b.send('Runtime.enable'); await b.send('Log.enable');
  await b.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await b.send('Page.navigate',{url:'http://127.0.0.1:5174/dist/index.html'}); await b.wait(1800);
  const state=await b.evaluate('window.__structura?.state()');
  const errors=b.events.filter(e=>e.method==='Runtime.exceptionThrown'||(e.method==='Log.entryAdded'&&e.params.entry.level==='error'));
  if(!state||state.parts!==10||errors.length)throw new Error(JSON.stringify({state,errors}));
  await b.click('#explode-btn'); await b.wait(2400);
  if((await b.evaluate('window.__structura.state().progress'))!==1)throw new Error('Built interaction failed');
  console.log('PASS production static output loads and explodes; no browser errors');
  await b.click('#reset-btn'); await b.wait(1800); await b.screenshot('final-desktop'); b.ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
