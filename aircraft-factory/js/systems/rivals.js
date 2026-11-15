// 【ひな形・段階4で実装】ライバル企業の簡易AI。データは js/data/companies.js、状態は state.rivals / state.marketShare。
//   state.rivals[会社id] = { capacity, tech, rlmRating }
(function (AF) {
  'use strict';
  var rivals = {};

  // 契約配分でプレイヤーに回る割合の補正(1=補正なし)。contracts.generateMonthlyOffers が使う。
  // TODO(段階4): ライバルの対RLM評価・生産能力と比べて増減させる。
  rivals.playerAllocationFactor = function (state) { return 1; };

  // TODO(段階4): 部品市場と機体市場のシェアを別々に計算して state.marketShare に入れる。
  rivals.updateMarketShare = function (state) {};

  // 月末に monthEnd.run から呼ばれる。
  // TODO(段階4): COMPANIES[].timeline の該当月の delta を state.rivals に当てる。新型機の発表は月報に載せる。
  rivals.updateMonthly = function (state) {};

  AF.systems.rivals = rivals;
})(window.AF);
