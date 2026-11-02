// =====================================================================
//  qiq 插件市场 —— 前端逻辑
//  零依赖、零构建：读 market.json 渲染目录，附搜索 / 标签筛选 / 排序 /
//  详情抽屉 / 复制市场地址。所有用户可控文本都走转义，不拼 HTML 字符串。
// =====================================================================

const MARKET_FILE = 'market.json';

const state = {
  plugins: [],
  market: null,
  query: '',
  tag: '',
  sort: 'name'
};

const $ = id => document.getElementById(id);

// ── 启动 ─────────────────────────────────────────────────────────────

initThemeToggle();
renderSkeletons();
loadMarket();

async function loadMarket() {
  try {
    const response = await fetch(MARKET_FILE, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);

    const market = await response.json();
    const plugins = Array.isArray(market.plugins) ? market.plugins : [];
    if (plugins.length === 0) throw new Error('清单里没有任何插件');

    state.market = market;
    state.plugins = plugins;

    renderStats();
    renderTags();
    renderGrid();
    bindToolbar();
  } catch (error) {
    renderError(error);
  }
}

// ── 渲染：统计 ───────────────────────────────────────────────────────

function renderStats() {
  const tags = new Set();
  for (const plugin of state.plugins) {
    for (const tag of plugin.tags || []) tags.add(tag);
  }

  $('stat-total').textContent = state.plugins.length;
  $('stat-installable').textContent = state.plugins.filter(isInstallable).length;
  $('stat-tags').textContent = tags.size;
  $('stat-updated').textContent = formatDate(state.market.updatedAt);

  $('stats').hidden = false;

  const url = marketUrl();
  $('market-url').textContent = url;
  $('open-json').href = MARKET_FILE;
}

// ── 渲染：标签筛选 ───────────────────────────────────────────────────

function renderTags() {
  const tags = new Map();
  for (const plugin of state.plugins) {
    for (const tag of plugin.tags || []) tags.set(tag, (tags.get(tag) || 0) + 1);
  }

  const container = $('tag-chips');
  container.replaceChildren();

  const all = makeChip('全部', state.plugins.length, '', state.tag === '');
  container.append(all);

  for (const [tag, count] of [...tags].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))) {
    container.append(makeChip(tag, count, tag, state.tag === tag));
  }

  $('filters').hidden = false;
}

function makeChip(label, count, value, pressed) {
  const chip = document.createElement('button');
  chip.className = 'chip';
  chip.type = 'button';
  chip.setAttribute('aria-pressed', String(pressed));
  chip.textContent = `${label} ${count}`;
  chip.addEventListener('click', () => {
    state.tag = value;
    renderTags();
    renderGrid();
  });
  return chip;
}

// ── 渲染：插件网格 ───────────────────────────────────────────────────

function renderGrid() {
  const grid = $('grid');
  grid.replaceChildren();

  const list = visiblePlugins();

  if (list.length === 0) {
    grid.append(buildEmptyState());
    return;
  }

  grid.append(...list.map((plugin, index) => buildCard(plugin, index)));
}

function visiblePlugins() {
  const query = state.query.trim().toLowerCase();

  const filtered = state.plugins.filter(plugin => {
    if (state.tag && !(plugin.tags || []).includes(state.tag)) return false;
    if (!query) return true;
    const haystack = [
      plugin.id, plugin.name, plugin.author, plugin.description,
      plugin.category, plugin.license, ...(plugin.tags || [])
    ].join(' ').toLowerCase();
    return haystack.includes(query);
  });

  const byName = (a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), 'zh');
  if (state.sort === 'size') return filtered.sort((a, b) => (b.size || 0) - (a.size || 0));
  if (state.sort === 'published') {
    return filtered.sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
  }
  return filtered.sort(byName);
}

