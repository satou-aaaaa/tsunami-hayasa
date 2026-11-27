// 津波の速さくらべの問題を作る（ブラウザと node の両方で使う）。
// 津波の速さの目安は、静岡県「津波について」の式 √(9.8×水深) m/秒（km/時 は ×3.6）。名古屋市・気象庁リーフレット（秋田市の資料に引用）の
// 「水深10mで時速約36km・500mで約250km・5000mで約800km」と合う（2026-11-27 に読んだ。要点は共有フォルダ games/tsunami-hayasa-research.md）。
// 扱うのは津波の「速さ」だけ。警報・注意報の読み方（津波よみ tsunami-yomi）とは重ねない。
// 1問は、水深と、くらべる相手（歩く人・車・新幹線など。速さを書いて出す）を見て「どちらが速い？」を選ぶ（正解したら2段目「100mを何秒で進む？」）か、
// 速さから水深を当てるか、津波の速さと避難の目安の決まりの問いに答える。
// 乱数 R は呼ぶ回数が毎回同じになるように使う（sort の比較の中では引かない）。同じ tag なら、どの端末でも同じ問題になる。
// KINDS・言い回し・相手・まちがいの選び肢は、足すだけでも過去の日の問題が変わる。公開したあとは変えず、変えるときは qa/run.mjs の PINS を作り直して PR に理由を書く。
(function (root) {
  "use strict";
  const LV = ["やさしい", "ふつう", "むずかしい"];

  // 出典（画面の「なぜ」に出す）
  const SRC = {
    jma: ["気象庁「津波発生と伝播のしくみ」", "https://www.jma.go.jp/jma/kishou/know/jishin/tsunami/generation.html"],
    nagoya: ["名古屋市「津波の発生や特徴について」", "https://www.city.nagoya.jp/bousaiportal/more/1036446/1013421.html"],
    shizuoka: ["静岡県「津波について」", "https://www.pref.shizuoka.jp/bosaikinkyu/sonae/1040807/1030065.html"],
    akita: ["秋田市の資料（気象庁「津波から命をまもるために」より）", "https://www.city.akita.lg.jp/_res/projects/default_project/_page_/001/019/600/siryou5.pdf"],
    flyer: ["気象庁・内閣府「津波から身を守るために」", "https://www.jma.go.jp/jma/kishou/books/tsunamibosai/tsunamibosai.pdf"],
    fdma: ["消防庁「津波避難対策推進マニュアル検討会報告書」", "https://www.fdma.go.jp/singi_kento/kento/items/kento106_01_p0.pdf"],
    road: ["内閣府「生活道路の法定速度の見直しについて」", "https://www8.cao.go.jp/koutu/taisaku/r07kou_haku/zenbun/genkyo/topics/topic_1.html"],
  };

  // 津波の速さの目安：√(9.8×水深) m/秒（静岡県「津波について」の式）。km/時 は ×3.6
  const G0 = 9.8;
  const mps = (d) => Math.sqrt(G0 * d);
  const kmh = (d) => mps(d) * 3.6;
  const sec100 = (d) => 100 / mps(d);
  // 画面に出す時速（100km未満は1の位、それより上は10の位で丸める。名古屋市の表の「約36」「約250」「約800」と同じ丸め方）
  const kmhStr = (v) => String(v < 100 ? Math.round(v) : Math.round(v / 10) * 10);
  const secStr = (t) => (t >= 2 ? String(Math.round(t)) : t.toFixed(1));

  // くらべる相手：[id, 名前, 時速km, 印, 出典, 出どころの一言]
  const MOVERS = [
    ["slow", "歩くのがむずかしい人", 1.8, "♿", "fdma", "1秒に0.5m（消防庁の報告書の目安）"],
    ["hinan", "2011年の避難の平均", 2.24, "🚶", "fdma", "東日本大震災の平均避難速度（消防庁の報告書）"],
    ["walk", "歩く人", 3.6, "🚶", "fdma", "1秒に1.0m（消防庁の報告書の目安）"],
    ["car30", "生活道路の車", 30, "🚗", "road", "中央線などの無い一般道路で、標識の無い所の法定速度（2026年9月から）"],
    ["sprint", "短距離走のトップ選手", 36, "🏃", "akita", "気象庁のリーフレットのたとえ"],
    ["car60", "中央線のある道の車", 60, "🚙", "road", "一般道路の法定速度"],
    ["puma", "ピューマ", 110, "🐆", "akita", "気象庁のリーフレットのたとえ"],
    ["shin", "新幹線", 250, "🚄", "akita", "気象庁のリーフレットのたとえ"],
    ["jet", "ジェット旅客機", 800, "✈️", "akita", "気象庁のリーフレットのたとえ"],
  ].map(([id, name, v, icon, src, from]) => ({ id, name, v, icon, src, from }));
  const MV = Object.fromEntries(MOVERS.map((m) => [m.id, m]));
  const WALKERS = ["slow", "hinan", "walk"];

  // 答えの3つ。ほぼ同じ＝速いほうが遅いほうの1.1倍まで。1.1倍〜1.5倍の組は出さない（どちらとも言いにくい）
  const ANS = { t: "🌊 津波のほうが速い", m: (m) => `${m.icon} ${m.name}のほうが速い`, e: "＝ ほぼ同じ速さ" };
  function cmp(d, m) { const r = kmh(d) / m.v; return r >= 1.5 ? "t" : r <= 1 / 1.5 ? "m" : r <= 1.1 && r >= 1 / 1.1 ? "e" : null; }
  const far = (d, m) => { const r = kmh(d) / m.v; return r >= 3 || r <= 1 / 3; };
  // 難しさごとの相手：やさしいは3倍以上ちがう相手、ふつうは歩く人を除いた全部、むずかしいは5倍より近い相手（歩く人を除く）
  function poolOf(d, lv) {
    return MOVERS.filter((m) => {
      const c = cmp(d, m); if (!c) return false;
      if (lv === 0) return far(d, m) || c === "e"; // 気象庁のたとえ（水深10mと短距離走の選手など）は、やさしいでも出す
      if (WALKERS.includes(m.id)) return false;
      if (lv === 2) { const r = kmh(d) / m.v; return r < 5 && r > 1 / 5; }
      return true;
    });
  }

  // 2段目「この津波は、100mを何秒で進む？」の4つ（境目は 2・8・20秒。出す水深は境目から1割以上はなれている）
  const GROUPS = {
    b20: { name: "20秒以上", sub: "100mに20秒より長くかかる" },
    b8: { name: "8秒〜20秒", sub: "100mに8秒から20秒" },
    b2: { name: "2秒〜8秒", sub: "100mに2秒から8秒" },
    b0: { name: "2秒より短い", sub: "100mを2秒かからずに進む" },
  };
  const grpOf = (d) => { const t = sec100(d); return t >= 20 ? "b20" : t >= 8 ? "b8" : t >= 2 ? "b2" : "b0"; };
  const gwhyOf = (d) => `水深${d}mの津波は、1秒に約${Math.round(mps(d))}m進みます（√(9.8×${d})）。100mは約${secStr(sec100(d))}秒です。`;

  // part:ri:begin（shared-workflows の template/parts/data/ri.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  // part:ri:end
  // part:shuffle:begin（shared-workflows の template/parts/data/shuffle.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function shuffle(R, a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = ri(R, 0, i); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  // part:shuffle:end
  // part:pickN:begin（shared-workflows の template/parts/data/pickN.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function pickN(R, a, n) { return shuffle(R, a).slice(0, n); }
  // part:pickN:end
  const MEDIA = { kurabe: "速さくらべ", fukasa: "深さあて", kihon: "津波のきほん", hinan: "避難の目安" };

  // 問題の上の絵：海の断面と水深（色だけにせず、水深を字で書く）
  function seaSvg(d, label, txt) {
    const h = Math.max(10, Math.min(70, 10 + Math.log10(d) * 15));
    return `<svg viewBox="0 0 320 110" role="img" aria-label="${label}"><rect width="320" height="110" fill="#dfeef5"/><path d="M0 22 Q40 14 80 22 T160 22 T240 22 T320 22 V110 H0Z" fill="#2c6e9c"/><path d="M0 ${22 + h} L250 ${22 + h} L320 24 V110 H0Z" fill="#8a6a43"/><line x1="60" y1="24" x2="60" y2="${20 + h}" stroke="#fff" stroke-width="2.5" marker-end="url(#ar)"/><defs><marker id="ar" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#fff"/></marker></defs><text x="70" y="${Math.max(44, 18 + h / 2)}" font-size="17" font-weight="900" fill="#fff">${txt || `水深 ${d}m`}</text><text x="268" y="18" font-size="18">🏖️</text></svg>`;
  }

  // 速さくらべの言い方（d は水深、m は相手の文字）
  const SIT = [
    (d, m) => `水深${d}mの海を進む津波と、${m}。速いのは？`,
    (d, m) => `海の深さが${d}mの所の津波。${m}とくらべると？`,
    (d, m) => `水深${d}mの津波と、${m}。どちらが速い？`,
    (d, m) => `${m}と、水深${d}mの所の津波。速さをくらべると？`,
    (d, m) => `深さ${d}mの海で起きた津波。${m}と速さくらべ。`,
    (d, m) => `津波が水深${d}mの所を進む。${m}より速い？`,
  ];
  const mvStr = (m) => `${m.icon}${m.name}（時速${m.v}km）`;
  function race(d) {
    return (R, lv) => {
      const pool = poolOf(d, lv), m = pool[ri(R, 0, pool.length - 1)], si = ri(R, 0, SIT.length - 1), c = cmp(d, m);
      const opts = shuffle(R, [ANS.t, ANS.m(m), ANS.e]), ans = c === "t" ? ANS.t : c === "m" ? ANS.m(m) : ANS.e;
      const why = `水深${d}mの津波は時速約${kmhStr(kmh(d))}km。${m.name}は時速${m.v}km（${m.from}）。${c === "e" ? "ほぼ同じ速さです。" : c === "t" ? "津波のほうが速いです。" : `${m.name}のほうが速いです。`}`;
      return { type: "act", media: MEDIA.kurabe, q: SIT[si](d, mvStr(m)), opts, ans, mover: m.id, why, src: ["shizuoka", "nagoya", m.src].filter((x, i, a) => a.indexOf(x) === i), v: `${si}:${m.id}` };
    };
  }
  // 速さくらべの種類（id は d<水深>）
  const T = (lv, d, look) => {
    const t = kmhStr(kmh(d));
    return { id: `d${d}`, lv, a: d, ans: "", grp: grpOf(d), gwhy: gwhyOf(d), col: "kurabe", name: `水深${d}m：時速約${t}km`, look,
      key: `水深${d}mの津波は、時速約${t}km。100mを約${secStr(sec100(d))}秒で進みます。`, why: "", src: ["shizuoka", "nagoya"], make: race(d), d };
  };

  // 深さあて：相手とほぼ同じ速さの津波の水深を選ぶ（気象庁リーフレットのたとえの4組）
  const DEPTH_OPTS = [1, 10, 100, 500, 1000, 5000, 8000];
  function eq(mid, d) {
    return (R, lv) => {
      const m = MV[mid], ws = DEPTH_OPTS.filter((x) => x !== d && (lv === 0 ? Math.abs(Math.log10(x / d)) >= 1 : true)), ds = pickN(R, ws, lv === 0 ? 2 : 3);
      const si = ri(R, 0, 2), q = [`${m.icon}${m.name}（時速${m.v}km）と、ほぼ同じ速さの津波。海の深さは？`, `時速${m.v}kmの${m.name}${m.icon}と同じくらいの津波。どの深さの海？`, `${m.icon}${m.name}並みの速さ（時速${m.v}km）の津波。水深はどれくらい？`][si];
      return { type: "act", media: MEDIA.fukasa, q, opts: shuffle(R, [d, ...ds]).map((x) => `水深${x}m`), ans: `水深${d}m`, mover: mid, v: `${si}:${ds.join(".")}` };
    };
  }
  const E = (lv, mid, d, look) => ({ id: `eq${mid}`, lv, a: d, ans: `水深${d}m`, grp: grpOf(d), gwhy: gwhyOf(d), col: "fukasa", name: `${MV[mid].name}並み：水深${d}m`, look,
    key: `時速${MV[mid].v}kmに近いのは、水深${d}mの津波（時速約${kmhStr(kmh(d))}km）です。`,
    why: `水深${d}mの津波は時速約${kmhStr(kmh(d))}km。気象庁のリーフレットでは${MV[mid].name}にたとえています。`, src: ["akita", "nagoya"], make: eq(mid, d), d });

  // 決まりの問題。ans：答え、ws：まちがいの選び肢の候補（やさしいは2つ、ほかは3つ使う）、sit：問いの言い方
  function fact(col, sit, ans, ws) {
    return (R, lv) => {
      const si = ri(R, 0, sit.length - 1), ds = pickN(R, ws, lv === 0 ? 2 : 3);
      return { type: "fact", media: MEDIA[col], q: sit[si], opts: shuffle(R, [ans, ...ds]), ans, v: `${si}:${ds.map((d) => ws.indexOf(d)).join(".")}` };
    };
  }
  const F = (id, lv, col, src, name, look, key, why, sit, ans, ws) => ({ id, lv, a: -1, ans, grp: null, gwhy: "", col, name, look, key, why, src: [src], make: fact(col, sit, ans, ws) });

  const KINDS = [
    // ---- やさしい ----
    T(0, 1, "とても浅い海でも、歩くよりは速いです。"),
    T(0, 2, "浅い海の津波です。歩く人と車を思いうかべて。"),
    T(0, 10, "岸の近くの深さです。100mを約10秒。"),
    T(0, 500, "時速は数百kmです。"),
    T(0, 5000, "深い沖の海。ジェット機に近い速さです。"),
    T(0, 8000, "とても深い海。時速は1000kmくらい。"),
    F("fukai", 0, "kihon", "jma", "海が深いほど速い", "深い海と浅い海、どちらが速いか。", "津波は、海が深いほど速く伝わります。",
      "気象庁は、津波は海が深いほど速く伝わる性質があると説明しています。",
      ["津波は、海が深いほどどうなる？", "深い海の津波と浅い海の津波。正しいのは？", "海の深さと津波の速さの関係は？"], "深いほど速く伝わる", ["深いほど遅く伝わる", "深さで速さは変わらない", "深い海では止まる", "浅いほど速く伝わる"]),
    F("jet", 0, "kihon", "jma", "沖ではジェット機に匹敵", "空を飛ぶ乗り物です。", "沖合いの津波は、ジェット機に匹敵する速さで伝わります。",
      "気象庁は、津波は沖合いではジェット機に匹敵する速さで伝わると説明しています。",
      ["沖合いの津波の速さは、何に匹敵する？", "気象庁のたとえで、沖の津波はどれくらい速い？", "深い沖の海を進む津波の速さのたとえは？"], "ジェット機", ["歩く人", "自転車", "ヨット", "ボート"]),
    F("s5000", 0, "kihon", "nagoya", "水深5000mで時速約800km", "ジェット機くらいの速さです。", "水深5000mの津波は、時速約800kmです。",
      "名古屋市は、水深5,000mでは時速約800kmとしています。√(9.8×5000)×3.6 ≒ 797です。",
      ["水深5000mの津波は、時速およそ何km？", "深さ5000mの沖を進む津波の速さは？", "水深5000m。津波の時速の目安は？"], "時速約800km", ["時速約8km", "時速約80km", "時速約8000km", "時速約3km"]),
    // ---- ふつう ----
    T(1, 20, "時速50kmくらいです。"),
    T(1, 100, "時速100kmをこえます。"),
    T(1, 200, "時速150kmより速いです。"),
    T(1, 3000, "時速600kmくらいです。"),
    T(1, 4000, "時速700kmくらいです。"),
    E(1, "sprint", 10, "岸の近くの浅い海です。"),
    E(1, "shin", 500, "時速250kmになる深さです。"),
    E(1, "jet", 5000, "とても深い沖の海です。"),
    F("s10", 1, "kihon", "nagoya", "水深10mで時速約36km", "岸の近くでも、車くらいの速さです。", "水深10mの津波は、時速約36kmです。",
      "名古屋市は、水深10mでは時速約36kmとしています。内閣府の防災白書も「時速40km近く」と書いています。",
      ["水深10mの津波は、時速およそ何km？", "岸に近い水深10mの所。津波の時速の目安は？", "浅い水深10mでも、津波の時速は？"], "時速約36km", ["時速約3km", "時速約360km", "時速約800km", "時速約1km"]),
    F("s100m", 1, "kihon", "shizuoka", "岸の近くでも100mを10秒", "時速36kmは、1秒に10mです。", "水深10mの津波は1秒に約10m。100mを約10秒で進みます。",
      "静岡県の式 √(9.8×水深) で、水深10mは1秒に約9.9m。100mを約10秒で進みます。",
      ["水深10mの津波が100m進むのに、およそ何秒？", "岸の近く（水深10m）の津波。100mを何秒で進む？", "水深10mの所の津波は、100mを何秒で進む？"], "約10秒", ["約1分", "約1秒", "約3分", "約30秒"]),
    F("takaku", 1, "kihon", "jma", "浅くなると遅くなり、高くなる", "前が遅くなり、後ろが追いつきます。", "陸に近づくと遅くなり、後ろの波が追いついて高くなります。",
      "気象庁は、浅い所で津波の前が遅くなり、後ろが追いつくことで波が高くなると説明しています。",
      ["陸に近づいて遅くなった津波。高さはどうなる？", "浅い海に入った津波の高さは？", "津波の前が遅くなると、波の高さは？"], "高くなる", ["低くなる", "変わらない", "消える", "半分になる"]),
    F("miru", 1, "hinan", "flyer", "見てから逃げては間に合わない", "とても速いからです。", "津波はとても速いので、見てから逃げたのでは間に合いません。",
      "気象庁と内閣府は、津波はとても速いので、津波を見てから逃げたのでは間に合わないとしています。",
      ["津波を見てから逃げると、どうなる？", "海を見て津波が来てから逃げる。正しいのは？", "津波は見えてから逃げても大丈夫？"], "間に合わない", ["十分に間に合う", "歩いても間に合う", "車なら必ず間に合う", "走れば必ず間に合う"]),
    F("walk1", 1, "hinan", "fdma", "避難の歩く速さの目安は1秒に1m", "時速にすると3.6kmです。", "津波避難の計画では、歩く速さを1秒に1.0mとするのが目安です。",
      "消防庁の報告書は、避難の計画で歩行速度を1.0m/秒（時速3.6km）とするのを目安にしています。",
      ["津波避難の計画で使う、歩く速さの目安は？", "消防庁の報告書で、避難の歩行速度の目安は1秒に何m？", "避難できる距離を考えるときの歩く速さは？"], "1秒に1.0m", ["1秒に10m", "1秒に0.1m", "1秒に5m", "1秒に30m"]),
    // ---- むずかしい ----
    T(2, 5, "時速25kmくらいです。"),
    T(2, 50, "時速80kmくらいです。"),
    T(2, 1000, "時速350kmくらいです。"),
    T(2, 2000, "時速500kmくらいです。"),
    T(2, 6000, "時速870kmくらいです。"),
    E(2, "puma", 100, "時速100kmをこえる深さです。"),
    F("shiki", 2, "kihon", "shizuoka", "速さの目安は √(9.8×水深)", "9.8と水深をかけて、平方根をとります。", "津波の速さ（m/秒）の目安は √(9.8×水深) です。",
      "静岡県は、津波の速さ（m/秒）＝√(g×h)＝√(9.8×水深) としています。",
      ["津波の速さ（1秒に何m）の目安の式は？", "水深から津波の速さを出す式は？", "静岡県の説明で、津波の速さ（m/秒）の式は？"], "√(9.8×水深)", ["9.8×水深", "水深÷9.8", "9.8÷水深", "水深×水深"]),
    F("peru", 2, "kihon", "jma", "ペルーの津波は20時間以上で日本へ", "太平洋をわたってきます。", "南米ペルーからの津波は、太平洋をわたり20時間以上かけて日本へ来ました。",
      "気象庁は、ペルーから太平洋を横断し、20時間以上かけて日本に津波が届いた様子を示しています。",
      ["ペルーから太平洋をわたった津波。日本まで何時間？", "南米ペルーの近くで起きた津波は、どれくらいで日本へ？", "気象庁の例で、ペルーからの津波が日本に届くまでは？"], "20時間以上", ["約20分", "約2時間", "約5時間", "約1時間"]),
    F("hinanavg", 2, "hinan", "fdma", "2011年の避難の平均は時速約2.2km", "歩く目安より、遅かったです。", "東日本大震災の平均避難速度は、時速2.24km（1秒に0.62m）でした。",
      "消防庁の報告書は、東日本大震災時の平均避難速度を時速2.24km（0.62m/秒）としています。",
      ["東日本大震災のときの、避難の平均の速さは？", "消防庁の報告書にある、2011年の平均避難速度は？", "2011年の津波で、人が避難した平均の時速は？"], "時速約2.2km", ["時速約22km", "時速約60km", "時速約0.2km", "時速約11km"]),
    F("slow5", 2, "hinan", "fdma", "歩くのがむずかしい人は1秒に0.5m", "目安の1.0mより遅くなります。", "歩くのがむずかしい人や乳幼児などは、歩く速さが1秒に0.5mまで下がります。",
      "消防庁の報告書は、歩行困難者・乳幼児などは歩行速度がさらに下がる（0.5m/秒）ことに気をつけるとしています。",
      ["歩くのがむずかしい人などの、歩く速さの目安は？", "消防庁の報告書で、乳幼児などと避難するときの速さは？", "歩く速さが下がる人の目安は、1秒に何m？"], "1秒に0.5m", ["1秒に1.5m", "1秒に3m", "1秒に5m", "1秒に10m"]),
    F("sojo", 2, "kihon", "shizuoka", "陸に上がった津波も全速力で走るほど", "陸の上でも、遅くはありません。", "陸に上がった津波は、人が全速力で走るほどの速さになります。",
      "静岡県は、陸上に遡上した津波は、人が全速力で走るほどの速さになると説明しています。",
      ["陸に上がった津波の速さは、どれくらい？", "静岡県の説明で、陸を進む津波の速さは？", "海から陸に上がった津波。速さのたとえは？"], "人が全速力で走るほど", ["歩くよりゆっくり", "ほとんど止まる", "ジェット機と同じ", "カタツムリくらい"]),
  ];
  const BY = Object.fromEntries(KINDS.map((k) => [k.id, k]));
  const kindsOf = (lv) => KINDS.filter((k) => k.lv === lv).map((k) => k.id);

  // part:seedOf:begin（shared-workflows の template/parts/data/seedOf.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function seedOf(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // part:seedOf:end
  // part:rng:begin（shared-workflows の template/parts/data/rng.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // part:rng:end

  // 1問を作る。tag は「種類|種」（例 "d10|2026-11-27:d0"）。同じ tag ならいつも同じ問題
  function make(tag) {
    const [kind] = String(tag).split("|"), k = Object.prototype.hasOwnProperty.call(BY, kind) ? BY[kind] : null;
    if (!k) return null;
    const p = k.make(rng(seedOf(tag)), k.lv);
    const svg = !k.d ? "" : k.col === "fukasa" ? seaSvg(300, "海の断面。水深はいくつ？", "水深 ？m") : seaSvg(k.d, `海の断面。水深${k.d}m`);
    return { tag, kind, lv: k.lv, name: k.name, look: k.look, key: k.key, why: k.why, grp: k.grp, gwhy: k.gwhy, d: k.d || 0, svg, ...p, src: (p.src || k.src).map((s) => SRC[s]) };
  }
  const keyOf = (P) => `${P.kind}:${P.q}:${P.opts.slice().sort().join("/")}`;

  function dailyTags(date) {
    const R = rng(seedOf("day:" + date)), e = pickN(R, kindsOf(0), 2), n = pickN(R, kindsOf(1), 2), h = pickN(R, kindsOf(2), 1);
    return [...e, ...n, ...h].map((id, i) => `${id}|${date}:d${i}`);
  }
  function hardTags(date) {
    const dh = dailyTags(date)[4].split("|")[0], R = rng(seedOf("hard:" + date)), h = pickN(R, kindsOf(2).filter((x) => x !== dh), 3);
    return h.map((id, i) => `${id}|${date}:h${i}`);
  }

  const TSH = { KINDS, BY, GROUPS, LV, SRC, MOVERS, MV, MEDIA, ANS, G0, mps, kmh, sec100, kmhStr, secStr, cmp, poolOf, grpOf, kindsOf, seedOf, rng, make, keyOf, dailyTags, hardTags, pickN, seaSvg };
  if (typeof module !== "undefined" && module.exports) module.exports = TSH; else root.TSH = TSH;
})(typeof self !== "undefined" ? self : this);
