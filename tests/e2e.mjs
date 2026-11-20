import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

function findChrome() {
  for (const p of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function main() {
  const chromeBin = findChrome();
  if (!chromeBin) {
    console.error('Chromium/Chrome tidak ditemukan untuk pengujian E2E.');
    process.exit(1);
  }

  const server = http.createServer((req, res) => {
    const clean = (req.url || '/').split('?')[0];
    const rel = clean === '/' ? 'index.html' : clean.replace(/^\/+/, '');
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const debugPort = 9224;
  const chrome = spawn(chromeBin, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--window-size=800,360',
    `--remote-debugging-port=${debugPort}`,
    `http://127.0.0.1:${port}/`,
  ], { stdio: 'ignore' });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let ws;
  try {
    let wsUrl = null;
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
        const pages = await res.json();
        const page = pages.find((p) => p.type === 'page' && p.webSocketDebuggerUrl);
        if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
      } catch {}
      await sleep(150);
    }
    assert.ok(wsUrl, 'Gagal terhubung ke Chromium CDP');

    ws = new WebSocket(wsUrl);
    await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });

    let seq = 1;
    const pending = new Map();
    const errors = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(msg.params.exceptionDetails.text);
      } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
        errors.push(msg.params.entry.text);
      }
    });

    const cdp = (method, params = {}) => {
      const id = seq++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    };
    const evalJS = async (expression) => {
      const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };

    await cdp('Runtime.enable');
    await cdp('Log.enable');
    await cdp('Emulation.setDeviceMetricsOverride', { width: 800, height: 360, deviceScaleFactor: 2, mobile: true });
    await sleep(600);

    // 1. Main menu & New Game
    assert.equal(await evalJS(`!document.getElementById('menu').classList.contains('hidden')`), true);
    await evalJS(`document.getElementById('menu-new').click()`);
    await sleep(350);
    assert.equal(await evalJS(`window.game.state.phase`), 'prep');

    // 2. Supplier beli stok
    await evalJS(`document.getElementById('prep-supplier').click()`);
    await sleep(150);
    await evalJS(`document.querySelector('.sup-act[data-id="air"][data-delta="5"]').click()`);
    const air0 = await evalJS(`window.game.inventory.stock('air')`);
    const money0 = await evalJS(`window.game.state.money`);
    await evalJS(`document.querySelector('#modal-actions .primary').click()`);
    await sleep(150);
    assert.equal(await evalJS(`window.game.inventory.stock('air')`), air0 + 5);
    assert.equal(await evalJS(`window.game.state.money`), money0 - 10000);

    // 3. Buka warung & kedatangan pelanggan otomatis
    await evalJS(`document.getElementById('btn-open').click()`);
    await sleep(1900);
    assert.ok((await evalJS(`window.game.customers.queue.length`)) >= 1);
    await evalJS(`
      window.game.customers.spawnTimer = 999;
      while (window.game.customers.queue.length > 1) {
        const ex = window.game.customers.queue.pop();
        window.game.customers.list = window.game.customers.list.filter((x) => x !== ex);
      }
      window.game.customers.queue[0].x = 353;
    `);
    await sleep(300);
    assert.equal(await evalJS(`window.game.customers.current()?.state`), 'ordering');

    // 4. Pesanan salah ditolak dengan kesempatan perbaiki
    const order = await evalJS(`window.game.customers.current().order`);
    const wrongId = ['air', 'mie', 'kopi', 'susu', 'keripik'].find((id) => !order[id]);
    if (wrongId) {
      await evalJS(`document.querySelector('.item-btn[data-id="${wrongId}"]').click()`);
      await evalJS(`document.getElementById('btn-submit').click()`);
      await sleep(120);
      assert.equal(await evalJS(`window.game.customers.current().state`), 'ordering');
      await evalJS(`document.getElementById('btn-clear').click()`);
    }

    // 5. Pesanan tepat -> pembayaran -> kembalian -> stok & saldo berubah
    const stockBefore = await evalJS(`Object.assign({}, window.game.state.stock)`);
    const moneyBefore = await evalJS(`window.game.state.money`);
    for (const [id, qty] of Object.entries(order)) {
      for (let i = 0; i < qty; i++) {
        await evalJS(`document.querySelector('.item-btn[data-id="${id}"]').click()`);
      }
    }
    await evalJS(`document.getElementById('btn-submit').click()`);
    await sleep(200);
    assert.equal(await evalJS(`window.game.customers.current().state`), 'paying');

    const pay = await evalJS(`({ total: window.game.customers.current().total, cash: window.game.customers.current().cash })`);
    let need = pay.cash - pay.total;
    for (const d of [20000, 10000, 5000, 2000, 1000, 500]) {
      while (need >= d) {
        await evalJS(`document.querySelector('.change-btn.denom-${d}').click()`);
        need -= d;
      }
    }
    await evalJS(`document.getElementById('btn-pay-give').click()`);
    await sleep(200);
    assert.equal(await evalJS(`window.game.state.money`), moneyBefore + pay.total);
    for (const [id, qty] of Object.entries(order)) {
      assert.equal(await evalJS(`window.game.state.stock['${id}']`), stockBefore[id] - qty);
    }

    // 6. Tutup warung -> Laporan Harian -> Hari 2
    await evalJS(`window.game.closeWarungEarly()`);
    await sleep(1100);
    assert.equal(await evalJS(`window.game.ui.modalType`), 'report');
    await evalJS(`document.querySelector('#modal-actions .primary').click()`);
    await sleep(200);
    assert.equal(await evalJS(`window.game.state.day`), 2);

    // 7. Reload -> Continue progres tersimpan
    await cdp('Page.reload');
    await sleep(600);
    assert.equal(await evalJS(`!document.getElementById('menu-continue').classList.contains('hidden')`), true);
    await evalJS(`document.getElementById('menu-continue').click()`);
    await sleep(300);
    assert.equal(await evalJS(`window.game.state.day`), 2);

    assert.equal(errors.length, 0, 'Console/page errors: ' + errors.join('; '));
    console.log('E2E PASS: Seluruh siklus gameplay & Acceptance Criteria terverifikasi (0 error).');
  } finally {
    if (ws) ws.close();
    chrome.kill();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
