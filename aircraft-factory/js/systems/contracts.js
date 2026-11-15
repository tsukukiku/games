// 受注。毎月の契約提示、受注・見送り、納入、納期の管理、スポット販売。
//
// 契約: { id, kind: 'part'|'aircraft', buyerId, itemId(部品id / 機体は仕様id), name, qty, delivered,
//         unitPrice, offeredDay, deadlineDay, late, status, minSpec?, mission?, grant, advanceRate }
// 機体契約は受注時に前渡金(advanceRate)を受け取り、残りを納入のつど受け取る。
// status: offered / active / done / done_late / failed
(function (AF) {
  'use strict';
  var U = AF.core.util, L = AF.core.log;
  var contracts = {};
  function C() { return AF.data.CONFIG; }
  function IDX() { return AF.data.index; }
  function K() { return C().CONTRACT; }

  // ---- 評価と関係値 ----
  contracts.changeRating = function (state, delta) {
    if (delta > 0) delta *= Math.min(1, (100 - state.rlmRating) / C().RATING.gainSoftCap); // 高評価ほど上がりにくい
    state.rlmRating = U.clamp(state.rlmRating + delta, 0, 100);
  };
  contracts.changeRelation = function (state, companyId, delta) {
    if (state.relations[companyId] == null) return;
    state.relations[companyId] = U.clamp(state.relations[companyId] + delta, 0, 100);
  };

  // ---- 契約配分の重み(0〜1): 評価・生産能力・納期達成率 ----
  contracts.onTimeRate = function (state) {
    var s = state.contractStats, n = s.onTime + s.late + s.failed;
    return n ? s.onTime / n : K().defaultOnTimeRate;
  };
  contracts.weight = function (state) {
    var W = K().weight;
    var cap = Math.min(1, AF.systems.facilities.dailyCapacityTotal(state) / W.capacityRef);
    return W.rating * (state.rlmRating / 100) + W.capacity * cap + W.onTime * contracts.onTimeRate(state);
  };

  // 市場規模の倍率(初月=1)。RLMの総発注量のカーブに沿う。
  contracts.demandMul = function (state) {
    var curve = AF.data.MARKET.aircraftCurve;
    return U.curveAt(curve, U.monthIndex(state.day)) / curve[0][1];
  };

  function make(state, fields) {
    state.contractSeq += 1;
    var c = { id: 'C' + state.contractSeq, delivered: 0, offeredDay: state.day, late: false, status: 'offered' };
    Object.keys(fields).forEach(function (k) { c[k] = fields[k]; });
    return c;
  }

  // ---- 月初: 契約の提示(前月の提示分は流れる) ----
  contracts.generateMonthlyOffers = function (state) {
    var k = K(), w = contracts.weight(state), demand = contracts.demandMul(state);
    var share = AF.systems.rivals.playerAllocationFactor(state); // 段階4でライバルとの競争を反映する
    var offers = [];

    // 部品契約
    var n = U.clamp(Math.round((k.partOffersBase + w * k.partOffersPerWeight) * demand * share * state.modifiers.partDemand),
                    k.partOffersMin, k.partOffersMax);
    var buyers = AF.data.COMPANIES.filter(function (c) { return c.buysParts; });
    var owned = AF.data.PARTS.filter(function (p) { return AF.systems.production.canMakePart(state, p.id); });
    var others = AF.data.PARTS.filter(function (p) { return !AF.systems.production.canMakePart(state, p.id); });
    var used = {};
    for (var i = 0; i < n; i++) {
      var pool = (others.length && (!owned.length || U.rand(state) < k.teaserChance)) ? others : owned;
      var part = U.pick(state, pool);
      if (used[part.id] >= 2) part = U.pick(state, pool);
      used[part.id] = (used[part.id] || 0) + 1;

      var buyer = U.weightedPick(state, buyers, function (b) {
        return b.partWeight * (state.relations[b.id] != null ? state.relations[b.id] / 50 : 1);
      });
      var fac = IDX().facilities[part.facility];
      var capDay = Math.max(fac.capacity, AF.systems.facilities.capacity(state, fac.id));
      var workTarget = capDay * C().DAYS_PER_MONTH * U.randRange(state, k.partLoad[0], k.partLoad[1]) * (0.7 + 0.6 * w);
      var qty = Math.max(part.lot, U.niceQty(workTarget / part.work));
      var days = Math.max(Math.ceil(qty * part.work / capDay * k.deadlineSlack), U.randInt(state, k.partDeadline[0], k.partDeadline[1]));
      var price = part.price * state.modifiers.partPrice * buyer.priceMul * U.randRange(state, k.priceVar[0], k.priceVar[1]) * (days < k.rushDays ? k.rushBonus : 1);
      offers.push(make(state, { kind: 'part', buyerId: buyer.id, itemId: part.id, name: part.name, qty: qty,
                                unitPrice: U.round1(price), deadlineDay: state.day + days - 1 }));
    }

    state.contracts.offers = offers;
    if (state.phase >= 2) contracts.addAircraftOffers(state);
  };

  // 機体契約の提示(フェーズ2から)。解放された月は progression.checkPhase2 からも呼ばれる。
  contracts.addAircraftOffers = function (state) {
    var k = K(), w = contracts.weight(state), demand = contracts.demandMul(state);
    var share = AF.systems.rivals.playerAllocationFactor(state);
    var offers = state.contracts.offers;
    {
      var mi = U.monthIndex(state.day);
      var specs = AF.data.AIRCRAFT_SPECS.filter(function (s) { return s.fromMonth <= mi; });
      var na = U.clamp(Math.round((k.aircraftOffersBase + w * k.aircraftOffersPerWeight) * demand * share), 1, k.aircraftOffersMax);
      for (var j = 0; j < na; j++) {
        var spec = U.weightedPick(state, specs, function (s) {
          return s.weight * (s.role === 'fighter' ? state.modifiers.fighterDemand : state.modifiers.attackDemand);
        });
        var aq = U.randInt(state, spec.qty[0], spec.qty[1] + Math.floor(w * 2 + mi / 12));
        var adays = k.aircraftDeadlineBase + aq * k.aircraftDeadlinePerUnit + U.randInt(state, 0, k.aircraftDeadlineVar);
        var aprice = Math.round(spec.price * U.randRange(state, k.aircraftPriceVar[0], k.aircraftPriceVar[1]) / 100) * 100;
        offers.push(make(state, { kind: 'aircraft', buyerId: 'rlm', itemId: spec.id, name: spec.name, qty: aq,
                                  unitPrice: aprice, deadlineDay: state.day + adays - 1,
                                  minSpec: U.deepCopy(spec.minSpec), mission: spec.mission }));
      }
    }
  };

  // 受注時に付く資材の契約割当
  contracts.grantFor = function (state, c) {
    var grants = {}, eco = AF.systems.economy;
    if (c.kind === 'part') {
      var p = IDX().parts[c.itemId];
      Object.keys(p.materials).forEach(function (id) {
        grants[id] = p.materials[id] * c.qty * C().QUOTA.grantRatio * eco.scarcity(state, id);
      });
    } else {
      var spec = IDX().aircraftSpecs[c.itemId];
      Object.keys(spec.grant).forEach(function (id) { grants[id] = spec.grant[id] * c.qty * eco.scarcity(state, id); });
    }
    return grants;
  };

  function takeOffer(state, id) {
    var list = state.contracts.offers;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list.splice(i, 1)[0];
    return null;
  }
  function findActive(state, id) {
    var list = state.contracts.active;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  contracts.accept = function (state, id) {
    var c = takeOffer(state, id);
    if (!c) return { ok: false, reason: '契約が見つかりません' };
    c.status = 'active';
    c.acceptedDay = state.day;
    c.grant = contracts.grantFor(state, c);
    AF.systems.economy.addGrant(state, c.grant);
    c.advanceRate = c.kind === 'aircraft' ? K().aircraftAdvanceRate : 0;
    if (c.advanceRate > 0) AF.systems.economy.earn(state, c.qty * c.unitPrice * c.advanceRate, 'advance');
    state.contracts.active.push(c);
    L.add(state, IDX().companies[c.buyerId].name + ' から ' + c.name + ' ×' + c.qty + ' を受注した。', 'info');
    return { ok: true };
  };

  contracts.decline = function (state, id) {
    return takeOffer(state, id) ? { ok: true } : { ok: false, reason: '契約が見つかりません' };
  };

  // その契約に今すぐ納められる数
  contracts.deliverable = function (state, c) {
    var remaining = c.qty - c.delivered;
    if (c.kind === 'part') return Math.min(remaining, state.inventory.parts[c.itemId] || 0);
    var stock = 0;
    AF.systems.aircraft.eligibleDesigns(state, c.minSpec).forEach(function (x) { stock += state.inventory.aircraft[x.design.id] || 0; });
    return Math.min(remaining, stock);
  };

  // ---- 納入(あるだけ納める。分納可) ----
  // keep: 手元に残す部品数(自動納入が、ユニット・機体ジョブで使う予定のぶんを残すために渡す)
  contracts.deliver = function (state, id, keep) {
    var c = findActive(state, id);
    if (!c) return { ok: false, reason: '契約が見つかりません' };
    var remaining = c.qty - c.delivered, n = 0, eco = AF.systems.economy, royalty = 0;

    if (c.kind === 'part') {
      n = Math.min(remaining, (state.inventory.parts[c.itemId] || 0) - (keep || 0));
      if (n <= 0) return { ok: false, reason: '納入できる在庫がありません' };
      state.inventory.parts[c.itemId] -= n;
      state.monthStats.partsDelivered += n;
      state.totals.partsDelivered += n;
    } else {
      // 仕様を満たす設計のうち、合計値の低いものから納める
      AF.systems.aircraft.eligibleDesigns(state, c.minSpec).forEach(function (x) {
        var take = Math.min(remaining - n, state.inventory.aircraft[x.design.id] || 0);
        if (take <= 0) return;
        state.inventory.aircraft[x.design.id] -= take;
        n += take;
        // 任務判定(段階3)のために、納入機の記録を残す
        var rec = { day: state.day, designId: x.design.id, name: x.design.name, slots: U.deepCopy(x.design.slots),
                    stats: x.calc.stats, qty: take, mission: c.mission, contractId: c.id };
        state.war.deliveredThisMonth.push(rec);
        royalty += AF.systems.research.royaltyFor(state, x.design.slots, take * c.unitPrice);
      });
      if (n <= 0) return { ok: false, reason: '仕様を満たす機体の在庫がありません' };
      state.monthStats.aircraftDelivered += n;
      state.totals.aircraftDelivered += n;
    }

    var pay = n * c.unitPrice * ((c.late ? K().latePriceMul : 1) - (c.advanceRate || 0)); // 前渡金ぶんは受領済み
    eco.earn(state, pay, c.kind === 'part' ? 'parts' : 'aircraft');
    if (royalty > 0) eco.spend(state, royalty, 'license');
    L.fx(state, 'deliver', { kind: c.kind, itemId: c.itemId, qty: n, pay: pay });
    if (c.kind === 'part') state.totals.partsRevenue += pay;
    c.delivered += n;

    // 納入後のクレーム(部品のみ)。検査設備があると減る。
    if (c.kind === 'part') {
      var Q = C().QUALITY;
      var chance = state.facilities.inspect > 0 ? Q.complaintInspect : Q.complaintNoInspect;
      if (U.rand(state) < chance) {
        eco.spend(state, pay * Q.complaintRefund, 'refunds');
        contracts.changeRating(state, C().RATING.complaint);
        L.add(state, c.name + ' の納入品に不良の指摘があり、一部を返金した。', 'warn');
      }
    }
    if (c.delivered >= c.qty) complete(state, c);
    return { ok: true, qty: n, pay: pay };
  };

  function archive(state, c) {
    state.contracts.active = state.contracts.active.filter(function (x) { return x.id !== c.id; });
    c.closedDay = state.day;
    state.contracts.history.unshift(c);
    if (state.contracts.history.length > 40) state.contracts.history.length = 40;
  }

  function complete(state, c) {
    var R = C().RATING, buyer = IDX().companies[c.buyerId];
    if (c.late) {
      c.status = 'done_late';
      state.contractStats.late += 1; state.monthStats.contractsLate += 1;
      L.add(state, c.name + ' ×' + c.qty + ' を納期遅れで納め終えた。', 'warn');
    } else {
      c.status = 'done';
      state.contractStats.onTime += 1; state.monthStats.contractsDone += 1;
      if (c.buyerId === 'rlm') contracts.changeRating(state, c.kind === 'aircraft' ? R.aircraftOnTime : R.partOnTime);
      else contracts.changeRating(state, R.otherBuyerRlm);
      contracts.changeRelation(state, c.buyerId, R.relationOnTime);
      L.add(state, buyer.name + ' へ ' + c.name + ' ×' + c.qty + ' を納期内に納め終えた。', 'good');
    }
    archive(state, c);
  }

  function fail(state, c) {
    var R = C().RATING;
    var undelivered = (c.qty - c.delivered) * c.unitPrice;
    var penalty = undelivered * K().failPenaltyRate;
    if (c.advanceRate > 0) AF.systems.economy.spend(state, undelivered * c.advanceRate, 'advanceReturn'); // 前渡金の返還
    c.status = 'failed';
    state.contractStats.failed += 1; state.monthStats.contractsFailed += 1;
    AF.systems.economy.spend(state, penalty, 'penalties');
    contracts.changeRating(state, R.fail);
    contracts.changeRelation(state, c.buyerId, R.relationFail);
    L.add(state, c.name + ' の契約が打ち切られた(未納 ' + (c.qty - c.delivered) + '、違約金 ' + U.money(penalty) + ')。', 'bad');
    archive(state, c);
  }

  // ---- 日次: 自動納入と納期の確認 ----
  contracts.processDay = function (state) {
    var R = C().RATING;
    if (state.autoDeliver) {
      var reserved = AF.systems.production.reservedParts(state);
      state.contracts.active.slice().sort(function (a, b) { return a.deadlineDay - b.deadlineDay; }).forEach(function (c) {
        var keep = c.kind === 'part' ? (reserved[c.itemId] || 0) : 0;
        if (contracts.deliverable(state, c) - keep > 0) contracts.deliver(state, c.id, keep);
      });
    }
    state.contracts.active.slice().forEach(function (c) {
      if (!c.late && state.day > c.deadlineDay) {
        c.late = true;
        contracts.changeRating(state, R.late);
        contracts.changeRelation(state, c.buyerId, R.relationLate);
        L.add(state, c.name + ' の納期を過ぎた。以後の納入は単価が下がり、' + K().graceDays + '日後に打ち切られる。', 'bad');
      }
      if (state.day > c.deadlineDay + K().graceDays) fail(state, c);
    });
  };

  // ---- スポット販売(契約なしで部品を売る。安く、月ごとに上限がある) ----
  contracts.spotPrice = function (state, partId) {
    return U.round1(IDX().parts[partId].price * C().SPOT.priceMul);
  };
  contracts.spotRemaining = function (state, partId) {
    var cap = Math.round(IDX().parts[partId].spotDemand * contracts.demandMul(state) * state.modifiers.partDemand);
    return Math.max(0, cap - (state.spotSold[partId] || 0));
  };
  contracts.sellSpot = function (state, partId, qty) {
    var n = Math.min(Math.floor(qty), state.inventory.parts[partId] || 0, contracts.spotRemaining(state, partId));
    if (!(n > 0)) return { ok: false, reason: '売れる在庫か、今月の引き取り枠がありません' };
    var pay = n * contracts.spotPrice(state, partId);
    state.inventory.parts[partId] -= n;
    state.spotSold[partId] = (state.spotSold[partId] || 0) + n;
    state.monthStats.partsDelivered += n;
    state.totals.partsDelivered += n;
    state.totals.partsRevenue += pay;
    AF.systems.economy.earn(state, pay, 'spot');
    L.fx(state, 'deliver', { kind: 'part', itemId: partId, qty: n, pay: pay });
    return { ok: true, qty: n, pay: pay };
  };

  AF.systems.contracts = contracts;
})(window.AF);
