/* ==========================================================
 * UIManager.js — Antarmuka HUD, panel bawah, menu utama,
 * notifikasi toast, dan modal (Supplier, Upgrade, Laporan,
 * Pengaturan, Jeda, Kredit, Cara Main). (PRD 8)
 * ========================================================== */
(function (global) {
  'use strict';
  const D = global.DATA;
  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function formatClock(min) {
    const h = Math.floor(min / 60);
    const m = Math.floor(min % 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  function formatStars(rep) {
    const filled = Math.round(rep / 20);
    return '★'.repeat(filled) + '☆'.repeat(Math.max(0, 5 - filled));
  }

  class UIManager {
    constructor(game) {
      this.game = game;
      this.modalType = null;
      this.supplierQty = {};
      this.el = {
        hud: $('hud'),
        money: $('hud-money'),
        day: $('hud-day'),
        clock: $('hud-clock'),
        rep: $('hud-rep'),
        toasts: $('toasts'),
        panel: $('panel'),
        panelPrep: $('panel-prep'),
        panelServe: $('panel-serve'),
        prepTitle: $('prep-title'),
        prepEvent: $('prep-event'),
        prepTarget: $('prep-target'),
        prepStockList: $('prep-stock-list'),
        custName: $('cust-name'),
        custType: $('cust-type'),
        custDialog: $('cust-dialog'),
        orderList: $('order-list'),
        itemGrid: $('item-grid'),
        changeGrid: $('change-grid'),
        cartView: $('cart-view'),
        cartTotal: $('cart-total'),
        cartList: $('cart-list'),
        payView: $('pay-view'),
        payTotal: $('pay-total'),
        payCash: $('pay-cash'),
        payHintRow: $('pay-hint-row'),
        payNeed: $('pay-need'),
        payGiven: $('pay-given'),
        btnSubmit: $('btn-submit'),
        btnClear: $('btn-clear'),
        btnHabis: $('btn-habis'),
        btnPayReset: $('btn-pay-reset'),
        btnPayGive: $('btn-pay-give'),
        menu: $('menu'),
        menuContinue: $('menu-continue'),
        menuNew: $('menu-new'),
        menuSettings: $('menu-settings'),
        menuCredits: $('menu-credits'),
        saveInfo: $('save-info'),
        modal: $('modal'),
        modalTitle: $('modal-title'),
        modalBody: $('modal-body'),
        modalActions: $('modal-actions'),
      };
      this.bindEvents();
      this.buildItemButtons();
      this.buildChangeButtons();
    }

    bindEvents() {
      const g = this.game;
      const tap = (id, fn) => {
        const node = $(id);
        if (!node) return;
        node.addEventListener('click', () => {
          g.audio.unlock();
          fn();
        });
      };

      tap('menu-continue', () => { g.audio.sfx('ui'); g.continueGame(); });
      tap('menu-new', () => { g.audio.sfx('ui'); g.requestNewGame(); });
      tap('menu-settings', () => { g.audio.sfx('ui'); this.openSettings(); });
      tap('menu-credits', () => { g.audio.sfx('ui'); this.openCredits(); });

      tap('btn-supplier', () => { g.audio.sfx('ui'); this.openSupplier(); });
      tap('btn-upgrade', () => { g.audio.sfx('ui'); this.openUpgrade(); });
      tap('btn-pause', () => { g.audio.sfx('ui'); this.openPause(); });

      tap('prep-supplier', () => { g.audio.sfx('ui'); this.openSupplier(); });
      tap('prep-upgrade', () => { g.audio.sfx('ui'); this.openUpgrade(); });
      tap('btn-open', () => { g.openWarung(); });

      tap('btn-clear', () => { g.clearCart(); });
      tap('btn-habis', () => { g.declareOutOfStock(); });
      tap('btn-submit', () => { g.submitOrder(); });

      tap('btn-pay-reset', () => { g.resetChange(); });
      tap('btn-pay-give', () => { g.giveChange(); });

      // Klik luar kartu modal untuk menutup modal non-kritis
      this.el.modal.addEventListener('click', (e) => {
        if (e.target === this.el.modal && this.modalType !== 'report' && this.modalType !== 'confirm') {
          g.audio.sfx('ui');
          this.closeModal();
        }
      });
    }

    // ---------- Bangun tombol statis ----------
    buildItemButtons() {
      const grid = this.el.itemGrid;
      grid.innerHTML = '';
      this.itemBtns = {};
      D.ITEMS.forEach((it) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'item-btn';
        btn.dataset.id = it.id;
        btn.innerHTML =
          '<span class="item-cart-badge hidden">0</span>' +
          '<img class="item-ico" src="' + Sprites.iconURL(it.id, 4) + '" alt="' + esc(it.name) + '" />' +
          '<span class="item-name">' + esc(it.name) + '</span>' +
          '<span class="item-meta"><span class="item-price"></span><span class="item-stock"></span></span>';
        btn.addEventListener('click', () => {
          this.game.audio.unlock();
          this.game.pickItem(it.id, false);
        });
        grid.appendChild(btn);
        this.itemBtns[it.id] = btn;
      });
    }

    buildChangeButtons() {
      const grid = this.el.changeGrid;
      grid.innerHTML = '';
      D.CHANGE_DENOMS.forEach((val) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'change-btn denom-' + val;
        btn.innerHTML =
          '<span class="denom-tag">' + (val <= 1000 ? 'Koin' : 'Uang') + '</span>' +
          '<span class="denom-val">' + D.formatRp(val) + '</span>';
        btn.addEventListener('click', () => {
          this.game.audio.unlock();
          this.game.addChange(val);
        });
        grid.appendChild(btn);
      });
    }

    // ---------- Tampilan layar utama ----------
    showMenu() {
      this.closeModal();
      this.el.menu.classList.remove('hidden');
      this.el.hud.classList.add('hidden');
      this.el.panel.classList.add('hidden');

      const res = SaveManager.load();
      if (res.ok) {
        const s = res.state;
        this.el.menuContinue.disabled = false;
        this.el.menuContinue.classList.remove('hidden');
        this.el.menuNew.classList.remove('primary');
        this.el.saveInfo.textContent =
          'Tersimpan: Hari ' + s.day + ' • ' + D.formatRp(s.money) + ' • Reputasi ' + s.reputation + '/100';
        this.el.saveInfo.classList.remove('err');
      } else if (res.empty) {
        this.el.menuContinue.disabled = true;
        this.el.menuContinue.classList.add('hidden');
        this.el.menuNew.classList.add('primary');
        this.el.saveInfo.textContent = 'Belum ada progres tersimpan. Mulai usaha warungmu!';
        this.el.saveInfo.classList.remove('err');
      } else {
        this.el.menuContinue.disabled = true;
        this.el.menuContinue.classList.add('hidden');
        this.el.menuNew.classList.add('primary');
        this.el.saveInfo.textContent = '⚠ Data simpan sebelumnya tidak valid (' + res.error + '). Silakan mulai permainan baru.';
        this.el.saveInfo.classList.add('err');
      }
      this.game.renderer.resize();
    }

    showGame() {
      this.el.menu.classList.add('hidden');
      this.el.hud.classList.remove('hidden');
      this.el.panel.classList.remove('hidden');
      this.renderAll();
      this.game.renderer.resize();
    }

    // ---------- Render HUD & Panel ----------
    renderAll() {
      if (!this.game.state) return;
      this.renderHUD();
      this.renderPanel();
    }

    renderHUD() {
      const g = this.game;
      const s = g.state;
      if (!s) return;
      this.el.money.textContent = D.formatRp(s.money);
      this.el.money.classList.toggle('low', s.money < 5000);
      this.el.day.textContent = 'Hari ' + s.day;
      this.el.clock.textContent = formatClock(s.clockMin) + (s.phase === 'closing' ? ' (Tutup)' : '');
      this.el.clock.classList.toggle('closing', s.phase === 'closing');
      this.el.rep.textContent = formatStars(s.reputation) + ' ' + s.reputation;
      this.el.rep.title = 'Reputasi: ' + s.reputation + '/100';
    }

    renderPanel() {
      const g = this.game;
      const s = g.state;
      if (!s) return;
      const isPrep = s.phase === 'prep';
      this.el.panelPrep.classList.toggle('hidden', !isPrep);
      this.el.panelServe.classList.toggle('hidden', isPrep);
      if (isPrep) this.renderPrep();
      else this.renderServe();
    }

    renderPrep() {
      const g = this.game;
      const s = g.state;
      this.el.prepTitle.textContent = 'Hari ' + s.day + ' — Persiapan Pagi';
      const evDef = D.EVENTS.find((e) => e.id === s.event.id) || D.EVENTS[0];
      let desc = evDef.desc;
      if (s.event.id === 'diskon' && s.event.itemId) {
        desc = desc.replace('{item}', D.itemById(s.event.itemId).name);
      }
      this.el.prepEvent.innerHTML =
        '<span class="ev-name">' + esc(evDef.name) + ':</span> ' + esc(desc);
      this.el.prepEvent.className = 'event-card ev-' + s.event.id;
      this.el.prepTarget.textContent =
        'Target penjualan: ' + D.formatRp(g.economy.target(s.day)) +
        ' • Biaya operasional: ' + D.formatRp(g.economy.operationalCost());

      const cap = g.inventory.capacity();
      this.el.prepStockList.innerHTML = D.ITEMS.map((it) => {
        const qty = g.inventory.stock(it.id);
        const cls = qty === 0 ? 'empty' : (qty <= 3 ? 'low' : '');
        return (
          '<div class="stock-pill ' + cls + '">' +
            '<img src="' + Sprites.iconURL(it.id, 3) + '" alt="" />' +
            '<span class="sp-name">' + esc(it.name) + '</span>' +
            '<b class="sp-qty">' + qty + '/' + cap + '</b>' +
          '</div>'
        );
      }).join('');
    }

    renderServe() {
      const g = this.game;
      const s = g.state;
      const cur = g.customers.current();
      const paying = !!(cur && cur.state === 'paying');

      // 1. Kotak pesanan & dialog
      if (cur) {
        this.el.custName.textContent = cur.name;
        this.el.custType.textContent = cur.typeLabel;
        this.el.custType.className = 'tag type-' + cur.type;
        this.el.custDialog.textContent = '"' + (cur.activeLine || cur.line) + '"';
        this.el.orderList.innerHTML = Object.keys(cur.order).map((id) => {
          const it = D.itemById(id);
          const want = cur.order[id];
          const got = paying ? want : g.transactions.inCart(id);
          const ok = got === want;
          const over = got > want;
          const stock = g.inventory.stock(id);
          const noStock = !paying && stock < want;
          const cls = ok ? 'done' : (over ? 'over' : (noStock ? 'nostock' : ''));
          return (
            '<div class="order-chip ' + cls + '">' +
              '<img src="' + Sprites.iconURL(id, 3) + '" alt="" />' +
              '<span>' + esc(it.name) + '</span>' +
              '<b>' + got + '/' + want + '</b>' +
            '</div>'
          );
        }).join('');
      } else {
        this.el.custName.textContent = s.phase === 'closing' ? 'Menutup Warung...' : 'Menunggu Pelanggan';
        this.el.custType.textContent = g.customers.queue.length ? 'Sedang jalan' : 'Santai';
        this.el.custType.className = 'tag';
        this.el.custDialog.textContent = s.phase === 'closing'
          ? 'Jam tutup tiba. Tunggu pelanggan terakhir keluar...'
          : (g.customers.queue.length ? 'Ada pelanggan menuju meja kasir!' : 'Belum ada pelanggan di kasir. Cek stok kalau sempat.');
        this.el.orderList.innerHTML = '';
      }

      // 2. Grid barang ATAU tombol kembalian
      this.el.itemGrid.classList.toggle('hidden', paying);
      this.el.changeGrid.classList.toggle('hidden', !paying);
      this.el.cartView.classList.toggle('hidden', paying);
      this.el.payView.classList.toggle('hidden', !paying);

      if (!paying) {
        D.ITEMS.forEach((it) => {
          const btn = this.itemBtns[it.id];
          const stock = g.inventory.stock(it.id);
          const inCart = g.transactions.inCart(it.id);
          const avail = stock - inCart;
          btn.querySelector('.item-price').textContent = D.formatRp(g.inventory.sellPrice(it.id));
          btn.querySelector('.item-stock').textContent = stock === 0 ? 'HABIS' : 'Stok ' + avail;
          btn.classList.toggle('out', avail <= 0);
          btn.classList.toggle('needed', !!(cur && cur.order[it.id] && inCart < cur.order[it.id]));
          const badge = btn.querySelector('.item-cart-badge');
          if (inCart > 0) {
            badge.textContent = '×' + inCart;
            badge.classList.remove('hidden');
          } else {
            badge.classList.add('hidden');
          }
        });

        // Keranjang
        const cart = g.transactions.cart;
        const ids = Object.keys(cart);
        this.el.cartTotal.textContent = D.formatRp(g.transactions.total());
        if (!ids.length) {
          this.el.cartList.innerHTML = '<span class="muted">Tap barang untuk ambil</span>';
        } else {
          this.el.cartList.innerHTML = '';
          ids.forEach((id) => {
            const it = D.itemById(id);
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'cart-chip';
            chip.title = 'Tap untuk kurangi 1';
            chip.innerHTML =
              '<img src="' + Sprites.iconURL(id, 3) + '" alt="" />' +
              '<span>' + esc(it.name) + ' ×' + cart[id] + '</span><span class="rm">−</span>';
            chip.addEventListener('click', () => {
              this.game.audio.unlock();
              this.game.removeFromCart(id);
            });
            this.el.cartList.appendChild(chip);
          });
        }
        this.el.btnSubmit.disabled = !cur || ids.length === 0;
        this.el.btnClear.disabled = ids.length === 0;
        this.el.btnHabis.disabled = !cur;
      } else {
        // Panel pembayaran & kembalian
        const need = cur.cash - cur.total;
        this.el.payTotal.textContent = D.formatRp(cur.total);
        this.el.payCash.textContent = D.formatRp(cur.cash);
        this.el.payHintRow.classList.toggle('hidden', !g.settings.easyChange && need > 0);
        this.el.payNeed.textContent = need === 0 ? 'Uang Pas!' : D.formatRp(need);
        this.el.payGiven.textContent = D.formatRp(cur.changeGiven);
        this.el.payGiven.classList.toggle('match', cur.changeGiven === need);
        this.el.btnPayReset.disabled = cur.changeGiven === 0;
        this.el.btnPayGive.textContent = need === 0 ? 'Terima ✓' : 'Berikan ✓';
      }
    }

    // ---------- Toast ----------
    toast(msg, kind) {
      const div = document.createElement('div');
      div.className = 'toast ' + (kind || 'info');
      div.textContent = msg;
      this.el.toasts.appendChild(div);
      while (this.el.toasts.children.length > 2) this.el.toasts.firstChild.remove();
      setTimeout(() => { div.classList.add('fade'); }, 2000);
      setTimeout(() => { if (div.parentNode) div.remove(); }, 2400);
    }

    // ---------- Sistem Modal ----------
    openModal(type, title, bodyHTML, actions) {
      this.modalType = type;
      this.el.modalTitle.textContent = title;
      this.el.modalBody.innerHTML = bodyHTML;
      this.el.modalActions.innerHTML = '';
      (actions || []).forEach((a) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn ' + (a.cls || '');
        btn.textContent = a.label;
        if (a.id) btn.id = a.id;
        if (a.disabled) btn.disabled = true;
        btn.addEventListener('click', () => {
          this.game.audio.unlock();
          if (!a.silent) this.game.audio.sfx('ui');
          a.onClick();
        });
        this.el.modalActions.appendChild(btn);
      });
      this.el.modal.classList.remove('hidden');
      this.game.onModalChange(true);
    }

    closeModal() {
      if (!this.modalType) return;
      this.modalType = null;
      this.el.modal.classList.add('hidden');
      this.game.onModalChange(false);
    }

    // ---------- Modal: Supplier (PRD 5.4) ----------
    openSupplier() {
      this.supplierQty = {};
      D.ITEMS.forEach((it) => { this.supplierQty[it.id] = 0; });
      this.renderSupplierModal();
    }

    renderSupplierModal() {
      const g = this.game;
      const s = g.state;
      const cap = g.inventory.capacity();
      let grand = 0;
      D.ITEMS.forEach((it) => { grand += (this.supplierQty[it.id] || 0) * g.inventory.buyPrice(it.id); });

      const evBanner = s.event.id === 'diskon' && s.event.itemId
        ? '<div class="banner-ok">🏷 Diskon Supplier 30% untuk <b>' + esc(D.itemById(s.event.itemId).name) + '</b> hari ini!</div>'
        : '';

      const rows = D.ITEMS.map((it) => {
        const st = g.inventory.stock(it.id);
        const space = g.inventory.spaceFor(it.id);
        const q = this.supplierQty[it.id] || 0;
        const price = g.inventory.buyPrice(it.id);
        const discounted = price < it.buy;
        const sub = q * price;
        return (
          '<div class="sup-row" data-id="' + it.id + '">' +
            '<img class="sup-ico" src="' + Sprites.iconURL(it.id, 4) + '" alt="" />' +
            '<div class="sup-info">' +
              '<div class="sup-name">' + esc(it.name) + ' <span class="sup-st">(' + st + '/' + cap + ')</span></div>' +
              '<div class="sup-price">' +
                (discounted ? '<s class="old-p">' + D.formatRp(it.buy) + '</s> <b class="disc">' + D.formatRp(price) + '</b>' : D.formatRp(price)) +
                ' • Jual ' + D.formatRp(g.inventory.sellPrice(it.id)) +
              '</div>' +
            '</div>' +
            '<div class="sup-ctrl">' +
              '<button type="button" class="btn tiny sup-act" data-id="' + it.id + '" data-delta="-1" ' + (q <= 0 ? 'disabled' : '') + '>−1</button>' +
              '<span class="sup-q">' + q + '</span>' +
              '<button type="button" class="btn tiny sup-act" data-id="' + it.id + '" data-delta="1" ' + (q >= space ? 'disabled' : '') + '>+1</button>' +
              '<button type="button" class="btn tiny sup-act" data-id="' + it.id + '" data-delta="5" ' + (q >= space ? 'disabled' : '') + '>+5</button>' +
            '</div>' +
            '<div class="sup-sub">' + D.formatRp(sub) + '</div>' +
          '</div>'
        );
      }).join('');

      const cantAfford = grand > s.money;
      const body =
        '<div class="modal-bar"><span>Saldo: <b class="' + (cantAfford ? 'err' : 'ok') + '">' + D.formatRp(s.money) + '</b></span>' +
        '<span>Total Beli: <b>' + D.formatRp(grand) + '</b></span></div>' +
        evBanner +
        '<div class="sup-list">' + rows + '</div>' +
        (cantAfford ? '<div class="banner-err">Saldo tidak cukup untuk jumlah ini!</div>' : '');

      this.openModal('supplier', '📦 Belanja Supplier', body, [
        { label: 'Tutup', onClick: () => this.closeModal() },
        {
          label: 'Konfirmasi Beli (' + D.formatRp(grand) + ')',
          cls: 'primary',
          disabled: grand <= 0 || cantAfford,
          silent: true,
          onClick: () => {
            if (g.buyStockBatch(this.supplierQty)) {
              this.closeModal();
            }
          },
        },
      ]);

      this.el.modalBody.querySelectorAll('.sup-act').forEach((btn) => {
        btn.addEventListener('click', () => {
          g.audio.sfx('ui');
          const id = btn.dataset.id;
          const d = parseInt(btn.dataset.delta, 10);
          const max = g.inventory.spaceFor(id);
          this.supplierQty[id] = Math.max(0, Math.min(max, (this.supplierQty[id] || 0) + d));
          this.renderSupplierModal();
        });
      });
    }

    // ---------- Modal: Upgrade (PRD 6.2) ----------
    openUpgrade() {
      const g = this.game;
      const s = g.state;
      const rows = D.UPGRADES.map((u) => {
        const owned = !!s.upgrades[u.id];
        const can = !owned && s.money >= u.cost;
        return (
          '<div class="upg-row ' + (owned ? 'owned' : '') + '">' +
            '<div class="upg-info">' +
              '<div class="upg-name">' + esc(u.name) + '</div>' +
              '<div class="upg-desc">' + esc(u.desc) + '</div>' +
            '</div>' +
            '<div class="upg-act">' +
              (owned
                ? '<span class="badge-owned">✓ Dimiliki</span>'
                : '<button type="button" class="btn small ' + (can ? 'primary' : '') + ' upg-buy" data-id="' + u.id + '" ' + (!can ? 'disabled' : '') + '>' + D.formatRp(u.cost) + '</button>') +
            '</div>' +
          '</div>'
        );
      }).join('');

      const body =
        '<div class="modal-bar"><span>Saldo: <b class="ok">' + D.formatRp(s.money) + '</b></span>' +
        '<span>Kapasitas stok: <b>' + g.inventory.capacity() + '/barang</b></span></div>' +
        '<div class="upg-list">' + rows + '</div>';

      this.openModal('upgrade', '🔨 Upgrade Warung', body, [
        { label: 'Tutup', cls: 'primary', onClick: () => this.closeModal() },
      ]);

      this.el.modalBody.querySelectorAll('.upg-buy').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (g.buyUpgrade(btn.dataset.id)) this.openUpgrade();
        });
      });
    }

    // ---------- Modal: Laporan Harian (PRD 4, 5.5, 6.1) ----------
    openReport(rep) {
      const g = this.game;
      const soldRows = D.ITEMS.map((it) => {
        const n = rep.sold[it.id] || 0;
        return '<span class="sold-pill">' + esc(it.name) + ': <b>' + n + '</b></span>';
      }).join('');

      const profitCls = rep.netProfit >= 0 ? 'ok' : 'err';
      const body =
        '<div class="rep-grid">' +
          '<div class="rep-sec">' +
            '<h4>Keuangan</h4>' +
            '<div class="rep-line"><span>Pendapatan Penjualan</span><b>' + D.formatRp(rep.revenue) + '</b></div>' +
            '<div class="rep-line"><span>Harga Pokok (HPP)</span><span>−' + D.formatRp(rep.cogs) + '</span></div>' +
            '<div class="rep-line strong"><span>Keuntungan Kotor</span><b>' + D.formatRp(rep.grossProfit) + '</b></div>' +
            '<div class="rep-line"><span>Biaya Operasional</span><span>−' + D.formatRp(rep.operational) + '</span></div>' +
            (rep.changeLoss > 0 ? '<div class="rep-line err"><span>Kelebihan Kembalian</span><span>−' + D.formatRp(rep.changeLoss) + '</span></div>' : '') +
            '<div class="rep-line strong ' + profitCls + '"><span>Keuntungan Bersih</span><b>' + D.formatRp(rep.netProfit) + '</b></div>' +
            '<div class="rep-line muted"><span>Belanja Stok / Upgrade</span><span>' + D.formatRp(rep.stockSpend + rep.upgradeSpend) + '</span></div>' +
          '</div>' +
          '<div class="rep-sec">' +
            '<h4>Pelayanan & Target</h4>' +
            '<div class="rep-line"><span>Pelanggan Dilayani</span><b class="ok">' + rep.served + '</b></div>' +
            '<div class="rep-line"><span>Pelanggan Kabur</span><b class="' + (rep.angry ? 'err' : '') + '">' + rep.angry + '</b></div>' +
            '<div class="rep-line"><span>Stok Habis / Salah</span><span>' + rep.outOfStock + ' / ' + rep.wrong + '</span></div>' +
            '<div class="rep-line"><span>Target (' + D.formatRp(rep.target) + ')</span>' +
              '<b class="' + (rep.reached ? 'ok' : 'warn') + '">' + (rep.reached ? 'Tercapai! (+2 Rep)' : 'Belum') + '</b></div>' +
            '<div class="rep-line strong"><span>Saldo Akhir</span><b>' + D.formatRp(rep.endMoney) + '</b></div>' +
            '<div class="rep-line"><span>Reputasi</span><b>' + rep.endRep + '/100 (' + formatStars(rep.endRep) + ')</b></div>' +
          '</div>' +
        '</div>' +
        '<div class="sold-box"><span>Terjual:</span> ' + soldRows + '</div>';

      this.openModal('report', '📊 Laporan Hari ' + rep.day, body, [
        { label: 'Lanjut ke Hari ' + (rep.day + 1) + ' ▶', cls: 'primary big', onClick: () => g.nextDay() },
      ]);
    }

    // ---------- Modal: Pause ----------
    openPause() {
      const g = this.game;
      const s = g.state;
      const canCloseEarly = s && s.phase === 'open';
      const body =
        '<div class="pause-meta">Hari ' + s.day + ' • ' + formatClock(s.clockMin) + ' • Saldo ' + D.formatRp(s.money) + '</div>' +
        '<div class="pause-grid">' +
          '<button type="button" class="btn primary big" id="p-resume">▶ Lanjutkan</button>' +
          (canCloseEarly ? '<button type="button" class="btn warn" id="p-close">🔒 Tutup Warung Hari Ini</button>' : '') +
          '<button type="button" class="btn" id="p-save">💾 Simpan Progres</button>' +
          '<button type="button" class="btn" id="p-settings">⚙ Pengaturan</button>' +
          '<button type="button" class="btn" id="p-help">❓ Cara Bermain</button>' +
          '<button type="button" class="btn danger" id="p-menu">🏠 Ke Menu Utama</button>' +
        '</div>';

      this.openModal('pause', '⏸ Permainan Dijeda', body, []);

      const wire = (id, fn) => {
        const b = $(id);
        if (b) b.addEventListener('click', () => { g.audio.sfx('ui'); fn(); });
      };
      wire('p-resume', () => this.closeModal());
      wire('p-close', () => { this.closeModal(); g.closeWarungEarly(); });
      wire('p-save', () => {
        SaveManager.save(g.state);
        this.toast('Progres berhasil disimpan!', 'ok');
      });
      wire('p-settings', () => this.openSettings(true));
      wire('p-help', () => this.openHelp(true));
      wire('p-menu', () => {
        SaveManager.save(g.state);
        g.returnToMenu();
      });
    }

    // ---------- Modal: Pengaturan (PRD 8.1 & 9) ----------
    openSettings(fromPause) {
      const g = this.game;
      const st = g.settings;
      const body =
        '<div class="set-list">' +
          '<label class="set-row"><span>🎵 Volume Musik (<b id="v-mus">' + Math.round(st.music * 100) + '%</b>)</span>' +
            '<input type="range" id="rng-mus" min="0" max="100" value="' + Math.round(st.music * 100) + '" /></label>' +
          '<label class="set-row"><span>🔊 Volume Efek Suara (<b id="v-sfx">' + Math.round(st.sfx * 100) + '%</b>)</span>' +
            '<input type="range" id="rng-sfx" min="0" max="100" value="' + Math.round(st.sfx * 100) + '" /></label>' +
          '<label class="set-row check"><span>🧮 Tampilkan Bantuan Hitung Kembalian</span>' +
            '<input type="checkbox" id="chk-easy" ' + (st.easyChange ? 'checked' : '') + ' /></label>' +
          '<label class="set-row"><span>⏱ Durasi 1 Hari</span>' +
            '<select id="sel-speed">' +
              '<option value="1" ' + (st.daySpeed === 1 ? 'selected' : '') + '>Normal (5 menit — standar PRD)</option>' +
              '<option value="2" ' + (st.daySpeed === 2 ? 'selected' : '') + '>Cepat (2,5 menit)</option>' +
            '</select></label>' +
        '</div>';

      const acts = [];
      if (!fromPause && SaveManager.hasSave()) {
        acts.push({
          label: '🗑 Hapus Data Simpan',
          cls: 'danger',
          onClick: () => this.openConfirm(
            'Hapus Data Simpan?',
            'Semua progres warung yang tersimpan akan dihapus permanen.',
            () => { SaveManager.clear(); this.toast('Data simpan dihapus.', 'info'); this.showMenu(); },
            () => this.openSettings(false)
          ),
        });
      }
      acts.push({
        label: fromPause ? 'Kembali' : 'Simpan & Tutup',
        cls: 'primary',
        onClick: () => { if (fromPause) this.openPause(); else this.closeModal(); },
      });

      this.openModal('settings', '⚙ Pengaturan', body, acts);

      const rngMus = $('rng-mus');
      const rngSfx = $('rng-sfx');
      const chkEasy = $('chk-easy');
      const selSpeed = $('sel-speed');
      rngMus.addEventListener('input', () => {
        st.music = parseInt(rngMus.value, 10) / 100;
        $('v-mus').textContent = rngMus.value + '%';
        g.applySettings();
      });
      rngSfx.addEventListener('input', () => {
        st.sfx = parseInt(rngSfx.value, 10) / 100;
        $('v-sfx').textContent = rngSfx.value + '%';
        g.applySettings();
      });
      rngSfx.addEventListener('change', () => g.audio.sfx('coin'));
      chkEasy.addEventListener('change', () => { st.easyChange = chkEasy.checked; g.applySettings(); });
      selSpeed.addEventListener('change', () => { st.daySpeed = parseInt(selSpeed.value, 10) || 1; g.applySettings(); });
    }

    // ---------- Modal: Kredit (PRD 8.1) ----------
    openCredits() {
      const body =
        '<div class="credits">' +
          '<h3>WARUNG SIMULATOR 2D</h3>' +
          '<p class="quote">"Modal pas-pasan, pelanggan banyak maunya."</p>' +
          '<p>Game simulasi mengelola warung kelontong khas Indonesia bergaya 2D Pixel Art 16-bit.</p>' +
          '<div class="cred-meta">' +
            '<div><b>Versi:</b> 1.1 (MVP)</div>' +
            '<div><b>Teknologi:</b> HTML5, CSS3, JavaScript, Canvas API, Web Audio API, Capacitor Android</div>' +
            '<div><b>Penyimpanan:</b> Lokal (Offline)</div>' +
          '</div>' +
        '</div>';
      this.openModal('credits', 'ℹ Kredit', body, [
        { label: 'Tutup', cls: 'primary', onClick: () => this.closeModal() },
      ]);
    }

    // ---------- Modal: Cara Bermain ----------
    openHelp(fromPause) {
      const body =
        '<ol class="help-list">' +
          '<li><b>Persiapan Pagi:</b> Cek stok barang & beli ke <b>📦 Supplier</b> bila kurang, lalu tekan <b>🏪 Buka Warung</b>.</li>' +
          '<li><b>Layani Pelanggan:</b> Lihat pesanan pelanggan, lalu tap barang pada panel bawah <i>atau langsung tap rak di warung</i>.</li>' +
          '<li><b>Keranjang & Bayar:</b> Tap barang di keranjang untuk mengurangi. Tekan <b>Selesai ✓</b>, lalu berikan kembalian yang pas.</li>' +
          '<li><b>Kembangkan Warung:</b> Jika barang habis, beli cepat di Supplier (game otomatis jeda) atau tekan <b>Habis</b>. Kumpulkan untung untuk <b>🔨 Upgrade</b>!</li>' +
        '</ol>';
      this.openModal('help', '❓ Cara Bermain', body, [
        { label: fromPause ? 'Kembali' : 'Mengerti!', cls: 'primary', onClick: () => (fromPause ? this.openPause() : this.closeModal()) },
      ]);
    }

    // ---------- Modal: Konfirmasi ----------
    openConfirm(title, message, onYes, onNo) {
      this.openModal('confirm', title, '<p class="confirm-msg">' + esc(message) + '</p>', [
        { label: 'Batal', onClick: () => { if (onNo) onNo(); else this.closeModal(); } },
        { label: 'Ya, Lanjutkan', cls: 'primary', onClick: () => { this.closeModal(); onYes(); } },
      ]);
    }
  }

  global.UIManager = UIManager;
})(typeof window !== 'undefined' ? window : globalThis);
