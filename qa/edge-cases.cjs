const {connect}=require('./browser.cjs');
(async()=>{
  const b=await connect();
  await b.send('Page.enable');
  await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await b.send('Page.navigate',{url:'http://127.0.0.1:5174'}); await b.wait(1800);
  const result=await b.evaluate(`new Promise(resolve=>{
    const readings=[]; const start=performance.now();
    document.getElementById('explode-btn').click();
    function sample(){
      const bounds=window.__structura.bounds();
      readings.push(Math.max(...bounds.flatMap(p=>p.corners.flatMap(c=>[Math.abs(c[0]),Math.abs(c[1])]))));
      if(performance.now()-start<2200)requestAnimationFrame(sample);else resolve({samples:readings.length,maxExtent:Math.max(...readings),last:readings.at(-1)});
    }requestAnimationFrame(sample);
  })`);
  console.log('Animated viewport bounds: '+JSON.stringify(result));
  if(result.maxExtent>1.03)throw new Error('Animation leaves viewport');
  const {identifier}=await b.send('Page.addScriptToEvaluateOnNewDocument',{source:`const originalGetContext=HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2'||type==='webgl'||type==='experimental-webgl')return null;return originalGetContext.call(this,type,...args)}`});
  await b.send('Page.reload'); await b.wait(1300);
  const fallback=await b.evaluate('({visible:!document.getElementById("fallback").hidden,text:document.getElementById("fallback").textContent,loadingHidden:document.getElementById("loading").hidden})');
  console.log('WebGL unavailable: '+JSON.stringify(fallback));
  if(!fallback.visible||!fallback.loadingHidden||!fallback.text.includes('WebGL'))throw new Error('Fallback missing');
  await b.screenshot('mobile-no-webgl');
  await b.send('Page.removeScriptToEvaluateOnNewDocument',{identifier});
  await b.send('Page.reload'); b.ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
