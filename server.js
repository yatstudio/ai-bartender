const http = require('http');
const fs = require('fs');
const path = require('path');

const mime = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function loadDrinks() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'drinks.json'), 'utf8'));
}

function loadHtml() {
  return fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
}

const archetypes = [
  { key: 'moon-drifter', name: '月亮漂流型', formula: '疲惫感 × 轻社交欲 × 低压入口', triggers: ['relax', 'talk', 'light'], drinks: ['春夏', '海边假日', '山野曼波', '0糖皮尔森'] },
  { key: 'spark-hunter', name: '火花猎手型', formula: '新鲜感 × 记忆点 × 可开场', triggers: ['surprise', 'talk'], drinks: ['醋不及防', '不止苏梅', '花海巡游蜜瓜龙', '屑橙2.0'] },
  { key: 'signal-sender', name: '信号发射型', formula: '社交意图 × 好入口 × 柔和辨识度', triggers: ['talk', 'light'], drinks: ['香波精灵', '马冬莓', '鲜榨乌龙荔枝啵啵', '海边假日'] },
  { key: 'idea-summoner', name: '灵感召唤型', formula: '表达欲 × 清醒度 × 话题延展性', triggers: ['project', 'fresh'], drinks: ['嬉皮小子', '西海岸的梦', '日出的人'] },
  { key: 'velvet-celebrant', name: '丝绒庆典型', formula: '仪式感 × 微醺感 × 视觉存在感', triggers: ['celebrate', 'surprise'], drinks: ['不止苏梅', '一次重逢', '西海岸的梦'] },
  { key: 'soft-healer', name: '软糖治愈型', formula: '甜口安全感 × 降低门槛 × 被温柔接住', triggers: ['sweet', 'light'], drinks: ['马冬莓', '泰奶减法酪', '鲜榨乌龙荔枝啵啵'] },
  { key: 'quiet-observer', name: '安静观察型', formula: '低存在感 × 慢进入 × 给自己留余地', triggers: ['solo', 'light'], drinks: ['春夏', '0糖皮尔森', '听涛'] },
  { key: 'bitter-speaker', name: '苦口表达型', formula: '苦感接受度 × 表达欲 × 个性边缘感', triggers: ['bitter', 'project'], drinks: ['嬉皮小子', '西海岸的梦', '一次重逢'] },
  { key: 'clean-safe', name: '干净安全型', formula: '不出错 × 长聊天 × 低负担', triggers: ['fresh', 'light'], drinks: ['0糖皮尔森', '日出的人', '春夏'] },
  { key: 'curious-roamer', name: '游牧尝鲜型', formula: '好奇心 × 风味探索 × 不想重复', triggers: ['surprise', 'sour'], drinks: ['醋不及防', '屑橙2.0', '花海巡游蜜瓜龙', '不止苏梅'] }
];

function inferIntent(text) {
  const t = (text || '').toLowerCase();
  return {
    wantsLight: /不想太烈|别太烈|低一点|轻一点|好入口|别太上头/.test(t),
    wantsSweet: /甜|奶|草莓|荔枝|柔和|好喝/.test(t),
    wantsFresh: /清爽|清新|轻松|解腻|干净|稳一点/.test(t),
    wantsSour: /酸|果酸|酸甜|开胃/.test(t),
    wantsBitter: /苦|ipa|酒花|硬一点/.test(t),
    wantsTalk: /聊天|聊聊|开场|破冰|社交|认识|朋友|搭子/.test(t),
    wantsProject: /项目|产品|创业|合作|ai|工作/.test(t),
    wantsRelax: /下班|累|放松|松弛|休息|放空/.test(t),
    wantsSurprise: /不一样|惊喜|特别|记忆点|有趣/.test(t),
    wantsCelebrate: /庆祝|开心|碰杯|高兴/.test(t),
    wantsSolo: /一个人|自己待会|安静|独处/.test(t),
    gotScolded: /被老婆骂|被对象骂|被骂|吵架|委屈|难受/.test(t),
    heartTired: /烦|崩溃|emo|心累|难受|压抑/.test(t)
  };
}

