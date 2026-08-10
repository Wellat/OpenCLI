import { cli, Strategy } from '@jackwener/opencli/registry';
import { AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';

const PAGES = {
  active: {
    url: 'https://www.jisilu.cn/web/data/cb/list',
    component: 'nav-data-cb-list',
    status: 'active',
  },
  delisted: {
    url: 'https://www.jisilu.cn/web/data/cb/delisted',
    component: 'nav-data-cb-delisted',
    status: 'delisted',
  },
};

cli({
  site: 'jisilu',
  name: 'cb-list',
  description: '集思录可转债列表（默认活跃，--delisted 返回已退市；需要登录）',
  domain: 'www.jisilu.cn',
  strategy: Strategy.COOKIE,
  access: 'read',
  browser: true,
  args: [
    { name: 'delisted', type: 'bool', default: false, help: 'true 返回已退市列表，默认返回活跃列表' },
  ],
  // 活跃模式 lastPrice / lastTradeDate 不适用，返回 null
  columns: ['bondId', 'bondName', 'status', 'lastPrice', 'lastTradeDate'],
  func: async (page, kwargs) => {
    const delisted = kwargs.delisted === true || kwargs.delisted === 'true';
    const pageCfg = delisted ? PAGES.delisted : PAGES.active;

    await page.goto(pageCfg.url);

    let rows;
    try {
      rows = await page.evaluate(`(async () => {
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const find = (c, depth) => {
          if (!c || depth > 8) return null;
          const opts = c.$options || {};
          if (opts.name === '${pageCfg.component}') return c;
          for (const ch of c.$children || []) {
            const r = find(ch, depth + 1);
            if (r) return r;
          }
          return null;
        };
        let list = null;
        for (let attempt = 0; attempt < 60; attempt++) {
          const app = document.querySelector('#app');
          if (app && app.__vue__) {
            const vm = find(app.__vue__, 0);
            if (vm && vm.dataRaw && Array.isArray(vm.dataRaw.list) && vm.dataRaw.list.length > 0) {
              list = vm.dataRaw.list;
              break;
            }
          }
          await sleep(500);
        }
        if (!list) return { list: [], error: 'component not found or data not loaded' };
        return { list };
      })()`);
    } catch (error) {
      // 数据没加载出来时，先区分是未登录还是页面结构问题
      const pageState = await page.evaluate(`(() => ({
        url: location.href,
        title: document.title || '',
        body: (document.body && document.body.textContent || '').slice(0, 200),
      }))()`).catch(() => null);
      const text = `${pageState?.url || ''} ${pageState?.title || ''} ${pageState?.body || ''}`;
      if (/login|passport|account/i.test(text) || /请登录|需要登录|会员登录/i.test(text)) {
        throw new AuthRequiredError('www.jisilu.cn', '请先在浏览器中登录集思录，再重试');
      }
      throw error instanceof Error
        ? new CommandExecutionError(`cb-list 页面数据加载失败: ${error.message}`)
        : new CommandExecutionError('cb-list 页面数据加载失败');
    }

    if (!rows || Array.isArray(rows.list) === false || rows.error) {
      throw new CommandExecutionError(`cb-list 数据提取失败: ${rows?.error || 'unknown'}`);
    }
    if (rows.list.length === 0) {
      throw new EmptyResultError(`jisilu cb-list (${delisted ? 'delisted' : 'active'})`, '没有可转债数据');
    }

    return rows.list.map((item) => {
      const row = {
        bondId: String(item.bond_id || ''),
        bondName: String(item.bond_nm || ''),
        status: pageCfg.status,
        lastPrice: null,
        lastTradeDate: null,
      };
      if (delisted) {
        row.lastPrice = item.price != null ? Number(item.price) : null;
        row.lastTradeDate = String(item.delist_dt || '').trim() || null;
      }
      return row;
    });
  },
});
