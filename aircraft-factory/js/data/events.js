// 史実イベントと汎用イベント。段階1ではデータのみで、動作は段階2で systems/events.js に実装する。
//
// baseDate: 基準日(年・月) / advanceMax, delayMax: 前倒し・遅延の上限(月)
// omenMonths: 基準日の何か月前から予兆を出すか / omenText: 予兆の文面
// condition: 満たすと前倒し、満たさないと遅延。{front, minWarValue} など
// effects: 効果の配列。type ごとの意味は systems/events.js の applyEffect に書く
//   demand      : state.modifiers の需要倍率を変える (target: partDemand / fighterDemand / attackDemand)
//   openFront   : 戦線を開く
//   quota       : 資材割当の倍率を変える
//   laborPool   : 採用枠の倍率を変える
//   warLink     : 納入機の質が戦況値に強く効く期間を設ける
//   rating      : RLM評価を変える
// next: 続いて予定に入るイベントのid
// 日付と効果量は概算。TODO: 要確認
(function (AF) {
  'use strict';

  AF.data.EVENTS = [
    { id: 'poland', type: 'historical', name: 'ポーランド侵攻', baseDate: { year: 1939, month: 9 },
      advanceMax: 0, delayMax: 0, omenMonths: 0, omenText: '', condition: null, fixed: true,
      effects: [], next: 'west_campaign',
      text: '戦争が始まった。航空省は部品の下請けを広く募っている。' },
    { id: 'west_campaign', type: 'historical', name: '西方戦役', baseDate: { year: 1940, month: 5 },
      advanceMax: 1, delayMax: 1, omenMonths: 3, omenText: '西部国境への部隊移動の噂。戦闘機と攻撃機の引き合いが増えそうだ。',
      condition: { front: 'west', minWarValue: 55 },
      effects: [
        { type: 'demand', target: 'fighterDemand', mul: 1.5, months: 3 },
        { type: 'demand', target: 'attackDemand', mul: 1.5, months: 3 }
      ], next: 'battle_of_britain',
      text: '西方で大規模な作戦が始まった。戦闘機・攻撃機の需要が急増している。' },
    { id: 'battle_of_britain', type: 'historical', name: 'バトル・オブ・ブリテン', baseDate: { year: 1940, month: 7 },
      advanceMax: 1, delayMax: 1, omenMonths: 3, omenText: '海峡方面の飛行場の整備が進んでいる。補充機の需要が続きそうだ。',
      condition: { front: 'west', minWarValue: 60 },
      effects: [
        { type: 'demand', target: 'fighterDemand', mul: 1.4, months: 4 },
        { type: 'warLink', front: 'west', strength: 2, months: 4 }
      ], next: 'barbarossa',
      text: '海峡上空の航空戦が始まった。補充機の質が、そのまま西部の戦況に響く。' },
    { id: 'barbarossa', type: 'historical', name: 'バルバロッサ作戦', baseDate: { year: 1941, month: 6 },
      advanceMax: 2, delayMax: 2, omenMonths: 3, omenText: '東方への輸送が増えている。対地攻撃機の引き合いが増えそうだ。',
      condition: { front: 'west', minWarValue: 50 },
      effects: [
        { type: 'openFront', front: 'east' },
        { type: 'demand', target: 'attackDemand', mul: 1.6, months: 6 }
      ], next: 'us_entry',
      text: '東部戦線が開いた。対地攻撃機の需要が増えている。' },
    { id: 'us_entry', type: 'historical', name: '米国参戦', baseDate: { year: 1941, month: 12 },
      advanceMax: 1, delayMax: 1, omenMonths: 3, omenText: '大西洋の向こうの動きが慌ただしい。資材と人手が一段と厳しくなりそうだ。',
      condition: null,
      effects: [
        { type: 'quota', material: 'alloy', mul: 0.85, months: 0 },
        { type: 'laborPool', mul: 0.7, months: 0 }
      ], next: null,
      text: '米国が参戦した。資材と労働力の確保が一段と難しくなる。' },

    // ---- 汎用イベント(毎月、確率で発生) ----
    { id: 'rlm_notice', type: 'generic', name: 'RLMの新規契約通達', chance: 0.15,
      effects: [{ type: 'demand', target: 'partDemand', mul: 1.3, months: 1 }],
      text: '航空省から新規契約の通達が届いた。今月は引き合いが多い。' },
    { id: 'quota_change', type: 'generic', name: '資材割当の変更', chance: 0.12,
      effects: [{ type: 'quota', material: 'alloy', mul: 0.9, months: 2 }],
      text: '資材割当の見直しが通知された。しばらく軽合金の枠が減る。' },
    { id: 'rival_new_model', type: 'generic', name: 'ライバルの新型機発表', chance: 0.10,
      effects: [{ type: 'rating', delta: -2 }],
      text: '他社が新型機を発表した。航空省の関心がそちらへ向いている。' }
  ];
})(window.AF);