function chooseArchetype(intent) {
  const score = (a) => a.triggers.reduce((n, key) => n + ({
    relax: intent.wantsRelax, talk: intent.wantsTalk, light: intent.wantsLight, sweet: intent.wantsSweet,
    fresh: intent.wantsFresh, sour: intent.wantsSour, bitter: intent.wantsBitter, project: intent.wantsProject,
    surprise: intent.wantsSurprise, celebrate: intent.wantsCelebrate, solo: intent.wantsSolo
  }[key] ? 1 : 0), 0);
  return [...archetypes].sort((a,b)=>score(b)-score(a))[0] || archetypes[0];
}

function isLowConfidence(intent, text) {
  const hits = [intent.wantsLight, intent.wantsSweet, intent.wantsFresh, intent.wantsSour, intent.wantsBitter, intent.wantsTalk, intent.wantsProject, intent.wantsRelax, intent.wantsSurprise, intent.wantsCelebrate, intent.wantsSolo, intent.gotScolded, intent.heartTired].filter(Boolean).length;
  return hits === 0 && (text || '').trim().length > 0;
}

function scoreDrink(drink, text, intent, archetype) {
  let score = 0;
  const allText = (text || '').toLowerCase();
  const hit = (arr, weight = 2) => arr.forEach(tag => { if (allText.includes(String(tag).toLowerCase())) score += weight; });
  hit(drink.taste, 3); hit(drink.mood, 3); hit(drink.social, 2);
  if (archetype.drinks.includes(drink.name)) score += 6;
  if (intent.wantsLight && ['none', 'low'].includes(drink.strength)) score += 6;
  if (intent.wantsLight && drink.strength === 'high') score -= 4;
  if (intent.wantsSweet && ['马冬莓', '泰奶减法酪', '鲜榨乌龙荔枝啵啵', '香波精灵'].includes(drink.name)) score += 5;
  if (intent.wantsFresh && ['春夏', '0糖皮尔森', '日出的人', '山野曼波'].includes(drink.name)) score += 5;
  if (intent.wantsSour && ['香波精灵', '海边假日', '醋不及防', '屑橙2.0', '不止苏梅'].includes(drink.name)) score += 5;
  if (intent.wantsBitter && ['嬉皮小子', '西海岸的梦', '一次重逢'].includes(drink.name)) score += 5;
  if (intent.wantsTalk && ['香波精灵', '马冬莓', '鲜榨乌龙荔枝啵啵', '海边假日', '0糖皮尔森'].includes(drink.name)) score += 4;
  if (intent.wantsProject && ['嬉皮小子', '西海岸的梦', '日出的人'].includes(drink.name)) score += 4;
  if (intent.wantsRelax && ['春夏', '海边假日', '山野曼波', '0糖皮尔森'].includes(drink.name)) score += 5;
  if (intent.wantsSurprise && ['醋不及防', '花海巡游蜜瓜龙', '不止苏梅', '屑橙2.0'].includes(drink.name)) score += 5;
  if (intent.wantsCelebrate && ['不止苏梅', '西海岸的梦', '一次重逢'].includes(drink.name)) score += 4;
  if (intent.wantsSolo && ['春夏', '听涛', '0糖皮尔森'].includes(drink.name)) score += 4;
  if (intent.gotScolded && ['春夏', '马冬莓', '海边假日', '泰奶减法酪'].includes(drink.name)) score += 5;
  if (intent.heartTired && ['春夏', '海边假日', '听涛'].includes(drink.name)) score += 4;
  return score;
}