function buildCard(plugin, index) {
  const card = document.createElement('article');
  card.className = 'card';
  card.style.animationDelay = `${Math.min(index, 12) * 24}ms`;
  card.tabIndex = 0;
  card.addEventListener('click', () => openDrawer(plugin));
  card.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDrawer(plugin);
    }
  });

  // 头部：图标 + 名称 + 版本
  const head = document.createElement('div');
  head.className = 'card__head';
  head.append(buildIcon(plugin));

  const title = document.createElement('div');
  title.className = 'card__title';

  const name = document.createElement('div');
  name.className = 'card__name';
  name.textContent = plugin.name || plugin.id;

  const meta = document.createElement('div');
  meta.className = 'card__meta';
  meta.textContent = `v${plugin.version || '0.0.0'}  ·  ${plugin.author || '未知作者'}`;

  title.append(name, meta);
  head.append(title, buildInstallBadge(plugin));
  card.append(head);

  // 描述
  const desc = document.createElement('p');
  desc.className = 'card__desc';
  desc.textContent = plugin.description || '这个插件还没有写描述。';
  card.append(desc);

  // 标签
  if ((plugin.tags || []).length) {
    const chips = document.createElement('div');
    chips.className = 'chips';
    for (const tag of plugin.tags.slice(0, 4)) {
      const chip = document.createElement('span');
      chip.className = 'chip chip--static';
      chip.textContent = tag;
      chips.append(chip);
    }
    card.append(chips);
  }

  // 底部
  const foot = document.createElement('div');
  foot.className = 'card__foot';

  const view = document.createElement('span');
  view.className = 'btn btn--sm btn--ghost';
  view.textContent = '查看详情';
  foot.append(view);

  const size = document.createElement('span');
  size.className = 'card__size';
  size.textContent = plugin.size ? formatSize(plugin.size) : '';
  foot.append(size);

  card.append(foot);
  return card;
}

function buildIcon(plugin) {
  const icon = document.createElement('span');
  icon.className = 'card__icon';
  const label = String(plugin.name || plugin.id || '?').trim();
  icon.textContent = label.slice(0, 1).toUpperCase();
  if (plugin.icon) {
    const img = document.createElement('img');
    img.src = plugin.icon;
    img.alt = '';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover';
    icon.replaceChildren(img);
  }
  return icon;
}

function buildInstallBadge(plugin) {
  const badge = document.createElement('span');
  if (isInstallable(plugin)) {
    badge.className = 'badge badge--ok';
    badge.textContent = '可安装';
  } else {
    badge.className = 'badge badge--warn';
    badge.title = '清单里没有下载地址，只能浏览';
    badge.textContent = '仅浏览';
  }
  return badge;
}

function isInstallable(plugin) {
  if (plugin.installable === false) return false;
  return Boolean(plugin.url);
}

// ── 详情抽屉 ─────────────────────────────────────────────────────────

function openDrawer(plugin) {
  $('drawer-icon').textContent = String(plugin.name || plugin.id).slice(0, 1).toUpperCase();
  $('drawer-title').textContent = plugin.name || plugin.id;
  $('drawer-sub').textContent = `${plugin.id}  ·  v${plugin.version || '0.0.0'}`;

  const body = $('drawer-body');
  body.replaceChildren();

  // 描述
  const desc = document.createElement('p');
  desc.style.margin = '0';
  desc.textContent = plugin.description || '这个插件还没有写描述。';
  body.append(desc);

  // 基本信息
  body.append(sectionTitle('基本信息'));
  const dl = document.createElement('dl');
  dl.className = 'dl';
  addPair(dl, '插件 Id', plugin.id, true);
  addPair(dl, '版本', plugin.version || '0.0.0', true);
  addPair(dl, '作者', plugin.author || '未知', false);
  addPair(dl, '分类', plugin.category || '未分类', false);
  addPair(dl, '许可证', plugin.license || '未声明', false);
  addPair(dl, '包体积', plugin.size ? formatSize(plugin.size) : '未知', true);
  addPair(dl, '更新时间', formatDate(plugin.publishedAt), false);
  if (plugin.minAppVersion) addPair(dl, '最低框架版本', plugin.minAppVersion, true);
  if ((plugin.requires || []).length) addPair(dl, '依赖插件', plugin.requires.join('、'), false);
  body.append(dl);

  // 标签
  if ((plugin.tags || []).length) {
    body.append(sectionTitle('标签'));
    const chips = document.createElement('div');
    chips.className = 'chips';
    for (const tag of plugin.tags) {
      const chip = document.createElement('span');
      chip.className = 'chip chip--static';
      chip.textContent = tag;
      chips.append(chip);
    }
    body.append(chips);
  }

  // 校验信息
  if (plugin.sha256) {
    body.append(sectionTitle('sha256 校验值'));
    const hash = document.createElement('div');
    hash.className = 'hash';
    hash.textContent = plugin.sha256;
    body.append(hash);
  }

  // 操作
  const actions = document.createElement('div');
  actions.className = 'drawer__actions';

  const install = document.createElement('button');
  install.className = 'btn btn--primary';
  install.textContent = '复制安装地址';
  install.disabled = !isInstallable(plugin);
  install.addEventListener('click', () => copyText(resolveUrl(plugin.url), '下载地址已复制'));
  actions.append(install);

  if (plugin.homepage) {
    const home = document.createElement('a');
    home.className = 'btn';
    home.href = plugin.homepage;
    home.target = '_blank';
    home.rel = 'noopener';
    home.textContent = '项目主页';
    actions.append(home);
  }
  body.append(actions);

  $('drawer').hidden = false;
  $('backdrop').classList.add('is-open');
  $('drawer').classList.add('is-open');
  $('drawer-close').focus();
}

