// 「生産」パネル: 設備を選び、作るものをアイコンから選んでキューに入れる。下にキューの一覧。
(function (AF) {
  'use strict';
  var ui = AF.ui, U = AF.core.util, S = AF.systems;
  function C() { return AF.data.CONFIG; }
  function IDX() { return AF.data.index; }
  function state() { return AF.core.store.state; }
  var esc = ui.esc;

  function producers(st) {
    return AF.data.FACILITIES.filter(function (f) { return f.capacity > 0 && st.facilities[f.id] > 0; });
  }

  // その設備で作れるものの一覧
  function items(st, fac) {
    var out = AF.data.PARTS.filter(function (p) { return p.facility === fac; }).map(function (p) {
      return { kind: 'part', id: p.id, name: p.name, icon: ui.pix.icon(p.id, 32), locked: !S.production.partUnlocked(st, p.id) };
    });
    if (st.phase >= 2) {
      AF.data.UNITS.forEach(function (u) {
        if (u.facility === fac && st.unlockedUnits[u.id]) out.push({ kind: 'unit', id: u.id, name: u.name, icon: ui.pix.icon('unit:' + u.id, 56) });
      });
      if (fac === C().AIRCRAFT_ASSEMBLY.facility) {
        st.designs.forEach(function (d) { out.push({ kind: 'aircraft', id: d.id, name: d.name, icon: ui.aircraftPixel.html(d.slots, 110) }); });
      }
    }
    return out;
  }

  function jobIcon(j, px) {
    if (j.kind === 'part') return ui.pix.icon(j.itemId, px);
    if (j.kind === 'unit') return ui.pix.icon('unit:' + j.itemId, px * 1.5);
    var d = S.aircraft.getDesign(state(), j.itemId);
    return d ? ui.aircraftPixel.html(d.slots, 88) : ui.pix.icon('plane', px);
  }

  // 選択中の品目に必要なもの(数量の入力中は、ここだけ更新する)
  function jobInfo(st) {
    var f = ui.form.job;
    var recipe = f.item ? S.production.getRecipe(st, f.kind, f.item) : null;
    if (!recipe) return '';
    var qty = Math.max(1, Math.floor(f.qty || 1));
    var req = S.production.requirements(st, recipe, qty);
    var days = S.production.estimateDays(st, recipe.facility, recipe.work * qty);
    var needs = [];
    Object.keys(req.materials).forEach(function (id) {
      var have = (st.materials[id] || 0) + S.economy.quotaAvailable(st, id);
      needs.push(ui.res(id, U.fmt1(req.materials[id]), have + 1e-9 < req.materials[id] ? 'bad' : '', IDX().materials[id].name));
    });
    Object.keys(req.parts).forEach(function (id) {
      var have = st.inventory.parts[id] || 0;
      needs.push(ui.res(id, req.parts[id] + '<i>/' + have + '</i>', have < req.parts[id] ? 'bad' : '', IDX().parts[id].name + '(必要/在庫)'));
    });
    Object.keys(req.units).forEach(function (id) {
      var have = st.inventory.units[id] || 0;
      needs.push('<span class="res ' + (have < req.units[id] ? 'bad' : '') + '" title="' + esc(IDX().units[id].name) + '(必要/在庫)">' + ui.pix.icon('unit:' + id, 32) + '<b>' + req.units[id] + '<i>/' + have + '</i></b></span>');
    });
    return '<div class="row">' + ui.res('clock', isFinite(days) ? days + '日' : '—', '', '目安の日数') +
      ui.res('work', U.fmt1(recipe.work * qty), '', '工数') +
      '<span class="res" title="不良率">不良 ' + Math.round(S.production.defectRate(st, recipe) * 100) + '%</span></div>' +
      '<div class="row needs">' + needs.join('') + '</div>';
  }
  ui.live['job.info'] = function () {
    var el = document.getElementById('job-info');
    if (el && state()) el.innerHTML = jobInfo(state());
  };

  var STATUS = { queued: ['待ち', ''], waiting: ['不足', 'bad'], active: ['作業中', 'good'], rework: ['手直し', 'warn'] };

  function render(st) {
    var f = ui.form.job, facs = producers(st);
    if (!facs.some(function (x) { return x.id === f.facility; })) { f.facility = facs.length ? facs[0].id : ''; f.item = ''; }
    var list = f.facility ? items(st, f.facility) : [];
    if (!list.some(function (i) { return i.id === f.item && i.kind === f.kind && !i.locked; })) {
      var first = list.filter(function (i) { return !i.locked; })[0];
      f.item = first ? first.id : ''; f.kind = first ? first.kind : 'part';
    }

    var tabs = '<div class="seg">' + facs.map(function (x) {
      return '<button class="' + (f.facility === x.id ? 'on' : '') + '" data-action="job.fac" data-id="' + x.id + '">' + ui.pix.icon('fac_' + x.id, 32) + x.name + '</button>';
    }).join('') + '</div>';

    var grid = '<div class="tiles">' + list.map(function (i) {
      var sel = i.id === f.item && i.kind === f.kind;
      return '<button class="tile ' + (sel ? 'on ' : '') + (i.locked ? 'locked ' : '') + (i.kind !== 'part' ? 'wide' : '') + '" data-action="job.pick" data-kind="' + i.kind + '" data-id="' + i.id + '" title="' + esc(i.name) + '">' +
        i.icon + (i.locked ? '<span class="lock">' + ui.pix.icon('lock', 16) + '</span>' : '') + '<span>' + esc(i.name) + '</span></button>';
    }).join('') + '</div>';

    var form = f.item ? '<div class="order"><div class="row">' +
      '<button data-action="job.qty" data-d="-10">-10</button><button data-action="job.qty" data-d="-1">-1</button>' +
      '<input type="text" class="qty" id="job-qty" inputmode="numeric" maxlength="4" data-numeric data-input="job.qty" data-live="job.info" value="' + (f.qty || '') + '">' +
      '<button data-action="job.qty" data-d="1">+1</button><button data-action="job.qty" data-d="10">+10</button>' +
      '<button class="primary big" data-action="job.add">つくる</button></div>' +
      '<div id="job-info">' + jobInfo(st) + '</div></div>' : '<p class="hint">この設備で作れるものがありません。</p>';

    var rows = st.jobs.map(function (j, i) {
      var s = STATUS[j.status] || [j.status, ''];
      return '<div class="job ' + j.status + '"><span class="ic">' + jobIcon(j, 32) + '</span>' +
        '<span class="main"><b>' + esc(j.name) + ' ×' + j.qty + '</b>' +
        '<span class="pbar ' + (j.status === 'active' ? 'run' : '') + '"><i style="width:' + Math.round((j.workTotal ? j.workDone / j.workTotal : 0) * 100) + '%"></i></span>' +
        (j.note ? '<span class="sub ' + (j.status === 'waiting' ? 'bad' : '') + '">' + esc(j.note) + '</span>' : '') + '</span>' +
        '<span class="side">' + ui.pix.icon('fac_' + j.facility, 32) + ui.tag(s[0], s[1]) + '</span>' +
        '<span class="btns"><button data-action="job.top" data-id="' + j.id + '" title="最優先" ' + (i === 0 ? 'disabled' : '') + '>⤒</button>' +
        '<button data-action="job.move" data-id="' + j.id + '" data-dir="-1" title="上へ" ' + (i === 0 ? 'disabled' : '') + '>↑</button>' +
        '<button data-action="job.move" data-id="' + j.id + '" data-dir="1" title="下へ" ' + (i === st.jobs.length - 1 ? 'disabled' : '') + '>↓</button>' +
        '<button data-action="job.cancel" data-id="' + j.id + '" title="取り消す">✕</button></span></div>';
    }).join('');

    return (facs.length ? tabs + grid + form : '<p class="hint">生産できる設備がありません。「建設」から置いてください。</p>') +
      '<h3>キュー <i>' + st.jobs.length + '件</i></h3>' + (rows || '<p class="hint">キューは空です。</p>') +
      '<p class="hint">設備ごとに、上から順に進みます。材料が足りないものは飛ばされます。</p>';
  }

  ui.on('job.fac', function (ds) { ui.form.job.facility = ds.id; ui.form.job.item = ''; });
  ui.on('job.pick', function (ds) {
    var st = state();
    if (ds.kind === 'part' && !S.production.partUnlocked(st, ds.id)) {
      var node = IDX().research[IDX().parts[ds.id].research];
      return { ok: false, reason: '研究「' + node.name + '」が必要です' };
    }
    var changed = ui.form.job.kind !== ds.kind;
    ui.form.job.kind = ds.kind; ui.form.job.item = ds.id;
    if (changed) ui.form.job.qty = ds.kind === 'part' ? 20 : 1;
  });
  ui.on('job.qty', function (ds) { ui.form.job.qty = U.clamp((Math.floor(ui.form.job.qty) || 0) + Number(ds.d), 1, 2000); });
  ui.on('job.add', function () { return S.production.addJob(state(), ui.form.job.kind, ui.form.job.item, ui.form.job.qty); });
  ui.on('job.cancel', function (ds) { return S.production.cancelJob(state(), ds.id); });
  ui.on('job.move', function (ds) { return S.production.moveJob(state(), ds.id, Number(ds.dir)); });
  ui.on('job.top', function (ds) { return S.production.prioritizeJob(state(), ds.id); });

  ui.panels.jobs = { id: 'jobs', label: '生産', icon: 'jobs', render: render,
    badge: function (st) { return st.jobs.some(function (j) { return j.status === 'waiting'; }) ? '!' : ''; } };
})(window.AF);