function buildWarmOpening(text, intent, lowConfidence) {
  if (lowConfidence) return '你这句话我听见了，但你现在还没有把“想喝什么感觉”说得很明显。更像是在丢一个状态给我，让我先摸一下你的边。';
  if (intent.gotScolded) return '哎，那你今天确实有点委屈了。被自己在意的人说两句，表面上像小事，心里其实会一直挂着。';
  if (intent.heartTired) return '听起来你今天真的有点撑着了。人一累的时候，想喝的往往也不是酒本身，而是那种终于能松一口气的感觉。';
  if (intent.wantsRelax && intent.wantsTalk) return '你今天这个状态我能理解：已经有点累了，但又不甘心就这么把今晚草草过掉。';
  if (intent.wantsProject) return '你这个状态挺明显的，你不是来随便热闹一下的，你还是想遇到能聊得动的人。';
  if (intent.wantsSolo) return '你现在更像是想先把自己安顿好，再决定要不要和这个世界继续打招呼。';
  if (intent.wantsSweet) return '你现在其实挺需要一点柔软的东西，不是那种上来就给你压力的味道。';
  if (intent.wantsSurprise) return '你今天不想喝得太普通，这个我懂。有时候人不是馋酒，是想给今晚找一个像样的开头。';
  return '你这个状态我大概懂，不是单纯想点一杯喝的，而是想找一个更适合今晚自己的感觉。';
}

function buildWarmBreakdown(intent, lowConfidence) {
  if (lowConfidence) {
    return '所以我先不急着给你特别死的结论。\n\n如果你只是想随便喝一杯，那我会给你一杯安全、轻松、不会出错的；\n如果你其实是心里有点东西没说完，那我会更偏向一杯能让人慢慢松下来的。';
  }
  const parts = [];
  if (intent.gotScolded) parts.push('像这种时候，其实人会有两股劲拧在一起：一边是委屈，一边又不想把自己弄得更狼狈。');
  if (intent.wantsRelax) parts.push('所以你现在第一需要的，不是刺激，而是先把人从绷着的状态里放下来。');
  if (intent.wantsTalk) parts.push('但你也没有真的想把自己封起来，你还是希望今晚有一点连接感，只是别太费劲。');
  if (intent.wantsProject) parts.push('如果你还想跟人聊点有内容的，那这杯酒就不能太抢戏，要给你留清醒度。');
  if (intent.wantsLight) parts.push('你自己也说了别太烈，这说明你很清楚自己现在更需要的是被扶一下，不是被推一把。');
  if (intent.wantsSweet) parts.push('你想要的那种甜，不是幼稚的甜，是一种让人愿意放下防备的甜。');
  if (intent.wantsSolo) parts.push('你现在适合的节奏，应该是慢慢进入，不是被现场一下卷进去。');
  if (intent.wantsSurprise) parts.push('而且你也不想今晚太平，所以这杯酒还得带一点小小的记忆点。');
  if (!parts.length) parts.push('你现在最需要的，不是标准答案，而是一杯能顺着你当下情绪往下走的酒。');
  return parts.join('\n\n');
}

function buildBridge(drink) {
  return `所以顺着你现在这个状态，我会更想把「${drink.name}」推给你。`;
}

function bartenderPitch(drink, intent) {
  let line = `${drink.desc}`;
  if (intent.gotScolded) line += ' 这种时候就别硬上太冲的，让自己先缓一缓，比什么都重要。';
  if (intent.wantsRelax) line += ' 它会先把你松下来，不会一口下去整个人更绷。';
  if (intent.wantsTalk) line += ' 如果待会儿你想和谁聊两句，它也属于那种比较容易把气氛打开的类型。';
  if (intent.wantsProject) line += ' 而且它不会把你的判断力盖掉，聊正经事也不会乱。';
  if (intent.wantsSweet) line += ' 入口会更友好一点，人也容易跟着软下来。';
  if (intent.wantsSurprise) line += ' 同时它又不是完全没脾气的那种，还是有点记忆点。';
  return line;
}

function buildOrderLine(drink) {
  return `如果你愿意，就去吧台说一句：我今天想喝「${drink.name}」。`; 
}

function notice(drink, archetype) {
  const strength = drink.strength === 'high' ? '这杯酒精度偏高，建议慢一点喝。' : drink.strength === 'none' ? '这杯是无酒精选项，适合想保持清醒但又想参与气氛的时候。' : drink.strength === 'low' ? '这杯低酒精、好入口，比较适合现在这种需要慢慢缓的状态。' : '这杯整体比较稳，适合边喝边聊。';
  return `${archetype.name}｜${archetype.formula}。${strength}`;
}