function closeDrawer() {
  $('drawer').classList.remove('is-open');
  $('backdrop').classList.remove('is-open');
  setTimeout(() => { $('drawer').hidden = true; }, 260);
}

function sectionTitle(text) {
  const node = document.createElement('div');
  node.className = 'section-title';
  node.textContent = text;
  return node;
}

function addPair(dl, key, value, mono) {
  const dt = document.createElement('dt');
  dt.textContent = key;
  const dd = document.createElement('dd');
  dd.textContent = value;
  if (mono) dd.className = 'mono';
  dl.append(dt, dd);
}

// ── 工具栏 / 全局交互 ────────────────────────────────────────────────

function bindToolbar() {
  const search = $('search');
  let timer = null;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.query = search.value;
      renderGrid();
    }, 140);
  });

  $('sort').addEventListener('change', event => {
    state.sort = event.target.value;
    renderGrid();
  });

  $('copy-market').addEventListener('click', () => copyText(marketUrl(), '市场地址已复制'));

  $('drawer-close').addEventListener('click', closeDrawer);
  $('backdrop').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('drawer').classList.contains('is-open')) closeDrawer();
  });
}

function initThemeToggle() {
  $('theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('qiq-market-theme', next); } catch (e) { /* 忽略 */ }
  });
}

// ── 状态渲染 ─────────────────────────────────────────────────────────

function renderSkeletons() {
  const grid = $('grid');
  grid.replaceChildren();
  for (let i = 0; i < 6; i++) {
    const block = document.createElement('div');
    block.className = 'skeleton-card';
    grid.append(block);
  }
}

function buildEmptyState() {
  const box = document.createElement('div');
  box.className = 'state';
  box.style.gridColumn = '1 / -1';

  const title = document.createElement('strong');
  title.textContent = '没有匹配的插件';

  const hint = document.createElement('span');
  hint.textContent = state.query ? `试试别的关键词，或清空搜索框（当前：${state.query}）` : '换个标签看看';

  box.append(title, hint);
  return box;
}

function renderError(error) {
  document.documentElement.dataset.theme ||= 'dark';

  const box = document.createElement('div');
  box.className = 'state';
  box.style.gridColumn = '1 / -1';

  const title = document.createElement('strong');
  title.textContent = '市场清单没读出来';

  const hint = document.createElement('span');
  hint.textContent = String(error && error.message ? error.message : error);

  const pre = document.createElement('pre');
  pre.textContent = [
    '排查顺序：',
    '1. 是不是直接双击打开了 index.html？浏览器不允许 file:// 读 json。',
    '   在本目录执行：node tools/serve.mjs',
    '2. 然后用 http://127.0.0.1:8320/ 打开本页。',
    '3. 若 market.json 存在但不合法，执行：node -e "JSON.parse(require(\'fs\').readFileSync(\'market.json\',\'utf8\'))"'
  ].join('\n');

  box.append(title, hint, pre);
  $('grid').replaceChildren(box);
}

// ── 工具函数 ─────────────────────────────────────────────────────────

function marketUrl() {
  return new URL(MARKET_FILE, location.href).href;
}

function resolveUrl(url) {
  if (!url) return '';
  try { return new URL(url, location.href).href; } catch (e) { return url; }
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(value) {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function copyText(text, message) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.cssText = 'position:fixed;opacity:0';
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    toast(message);
  } catch (e) {
    toast('复制失败，请手动选择文本');
  }
}

let toastTimer = null;
function toast(message) {
  const node = $('toast');
  node.textContent = message;
  node.classList.add('is-open');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('is-open'), 1900);
}
