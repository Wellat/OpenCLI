import { cli, Strategy } from '@jackwener/opencli/registry';

cli({
  site: 'jisilu',
  name: 'cb',
  description: '获取集思录可转债列表',
  domain: 'www.jisilu.cn',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'limit', type: 'int', default: 50, help: '返回数量，默认50' },
  ],
  columns: ['cb_code', 'cb_name', 'stock_code', 'stock_name', 'premium_rate'],
  func: async (page, kwargs) => {
    await page.goto('https://www.jisilu.cn/web/data/cb/list');

    const data = await page.evaluate(`(async () => {
      // 等待表格出现
      let attempts = 0;
      while (attempts < 50) {
        const tables = document.querySelectorAll('table');
        if (tables.length >= 2) {
          const dataTable = tables[1] || tables[0];
          const rows = dataTable.querySelectorAll('tbody tr');
          if (rows.length > 0) {
            const results = [];
            for (const row of rows) {
              const cells = row.querySelectorAll('td');
              if (cells.length < 14) continue;

              // 列索引（从0开始）：
              // 0: 行号, 1: 操作, 2: 可转债代码, 3: 转债名称, 4: 现价, 5: 涨跌幅, 6: 正股代码, 7: 正股名称, 8: 正股价, 9: 正股涨跌, 10: 正股PB, 11: 转股价, 12: 转股价值, 13: 转股溢价率
              const cbCodeCell = cells[2];
              const cbNameCell = cells[3];
              const stockCodeCell = cells[6];
              const stockNameCell = cells[7];
              const premiumRateCell = cells[13];

              const getText = (cell) => {
                if (!cell) return '';
                const link = cell.querySelector('a');
                if (link) return link.textContent?.trim() || '';
                const span = cell.querySelector('span');
                if (span) return span.textContent?.trim() || '';
                return cell.textContent?.trim() || '';
              };

              const cbCode = getText(cbCodeCell);
              const cbName = getText(cbNameCell);
              const stockCode = getText(stockCodeCell);
              const stockName = getText(stockNameCell);
              const premiumRate = getText(premiumRateCell);

              if (cbCode) {
                results.push({
                  cb_code: cbCode,
                  cb_name: cbName,
                  stock_code: stockCode,
                  stock_name: stockName,
                  premium_rate: premiumRate,
                });
              }
            }
            return results;
          }
        }
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }
      return []; // 超时返回空数组
    })()`);

    // 应用limit
    const limit = Number(kwargs.limit) || 50;
    if (!data || !Array.isArray(data)) {
      return [];
    }
    return data.slice(0, limit);
  },
});