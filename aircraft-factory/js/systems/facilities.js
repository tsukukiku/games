// 設備。購入と床への配置、1日あたりの能力。
// state.facilities = { 設備id: 台数 }(ルール側はこれを見る)/ state.layout = [{ uid, type, x, y }](床の上の位置)。
// 台数と配置は常に一致させる(buy が両方を更新する)。
(function (AF) {
  'use strict';
  var facilities = {};
  function C() { return AF.data.CONFIG; }
  function IDX() { return AF.data.index; }

  facilities.count = function (state, id) { return state.facilities[id] || 0; };
  facilities.totalCount = function (state) {
    var n = 0;
    Object.keys(state.facilities).forEach(function (id) { n += state.facilities[id]; });
    return n;
  };

  // 次の1台の購入費(同じ設備は買うほど高くなる)
  facilities.cost = function (state, id) {
    var f = IDX().facilities[id];
    return Math.round(f.cost * (1 + C().FACILITY_COST_STEP * facilities.count(state, id)));
  };

  // その種類の設備全体の、1日あたりの能力(工数)。研究による倍率は state.facilityMods に入る。
  facilities.capacity = function (state, id) {
    var f = IDX().facilities[id];
    var mod = state.facilityMods[id];
    return facilities.count(state, id) * f.capacity * (mod && mod.capMul ? mod.capMul : 1);
  };
  facilities.dailyCapacityTotal = function (state) {
    var total = 0;
    AF.data.FACILITIES.forEach(function (f) { total += facilities.capacity(state, f.id); });
    return total;
  };

  // 保有設備の効果のうち、掛け算で効くもの(例: 検査設備の defectMul)
  facilities.effectMul = function (state, key) {
    var mul = 1;
    AF.data.FACILITIES.forEach(function (f) {
      if (facilities.count(state, f.id) > 0 && f.effect && f.effect[key] != null) mul *= f.effect[key];
    });
    return mul;
  };

  // ---- 床の上の配置 ----
  // 升目 (x, y) にある設備(なければ null)
  facilities.at = function (state, x, y) {
    for (var i = 0; i < state.layout.length; i++) {
      var p = state.layout[i], s = IDX().facilities[p.type].size;
      if (x >= p.x && x < p.x + s[0] && y >= p.y && y < p.y + s[1]) return p;
    }
    return null;
  };
  // type を (x, y) を左上にして置けるか。ignoreUid は移動中の自分自身。
  facilities.canPlace = function (state, type, x, y, ignoreUid) {
    var G = C().GRID, s = IDX().facilities[type].size;
    if (x < 0 || y < 0 || x + s[0] > G.w || y + s[1] > G.h) return false;
    for (var dx = 0; dx < s[0]; dx++) for (var dy = 0; dy < s[1]; dy++) {
      var hit = facilities.at(state, x + dx, y + dy);
      if (hit && hit.uid !== ignoreUid) return false;
    }
    return true;
  };
  // 空いている場所を探す(中央寄りから)
  facilities.findSpot = function (state, type) {
    var G = C().GRID, best = null, bestD = Infinity;
    for (var y = 1; y < G.h; y += 1) for (var x = 1; x < G.w; x += 1) {
      if (!facilities.canPlace(state, type, x, y)) continue;
      var d = Math.abs(x - G.w / 2 + 1) + Math.abs(y - G.h / 2 + 1) + ((x + y) % 2 ? 0.5 : 0);
      if (d < bestD) { bestD = d; best = { x: x, y: y }; }
    }
    return best;
  };
  function addPlacement(state, type, x, y) {
    state.layoutSeq += 1;
    var p = { uid: 'F' + state.layoutSeq, type: type, x: x, y: y };
    state.layout.push(p);
    return p;
  }
  // 台数に対して配置が足りない設備を、自動で床に置く(開始時・古いセーブ用)
  facilities.syncLayout = function (state) {
    AF.data.FACILITIES.forEach(function (f) {
      var placed = state.layout.filter(function (p) { return p.type === f.id; }).length;
      for (var i = placed; i < facilities.count(state, f.id); i++) {
        var spot = facilities.findSpot(state, f.id);
        if (spot) addPlacement(state, f.id, spot.x, spot.y);
      }
    });
  };

  // 購入して (x, y) に置く。x, y を省くと空いている場所に置く(自動プレイ用)。
  facilities.buy = function (state, id, x, y) {
    var f = IDX().facilities[id];
    if (!f) return { ok: false, reason: '不明な設備です' };
    if (facilities.count(state, id) >= f.maxCount) return { ok: false, reason: f.name + 'はこれ以上置けません' };
    if (x == null) {
      var spot = facilities.findSpot(state, id);
      if (!spot) return { ok: false, reason: '置ける場所がありません' };
      x = spot.x; y = spot.y;
    }
    if (!facilities.canPlace(state, id, x, y)) return { ok: false, reason: 'そこには置けません' };
    var cost = facilities.cost(state, id);
    if (!AF.systems.economy.canAfford(state, cost)) return { ok: false, reason: '資金が不足しています' };
    AF.systems.economy.spend(state, cost, 'facilities');
    state.facilities[id] = facilities.count(state, id) + 1;
    var p = addPlacement(state, id, x, y);
    AF.core.log.add(state, f.name + 'を設置した(' + AF.core.util.money(cost) + ')。', 'info');
    AF.core.log.fx(state, 'build', { uid: p.uid, facility: id });
    return { ok: true, uid: p.uid };
  };

  // 置き直す(無料)
  facilities.move = function (state, uid, x, y) {
    var p = state.layout.filter(function (q) { return q.uid === uid; })[0];
    if (!p) return { ok: false, reason: '設備が見つかりません' };
    if (!facilities.canPlace(state, p.type, x, y, uid)) return { ok: false, reason: 'そこには置けません' };
    p.x = x; p.y = y;
    return { ok: true };
  };

  AF.systems.facilities = facilities;
})(window.AF);