function pickByVariant(ranked, variant = 0) {
  if (!ranked.length) return null;
  const seen = new Set();
  const unique = ranked.filter(x => {
    if (seen.has(x.drink.name)) return false;
    seen.add(x.drink.name);
    return true;
  });
  const pool = unique.slice(0, Math.min(5, unique.length));
  return (pool[variant % pool.length] || unique[0]).drink;
}

function variantOpening(text, intent, lowConfidence, variant) {
  const base = buildWarmOpening(text, intent, lowConfidence);
  const alt1 = lowConfidence ? '你这句话里留白还挺多，我先不急着替你下定义。先按你现在的氛围来陪你选一杯。' : (intent.wantsRelax ? '你现在这个状态，不太适合被推着走，反而适合先让自己慢一点。' : '你这句里其实已经把情绪交代出来了，只是你没完全说破。');
  const alt2 = intent.gotScolded ? '今天这口气我能听出来，先别急着硬撑，先让情绪落下来一点。' : (intent.wantsTalk ? '你其实不是单纯来喝酒的，你是想找一个比较自然的切入口。' : base);
  return [base, alt1, alt2][variant % 3] || base;
}

function variantBreakdown(intent, lowConfidence, variant) {
  const base = buildWarmBreakdown(intent, lowConfidence);
  const alt1 = lowConfidence ? '如果现在还说不太清，那就先别逼自己讲完整。先从一杯不会出错、又能慢慢打开状态的开始。' : '我会先看你现在是更需要被安抚、被放松，还是更需要一个能把话接出去的状态。';
  const alt2 = intent.wantsLight ? '你已经说了别太烈，这个边界其实很重要。说明你要的是陪伴型的酒，不是压过你情绪的酒。' : base;
  return [base, alt1, alt2][variant % 3] || base;
}

function variantBridge(drink, variant) {
  const arr = [
    `所以顺着你现在这个状态，我会更想把「${drink.name}」推给你。`,
    `如果让我现在就替你递一杯，我会先把「${drink.name}」放到你手边。`,
    `照你刚刚那段话，我最后会把选择落在「${drink.name}」上。`
  ];
  return arr[variant % arr.length];
}

function variantPitch(drink, intent, variant) {
  const base = bartenderPitch(drink, intent);
  const alt1 = `${drink.desc} 它不是那种很用力的酒，反而更适合让人慢慢进状态。`;
  const alt2 = `${drink.desc} 如果今晚你不想太硬、又不想太无聊，这杯会比安全牌多一点意思。`;
  return [base, alt1, alt2][variant % 3] || base;
}

function recommend(input) {
  const text = input.freeText || '';
  const variant = Number(input.variant || 0);
  const intent = inferIntent(text);
  const lowConfidence = isLowConfidence(intent, text);
  const archetype = chooseArchetype(intent);
  const drinks = loadDrinks();
  const ranked = drinks.map(drink => ({ drink, score: scoreDrink(drink, text, intent, archetype) })).sort((a, b) => b.score - a.score);
  const picked = pickByVariant(ranked, variant) || drinks[0];
  return {
    archetype: archetype.name,
    formula: archetype.formula,
    opening: variantOpening(text, intent, lowConfidence, variant),
    breakdown: variantBreakdown(intent, lowConfidence, variant),
    bridge: variantBridge(picked, variant),
    bartenderPitch: variantPitch(picked, intent, variant),
    drink: picked,
    orderLine: buildOrderLine(picked),
    notice: notice(picked, archetype)
  };
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(loadHtml());
  }
  if (req.method === 'GET' && req.url.startsWith('/assets/')) {
    const safePath = req.url.replace(/^\//, '');
    const filePath = path.join(__dirname, safePath);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      return fs.createReadStream(filePath).pipe(res);
    }
  }
  if (req.method === 'POST' && req.url === '/recommend') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const input = JSON.parse(body || '{}');
        const result = recommend(input);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

const port = 3477;
server.listen(port, () => {
  console.log(`AI bartender running at http://localhost:${port}`);
});
