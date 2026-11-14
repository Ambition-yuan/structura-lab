// Product switching regression checks. Uses the existing local Chrome CDP harness.
// Start the QA server on 5174 and Chrome remote debugging on 9222, then run with Node 22+.
const { connect } = require('./browser.cjs');
const fs = require('fs');
const path = require('path');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log('PASS ' + message);
};
const inView = parts => parts.every(part => part.corners.every(corner =>
  corner.every(Number.isFinite) && Math.abs(corner[0]) < 1 && Math.abs(corner[1]) < 1 && corner[2] > -1 && corner[2] < 1));
const assembled = parts => parts.every(part => part.position.every((value, index) => Math.abs(value - part.assembled[index]) < 0.0001));

(async () => {
  const b = await connect();
  const report = { passed: false, animations: [], memory: [] };
  const state = () => b.evaluate('window.__structura.state()');
  const bounds = () => b.evaluate('window.__structura.bounds()');
  const frames = () => b.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const switchTo = async id => {
    await b.evaluate(`(() => {
      const select = document.getElementById('product-select');
      select.value = ${JSON.stringify(id)};
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(`window.__structura.state().productId === ${JSON.stringify(id)} && !window.__structura.state().loading`);
    await frames();
  };
  const waitFor = async expression => {
    const start = Date.now();
    while (!(await b.evaluate(expression))) {
      if (Date.now() - start > 45000) throw new Error('Timed out: ' + expression);
      await b.wait(120);
    }
  };
  const assertClean = async (id, count) => {
    const current = await state();
    assert(current.productId === id && current.parts === count && !current.loading && !current.loadingProductId && !current.loadError,
      id + ' finishes loading expected product and part count');
    assert(current.progress === 0 && current.desiredProgress === 0 && current.selected === null && !current.autoRotate,
      id + ' resets animation, selection and auto rotation');
    assert(current.guides === count && current.labels === count, id + ' owns exactly one guide and label per part');
    assert(assembled(await bounds()), id + ' starts at assembled coordinates');
    assert(await b.evaluate(`(() => {
      const get = id => document.getElementById(id);
      return ['labels-btn', 'auto-rotate-btn', 'explode-btn', 'front-view-btn', 'rear-view-btn']
        .every(id => get(id).getAttribute('aria-pressed') === 'false') &&
        get('explode-range').value === '0' &&
        document.querySelectorAll('.part-item').length === ${count} &&
        document.querySelectorAll('.part-item[aria-pressed="true"]').length === 0 &&
        document.querySelectorAll('#labels-layer .model-label').length === ${count} &&
        Number(get('parts-count').textContent) === ${count} &&
        get('detail-index').textContent === 'PRODUCT OVERVIEW';
    })()`), id + ' resets controls and component DOM');
  };
  const assertMetadata = async id => {
    const metadata = await b.evaluate(`(() => {
      const text = id => document.getElementById(id).textContent;
      return {
        title: document.title,
        description: document.querySelector('meta[name="description"]').content,
        heading: document.querySelector('h1').textContent,
        model: text('product-model-label'),
        stage: text('stage-wordmark'),
        detail: text('detail-en'),
        canvas: document.querySelector('.three-canvas').getAttribute('aria-label'),
        links: [...document.querySelectorAll('#sources-links a')].map(link => link.href),
        notes: text('model-notes') + text('schematic-notes') + text('source-footnote')
      };
    })()`);
    const su7 = id === 'xiaomi-su7';
    const needle = su7 ? /SU7/i : /Action\s*4/i;
    assert(['title', 'description', 'heading', 'stage', 'detail', 'canvas'].every(key => needle.test(metadata[key])) &&
      (su7 ? metadata.model === 'SU7 · EXTERIOR STUDY' : metadata.model.includes('2023')),
      id + ' updates title, overview, stage and accessible model name');
    const sourceHosts = metadata.links.map(link => new URL(link).hostname);
    const allowedHosts = su7 ? ['xiaomiev.com', 'sketchfab.com', 'creativecommons.org'] : ['dji.com', 'djicdn.com'];
    assert(sourceHosts.length > 0 && sourceHosts.every(host => allowedHosts.some(allowed => host === allowed || host.endsWith('.' + allowed))),
      id + ' uses relevant official and model attribution source links');
    if (su7) assert(sourceHosts.some(host => host === 'sketchfab.com' || host.endsWith('.sketchfab.com')) &&
      sourceHosts.some(host => host === 'creativecommons.org' || host.endsWith('.creativecommons.org')),
      'SU7 includes downloaded model attribution and license');
    assert(su7 ? !/DJI|CMOS|1770/.test(metadata.notes) : !/SU7|73\.6/.test(metadata.notes), id + ' removes previous model source notes');
  };
  const animateAndMeasure = async (value, label) => {
    const result = await b.evaluate(`new Promise(resolve => {
      const input = document.getElementById('explode-range');
      input.value = ${value * 100};
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const start = performance.now();
      let samples = 0, maxExtent = 0, stableFrames = 0, invalid = false;
      function sample() {
        const corners = window.__structura.bounds().flatMap(part => part.corners);
        for (const corner of corners) {
          invalid ||= !corner.every(Number.isFinite) || corner[2] <= -1 || corner[2] >= 1;
          maxExtent = Math.max(maxExtent, Math.abs(corner[0]), Math.abs(corner[1]));
        }
        samples++;
        stableFrames = window.__structura.state().progress === ${value} ? stableFrames + 1 : 0;
        if (stableFrames >= 15 || performance.now() - start > 10000) {
          resolve({ samples, maxExtent, invalid, progress: window.__structura.state().progress });
        } else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    })`);
    report.animations.push({ label, ...result });
    assert(result.progress === value && result.samples >= 15, label + ' reaches endpoint');
    assert(!result.invalid && result.maxExtent < 1, label + ' stays inside viewport throughout animation (' + result.maxExtent.toFixed(3) + ')');
  };
  try {
    await b.send('Runtime.enable');
    await b.send('Log.enable');
    await b.send('Page.enable');
    await b.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await b.send('Page.navigate', { url: 'http://127.0.0.1:5174' });
    await waitFor('window.__structura?.state().productId === "action-4" && !window.__structura.state().loading');
    await frames();
    assert(await b.evaluate('[...document.getElementById("product-select").options].map(o => o.value).join(",") === "action-4,xiaomi-su7"'), 'selector includes both implemented products');
    await assertClean('action-4', 10);

    // A switch during movement must immediately discard the old animation and selection.
    await b.click('.part-item');
    await b.click('#labels-btn');
    await b.click('#auto-rotate-btn');
    await switchTo('xiaomi-su7');
    await assertClean('xiaomi-su7', 12);
    await assertMetadata('xiaomi-su7');
    assert(inView(await bounds()), 'desktop SU7 assembled bounds fit');
    await b.screenshot('su7-desktop-assembled');
    await b.click('#sources-btn');
    assert(await b.evaluate('document.getElementById("sources-dialog").open'), 'SU7 sources dialog opens');
    await b.click('#close-sources-btn');

    // Pointer picking must work on the new mesh, independently of the component list.
    const rect = await b.evaluate('(() => {const r = document.querySelector("canvas.three-canvas").getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height};})()');
    let hit = null;
    for (const [u, v] of [[0.5, 0.5], [0.45, 0.55], [0.55, 0.55], [0.4, 0.5], [0.6, 0.5]]) {
      const point = { x: rect.x + rect.w * u, y: rect.y + rect.h * v, button: 'left', clickCount: 1 };
      await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point });
      await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point });
      hit = (await state()).selected;
      if (hit) break;
    }
    assert(Boolean(hit), 'SU7 visible mesh can be selected with a pointer');
    assert(await b.evaluate(`document.querySelector('[data-part="${hit}"]').getAttribute('aria-pressed') === 'true'`), 'SU7 mesh selection syncs component list');
    await b.click('#reset-btn');
    await waitFor('window.__structura.state().progress === 0');
    await b.wait(900);
    await animateAndMeasure(1, 'desktop SU7 explosion');
    const ids = await b.evaluate('[...document.querySelectorAll(".part-item")].map(button => button.dataset.part)');
    const expectedIds = ['body-shell', 'body-trim', 'glazing', 'left-front-door', 'left-rear-door', 'right-front-door', 'right-rear-door', 'cabin', 'wheels', 'lighting', 'badges', 'radar'];
    assert(ids.length === expectedIds.length && new Set(ids).size === expectedIds.length && expectedIds.every(id => ids.includes(id)),
      'SU7 exposes the twelve imported exterior component groups');
    for (const id of ids) {
      await b.click(`[data-part="${id}"]`);
      assert((await state()).selected === id, 'SU7 selection ' + id);
      assert(await b.evaluate(`document.getElementById('detail-title').textContent === document.querySelector('[data-part="${id}"] .part-name').textContent && document.querySelectorAll('.part-item[aria-pressed="true"]').length === 1`), 'SU7 detail matches ' + id);
    }
    await b.click('#labels-btn');
    await frames();
    await b.screenshot('su7-desktop-exploded');
    await animateAndMeasure(0, 'desktop SU7 reassembly');
    assert(assembled(await bounds()), 'SU7 reassembly restores every part position');
    await b.click('#front-view-btn');
    await b.wait(1500);
    assert((await state()).camera[2] > (await state()).target[2] && inView(await bounds()), 'SU7 front view faces front and fits');
    await b.click('#rear-view-btn');
    await b.wait(1500);
    assert((await state()).camera[2] < (await state()).target[2] && inView(await bounds()), 'SU7 rear view faces rear and fits');
    await b.click('#auto-rotate-btn');
    await switchTo('action-4');
    await assertClean('action-4', 10);
    await assertMetadata('action-4');

    // Warm both products with visible guides before recording GPU resource baselines.
    const baseline = new Map();
    for (let cycle = 0; cycle < 4; cycle++) {
      for (const [id, count] of [['action-4', 10], ['xiaomi-su7', 12]]) {
        await switchTo(id);
        await assertClean(id, count);
        await b.click('#labels-btn');
        await b.evaluate('document.getElementById("explode-range").value = "100"; document.getElementById("explode-range").dispatchEvent(new Event("input", {bubbles:true}))');
        await waitFor('window.__structura.state().progress === 1');
        await frames();
        const current = await state();
        assert(Number.isFinite(current.geometries) && Number.isFinite(current.textures), 'GPU diagnostics available for ' + id);
        const memory = { id, cycle, geometries: current.geometries, textures: current.textures, guides: current.guides, labels: current.labels };
        report.memory.push(memory);
        if (cycle === 0) baseline.set(id, memory);
        else {
          const initial = baseline.get(id);
          assert(memory.geometries <= initial.geometries && memory.textures <= initial.textures && memory.guides === count && memory.labels === count,
            id + ' resources remain bounded after switch cycle ' + cycle);
        }
      }
    }

    await switchTo('xiaomi-su7');
    await b.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await b.wait(600);
    await b.evaluate('window.scrollTo(0,0)');
    assert(await b.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'mobile SU7 has no horizontal overflow');
    assert(inView(await bounds()), 'mobile SU7 assembled bounds fit');
    await b.screenshot('su7-mobile-assembled');
    await animateAndMeasure(1, 'mobile SU7 explosion');
    await b.screenshot('su7-mobile-exploded');
    await b.click(`[data-part="${ids[ids.length - 1]}"]`);
    assert((await state()).selected === ids[ids.length - 1], 'mobile SU7 component selection works');
    await b.screenshot('su7-mobile-detail');
    await animateAndMeasure(0, 'mobile SU7 reassembly');
    await switchTo('action-4');
    await assertClean('action-4', 10);
    assert(inView(await bounds()), 'mobile switch restores Action 4 framing');

    await b.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await b.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await b.send('Page.navigate', { url: 'http://127.0.0.1:5174/dist/index.html' });
    await waitFor('window.__structura?.state().productId === "action-4" && !window.__structura.state().loading');
    await switchTo('xiaomi-su7');
    await assertClean('xiaomi-su7', 12);
    await assertMetadata('xiaomi-su7');
    await b.click('#explode-btn');
    await waitFor('window.__structura.state().progress === 1');
    assert(inView(await bounds()), 'built SU7 model loads and explodes');
    const errors = b.events.filter(event => event.method === 'Runtime.exceptionThrown' ||
      (event.method === 'Log.entryAdded' && event.params.entry.level === 'error'));
    assert(errors.length === 0, 'product switching has no runtime or loading errors');
    report.passed = true;
    report.errors = errors;
    fs.writeFileSync(path.join(__dirname, 'product-switch-results.json'), JSON.stringify(report, null, 2));
    console.log('PASS product switching, mobile animation and production SU7 smoke checks');
  } finally {
    b.ws.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
