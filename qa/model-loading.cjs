// Async GLB loading regressions. Run serially with other Chrome CDP checks.
// Uses only the local test page and temporary fetch/factory wrappers in that page.
const { connect } = require('./browser.cjs');
const fs = require('fs');
const path = require('path');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log('PASS ' + message);
};

(async () => {
  const b = await connect();
  const report = { passed: false, memory: [] };
  const state = () => b.evaluate('window.__structura.state()');
  const frames = () => b.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const waitFor = async (expression, timeout = 45000) => {
    const start = Date.now();
    while (!(await b.evaluate(expression))) {
      if (Date.now() - start > timeout) throw new Error('Timed out: ' + expression);
      await b.wait(100);
    }
  };
  const select = id => b.evaluate(`(() => {
    const select = document.getElementById('product-select');
    select.value = ${JSON.stringify(id)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  const switchTo = async id => {
    await select(id);
    await waitFor(`window.__structura.state().productId === ${JSON.stringify(id)} && !window.__structura.state().loading`);
    await frames();
  };
  const resources = async label => {
    await frames();
    const current = await state();
    const result = { label, productId: current.productId, geometries: current.geometries, textures: current.textures };
    assert(Number.isFinite(result.geometries) && Number.isFinite(result.textures), label + ' exposes GPU resource counts');
    report.memory.push(result);
    return result;
  };
  try {
    await b.send('Runtime.enable');
    await b.send('Log.enable');
    await b.send('Page.enable');
    await b.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await b.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await b.send('Page.navigate', { url: 'http://127.0.0.1:5174' });
    await waitFor('window.__structura?.state().productId === "action-4" && !window.__structura.state().loading');
    await frames();

    // Hold the first GLB fetch until after the user has selected Action 4 again.
    // Wrap dispose as well, so this verifies late-result cleanup rather than timing alone.
    await b.evaluate(`(async () => {
      const { products } = await import('./src/products/registry.js');
      const entry = products['xiaomi-su7'];
      const originalCreate = entry.create;
      const originalFetch = window.fetch;
      const probe = { mode: 'delay-once', held: false, failedRequests: 0, completed: [], modelRequests: 0 };
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      probe.release = () => { probe.held = false; release(); };
      window.fetch = async function(input, ...args) {
        const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, location.href);
        if (/\\.glb$/i.test(url.pathname)) {
          probe.modelRequests++;
          if (probe.mode === 'delay-once') {
            probe.mode = 'normal'; probe.held = true;
            await gate;
          } else if (probe.mode === 'fail-once') {
            probe.mode = 'normal'; probe.failedRequests++;
            throw new TypeError('Intentional local QA GLB fetch failure');
          }
        }
        return originalFetch.call(window, input, ...args);
      };
      entry.create = async function(...args) {
        const candidate = await originalCreate.apply(this, args);
        const record = { disposed: 0 };
        probe.completed.push(record);
        const originalDispose = candidate.dispose;
        candidate.dispose = function(...disposeArgs) {
          record.disposed++;
          return originalDispose?.apply(this, disposeArgs);
        };
        return candidate;
      };
      probe.restore = () => { probe.release(); window.fetch = originalFetch; entry.create = originalCreate; };
      window.__qaModelLoading = probe;
    })()`);

    const initial = await resources('initial Action 4');
    await select('xiaomi-su7');
    await waitFor('window.__qaModelLoading.held && window.__structura.state().loading');
    const pending = await state();
    assert(pending.productId === 'action-4' && pending.loadingProductId === 'xiaomi-su7',
      'pending SU7 request keeps the current Action 4 model visible');
    assert(await b.evaluate('!document.getElementById("product-select").disabled'), 'product selector stays usable during loading');
    await switchTo('action-4');
    await b.evaluate('window.__qaModelLoading.release()');
    await waitFor('window.__qaModelLoading.completed.length === 1 && window.__qaModelLoading.completed[0].disposed === 1');
    await frames();
    const afterLateResult = await state();
    assert(afterLateResult.productId === 'action-4' && !afterLateResult.loading && !afterLateResult.loadingProductId && !afterLateResult.loadError,
      'late SU7 result is disposed and cannot replace the newer product selection');
    const afterStale = await resources('Action 4 after stale SU7 result');
    assert(afterStale.textures <= initial.textures && afterStale.geometries <= initial.geometries,
      'stale GLB completion does not retain rendered GPU resources');

    // Reject one model request. The previous model and controls must remain usable.
    await b.evaluate('window.__qaModelLoading.mode = "fail-once"');
    await select('xiaomi-su7');
    await waitFor('!window.__structura.state().loading && Boolean(window.__structura.state().loadError)');
    const failed = await state();
    assert(await b.evaluate('window.__qaModelLoading.failedRequests === 1'), 'the GLB request failure was exercised');
    assert(failed.productId === 'action-4' && failed.parts === 10 && !failed.loadingProductId,
      'failed model request preserves the previous product');
    const errorUi = await b.evaluate(`(() => {
      const status = document.getElementById('model-load-status');
      return {
        visible: Boolean(status && !status.hidden && status.getClientRects().length),
        text: status?.textContent,
        selected: document.getElementById('product-select').value,
        busy: document.getElementById('viewport').getAttribute('aria-busy'),
        loadingHidden: document.getElementById('loading').hidden,
        fallbackHidden: document.getElementById('fallback').hidden
      };
    })()`);
    assert(errorUi.visible && /SU7/.test(errorUi.text) && /失败/.test(errorUi.text) && /重试/.test(errorUi.text),
      'failed request displays readable model-specific recovery instructions');
    assert(errorUi.selected === 'action-4' && errorUi.busy === 'false' && errorUi.loadingHidden && errorUi.fallbackHidden,
      'failure restores the selector and ends loading without hiding the current model');
    await b.click('[data-part="frame"]');
    assert((await state()).selected === 'frame', 'current product remains interactive after failed loading');
    await b.screenshot('su7-load-error');

    await switchTo('xiaomi-su7');
    const recovered = await state();
    assert(recovered.parts === 12 && !recovered.loadError && !recovered.loadingProductId,
      'reselecting SU7 retries successfully and clears the error');
    assert(await b.evaluate('document.getElementById("model-load-status").hidden'), 'successful retry clears the error message');
    await b.screenshot('su7-load-recovered');
    const su7Baseline = await resources('SU7 after successful retry');
    await switchTo('action-4');
    const actionBaseline = await resources('Action 4 after first complete SU7 disposal');
    for (let cycle = 1; cycle <= 3; cycle++) {
      await switchTo('xiaomi-su7');
      const su7 = await resources('SU7 texture cycle ' + cycle);
      assert(su7.textures <= su7Baseline.textures && su7.geometries <= su7Baseline.geometries,
        'SU7 texture and geometry allocations stay bounded in cycle ' + cycle);
      await switchTo('action-4');
      const action = await resources('Action 4 texture cycle ' + cycle);
      assert(action.textures <= actionBaseline.textures && action.geometries <= actionBaseline.geometries,
        'SU7 textures and geometry are released on switch in cycle ' + cycle);
    }
    const unhandled = b.events.filter(event => event.method === 'Runtime.exceptionThrown');
    assert(unhandled.length === 0, 'delayed, failed and successful model loads have no unhandled runtime errors');
    report.passed = true;
    report.unhandled = unhandled;
    report.errorUi = errorUi;
    fs.writeFileSync(path.join(__dirname, 'model-loading-results.json'), JSON.stringify(report, null, 2));
    console.log('PASS asynchronous model races, failure recovery and texture disposal');
  } finally {
    await b.evaluate('window.__qaModelLoading?.restore()').catch(() => {});
    b.ws.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
