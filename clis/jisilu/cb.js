import { cli, Strategy } from '@jackwener/opencli/registry';
import { CliError } from '@jackwener/opencli/errors';

// Sort field definitions: key -> { prop: field name in API response, label: display name }
const SORT_FIELDS = {
  price:        { prop: 'price',        label: '现价' },
  change:       { prop: 'increase_rt',  label: '涨跌幅' },
  premium:      { prop: 'premium_rt',   label: '转股溢价率' },
  ytm:          { prop: 'ytm_rt',       label: '到期收益率' },
  volume:       { prop: 'volume',       label: '成交额' },
  turnover:     { prop: 'turnover_rt',  label: '换手率' },
  convertValue: { prop: 'convert_value',label: '转股价值' },
  yearLeft:     { prop: 'year_left',    label: '剩余年限' },
  stockChange:  { prop: 'sincrease_rt', label: '正股涨跌' },
  pb:           { prop: 'pb',           label: '正股PB' },
};

const VALID_SORT_KEYS = Object.keys(SORT_FIELDS).join(' / ');

cli({
  site: 'jisilu',
  name: 'cb',
  description: '集思录可转债列表（支持排序和条数限制）',
  domain: 'www.jisilu.cn',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'sort',  type: 'string', default: 'price',   help: `排序字段：${VALID_SORT_KEYS}` },
    { name: 'order', type: 'string', default: 'asc',     help: '排序方向：asc (升序) / desc (降序)' },
    { name: 'limit', type: 'int',    default: 50,        help: '返回数量，默认50' },
  ],
  columns: [
    'rank', 'bondId', 'bondName', 'price', 'priceChangePct',
    'stockId', 'stockName', 'stockPrice', 'stockPriceChangePct', 'pb',
    'convertPrice', 'convertValue', 'premiumRate',
    'rating', 'volatilityRate', 'forceRedeemPrice',
    'maturityDate', 'yearLeft', 'ytmRate',
    'currIssAmt', 'volume', 'turnoverRate',
    'market', 'listDate', 'lastTime',
  ],
  func: async (page, kwargs) => {
    // Navigate to the page
    await page.goto('https://www.jisilu.cn/web/data/cb/list');

    // Wait for Vue component to load data (table to appear)
    await page.wait({ selector: 'table tbody tr', timeout: 30 });

    // Extract data from Vue component
    const rawData = await page.evaluate(`(() => {
      const vm = document.querySelector('#app').__vue__.$children[0].$children[1].$children[1].$children.find(c => c.$options.name === 'nav-data-cb-list');
      if (!vm || !vm.dataRaw || !Array.isArray(vm.dataRaw.list)) {
        return { list: [], error: 'Component not found or data not loaded' };
      }
      return { list: vm.dataRaw.list };
    })()`);

    if (!rawData || !Array.isArray(rawData.list) || rawData.list.length === 0) {
      throw new CliError('NO_DATA', 'Failed to load convertible bond data from jisilu.cn');
    }

    // Parse arguments
    const sortKey = String(kwargs.sort || 'price').toLowerCase();
    const sortField = SORT_FIELDS[sortKey];
    if (!sortField) {
      throw new CliError('INVALID_ARGUMENT', `Unknown sort "${sortKey}". Valid: ${VALID_SORT_KEYS}`);
    }

    const order = String(kwargs.order || 'asc').toLowerCase();
    if (order !== 'asc' && order !== 'desc') {
      throw new CliError('INVALID_ARGUMENT', 'Order must be "asc" or "desc"');
    }

    const limit = Math.max(1, Math.min(Number(kwargs.limit) || 50, 500));

    // Sort the data
    const sorted = [...rawData.list].sort((a, b) => {
      const valA = a[sortField.prop];
      const valB = b[sortField.prop];
      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (typeof valA === 'string') {
        return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return order === 'asc' ? valA - valB : valB - valA;
    });

    // Map to output columns
    return sorted.slice(0, limit).map((item, index) => ({
      rank:                  index + 1,
      bondId:                String(item.bond_id || ''),
      bondName:              String(item.bond_nm || ''),
      price:                 item.price != null ? Number(item.price) : null,
      priceChangePct:        item.increase_rt != null ? Number(item.increase_rt) : null,
      stockId:               String(item.stock_id || ''),
      stockName:             String(item.stock_nm || ''),
      stockPrice:            item.sprice != null ? Number(item.sprice) : null,
      stockPriceChangePct:   item.sincrease_rt != null ? Number(item.sincrease_rt) : null,
      pb:                    item.pb != null ? Number(item.pb) : null,
      convertPrice:          item.convert_price != null ? Number(item.convert_price) : null,
      convertValue:          item.convert_value != null ? Number(item.convert_value) : null,
      premiumRate:           item.premium_rt != null ? Number(item.premium_rt) : null,
      rating:                String(item.rating_cd || ''),
      volatilityRate:        item.volatility_rate != null ? Number(item.volatility_rate) : null,
      forceRedeemPrice:      item.force_redeem_price != null ? Number(item.force_redeem_price) : null,
      maturityDate:          String(item.maturity_dt || ''),
      yearLeft:              item.year_left != null ? Number(item.year_left) : null,
      ytmRate:               item.ytm_rt != null ? Number(item.ytm_rt) : null,
      currIssAmt:            item.curr_iss_amt != null ? Number(item.curr_iss_amt) : null,
      volume:                item.volume != null ? Number(item.volume) : null,
      turnoverRate:          item.turnover_rt != null ? Number(item.turnover_rt) : null,
      market:                String(item.market_cd || ''),
      listDate:              String(item.list_dt || ''),
      lastTime:              String(item.last_time || ''),
    }));
  },
});
