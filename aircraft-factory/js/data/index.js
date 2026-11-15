// id から各データを引くための索引。すべての data/*.js のあとに読み込む。
// 例: AF.data.index.parts['fitting'], AF.data.index.units['eng_bmw132']
(function (AF) {
  'use strict';

  function byId(list) {
    var map = {};
    list.forEach(function (item) { map[item.id] = item; });
    return map;
  }

  AF.data.index = {
    materials: byId(AF.data.MATERIALS),
    facilities: byId(AF.data.FACILITIES),
    parts: byId(AF.data.PARTS),
    units: byId(AF.data.UNITS),
    companies: byId(AF.data.COMPANIES),
    aircraftSpecs: byId(AF.data.AIRCRAFT_SPECS),
    research: byId(AF.data.RESEARCH),
    events: byId(AF.data.EVENTS),
    missions: byId(AF.data.MISSIONS),
    fronts: byId(AF.data.FRONTS),
    stats: byId(AF.data.CONFIG.STATS),
    slots: byId(AF.data.CONFIG.SLOTS)
  };
})(window.AF);
