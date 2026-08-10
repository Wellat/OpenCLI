import { cli, Strategy } from '@jackwener/opencli/registry';
import { CliError } from '@jackwener/opencli/errors';

cli({
  site: 'jisilu',
  name: 'cb-detail',
  description: '获取集思录可转债详情',
  domain: 'www.jisilu.cn',
  strategy: Strategy.COOKIE,
  access: 'read',
  browser: true,
  args: [
    { name: 'code', required: true, positional: true, help: '可转债代码，例如111000' },
  ],
  columns: [
    'bond_code',
    'bond_name',
    'industry',
    'start_date',
    'list_date',
    'maturity_date',
    'convert_start_date',
    'put_start_date',
    'convert_price',
    'put_price',
    'redemption_price',
    'issue_size',
    'remaining_size',
    'bond_rating',
    'force_redemption_trigger_price',
    'adjust_trigger_price',
    'put_trigger_price',
    'force_redeem_countdown',
    'down_revise_countdown',
    'put_countdown',
    'delisted',
    'delist_reason',
    'redemption_announcement_date',
    'last_trading_date',
    'last_conversion_date',
    'cb_event_list',
  ],
  func: async (page, kwargs) => {
    try {
      const code = kwargs.code;
    const url = `https://www.jisilu.cn/data/convert_bond_detail/${code}`;
    await page.goto(url);

    // 提取页面中的键值对
    const kvPairs = await page.evaluate(`(() => {
      const pairs = {};
      // 查找所有 class="jisilu_title" 的 td 元素
      const titleCells = document.querySelectorAll('td.jisilu_title');
      titleCells.forEach(cell => {
        const key = cell.textContent.trim();
        // 查找下一个 td.data_val 兄弟元素
        let next = cell.nextElementSibling;
        while (next && !next.classList.contains('data_val')) {
          next = next.nextElementSibling;
        }
        if (next && next.classList.contains('data_val')) {
          const value = next.textContent.trim();
          pairs[key] = value;
        }
      });

      // 特殊处理：行业信息
      const industryElement = document.getElementById('industry_new') || document.getElementById('industry_old');
      if (industryElement) {
        pairs['行业'] = industryElement.textContent.trim();
      }

      // 特殊处理：回售价（只提取数字部分，不包括"+利息"）
      const putPriceElement = document.getElementById('put_price');
      if (putPriceElement) {
        // 获取第一个文本节点内容，排除span元素
        const textContent = putPriceElement.childNodes[0]?.textContent || '';
        pairs['回售价'] = textContent.trim();
      }

      return pairs;
    })()`);

    // 映射中文标签到英文键
    const labelMap = {
      '行业': 'industry',
      '起息日': 'start_date',
      '上市日': 'list_date',
      '到期日': 'maturity_date',
      '转股起始日': 'convert_start_date',
      '回售起算日': 'put_start_date',
      '转股价': 'convert_price',
      '回售价': 'put_price',
      '到期赎回价': 'redemption_price',
      '发行规模(亿)': 'issue_size',
      '剩余规模(亿)': 'remaining_size',
      '债券评级': 'bond_rating',
      '主体评级': 'bond_rating', // 备用
      '强赎触发价': 'force_redemption_trigger_price',
      '下修触发价': 'adjust_trigger_price',
      '回售触发价': 'put_trigger_price',
      '强赎天计数': 'force_redeem_countdown',
      '下修天计数': 'down_revise_countdown',
      '回售天计数': 'put_countdown',
      '退市原因': 'delist_reason',
      '强赎公告日': 'redemption_announcement_date',
      '最后交易日': 'last_trading_date',
      '最后转股日': 'last_conversion_date',
    };

    const result = {};
    for (const [chinese, english] of Object.entries(labelMap)) {
      result[english] = kvPairs[chinese] || '';
    }
    // 确保转股价被捕获
    if (!result.convert_price && kvPairs['转股价']) {
      result.convert_price = kvPairs['转股价'];
    }

    // 设置是否退市字段
    result.delisted = kvPairs['退市原因'] ? 'true' : 'false';

    // 添加债券代码和名称
    result.bond_code = code;

    // 提取债券名称 - 从详情表格第一行的jisilu_nav单元格提取
    const bondName = await page.evaluate(`(() => {
      const navCell = document.querySelector('td.jisilu_nav');
      if (!navCell) return '';

      const text = navCell.textContent || '';
      // 提取债券名称（格式如："起帆转债 111000"）
      const match = text.match(/([^\\s]+转债)\\s+/);
      return match && match[1] ? match[1] : '';
    })()`);
    result.bond_name = bondName;

    // 提取事件列表
    const events = await page.evaluate(`(async () => {
      let tables = [];
      const allEvents = [];

      const normalizeText = (text) => (text || '').replace(/\\s+/g, ' ').trim();
      const getRowText = (row) => normalizeText(row?.textContent || '');
      const getCells = (row) => row ? row.querySelectorAll('th, td') : [];
      const looksLikeDate = (text) => /\\d{4}[-\\/.]\\d{2}[-\\/.]\\d{2}/.test(text);
      const firstDate = (text) => ((text || '').match(/\\d{4}[-\\/.]\\d{2}[-\\/.]\\d{2}/)?.[0] || '').replace(/[\\.\\/]/g, '-');
      const inferEventType = (text) => {
        if (text.includes('不强赎') || text.includes('不提前赎回')) return 'no_redemption';
        if (text.includes('不下修')) return 'no_revise';
        if (text.includes('下修')) return 'down_revise';
        if (text.includes('股派')) return 'bonus';
        if (text.includes('激励')) return 'stock_incentive';
        if (text.includes('增发')) return 'issue';
        return 'other';
      };

      // 等待事件表加载（集思录部分表格会异步渲染）
      for (let attempt = 0; attempt < 30; attempt++) {
        const pageText = normalizeText(document.body?.textContent || '');
        if (
          pageText.includes('不强赎历史')
          || pageText.includes('转股价不下修历史')
          || pageText.includes('转股价调整历史')
        ) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      tables = document.querySelectorAll('table');

      // 优先从历史区块提取（页面新版通常将历史数据渲染在这两个容器）
      const historyBlocks = ['adj_logs', 'unadj_logs']
        .map(id => document.getElementById(id))
        .filter(Boolean);
      for (const block of historyBlocks) {
        const rows = block.querySelectorAll('tr');
        for (const row of rows) {
          const cells = Array.from(getCells(row))
            .map(cell => normalizeText(cell.textContent))
            .filter(Boolean);
          if (cells.length === 0) continue;

          const rowText = cells.join(' | ');
          if (!looksLikeDate(rowText)) continue;
          if (rowText.includes('公告日') || rowText.includes('决议日') || rowText.includes('生效日期')) continue;

          const dateCell = cells.find(text => looksLikeDate(text)) || '';
          const detail = cells.length >= 3 ? cells.slice(2).join(' | ') : cells[cells.length - 1] || '';
          const eventType = inferEventType(rowText + ' ' + detail);

          allEvents.push({
            event_time: dateCell,
            event_type: eventType,
            detail,
          });
        }
      }

      // 评级历史表里的债项评级变更
      const ratingHistoryRows = [];
      for (const table of tables) {
        const rows = Array.from(table.querySelectorAll('tr'));
        const parsedRows = rows.map(row => Array.from(getCells(row)).map(cell => normalizeText(cell.textContent)));
        const headerIndex = parsedRows.findIndex(cells =>
          cells.some(text => text.includes('债项评级') || text.includes('债券评级'))
          && cells.some(text => text.includes('日期') || text.includes('时间'))
        );
        if (headerIndex === -1) continue;

        const headers = parsedRows[headerIndex];
        const dateIndex = headers.findIndex(text => text.includes('日期') || text.includes('时间'));
        const debtRatingIndex = headers.findIndex(text => text.includes('债项评级') || text.includes('债券评级'));
        const issuerRatingIndex = headers.findIndex(text => text.includes('主体评级'));
        if (dateIndex === -1 || debtRatingIndex === -1) continue;

        for (const cells of parsedRows.slice(headerIndex + 1)) {
          const eventTime = firstDate(cells[dateIndex] || cells.find(text => looksLikeDate(text)) || '');
          const debtRating = cells[debtRatingIndex] || '';
          if (!eventTime || !debtRating || debtRating.includes('会员')) continue;

          ratingHistoryRows.push({
            event_time: eventTime,
            debt_rating: debtRating,
            issuer_rating: issuerRatingIndex === -1 ? '' : cells[issuerRatingIndex] || '',
          });
        }
      }

      ratingHistoryRows
        .sort((left, right) => left.event_time.localeCompare(right.event_time))
        .forEach((row, index, rows) => {
          if (index === 0) return;

          const previous = rows[index - 1];
          if (!previous.debt_rating || previous.debt_rating === row.debt_rating) {
            return;
          }

          allEvents.push({
            event_time: row.event_time,
            event_type: 'bond_rating_change',
            detail: \`债项评级 \${previous.debt_rating} -> \${row.debt_rating}\`,
            rating_from: previous.debt_rating,
            rating_to: row.debt_rating,
            issuer_rating: row.issuer_rating,
          });
        });

      if (allEvents.length > 0) {
        return allEvents;
      }

      // 改进的辅助函数：查找事件表格
      function findEventTable(titleText, expectedMinCols) {
        // 对于不同的标题，尝试不同的固定索引范围
        const indexRanges = {
          '转股价调整历史': [5, 3, 4, 6],  // 111000用5，113601用3，优先尝试5
          '转股价不下修历史': [6, 4, 5, 7],  // 111000用6
          '不强赎历史': [7, 5, 6, 8]      // 111000用7，113601用5，优先尝试7
        };

        const indicesToTry = indexRanges[titleText] || [];

        // 首先尝试固定索引
        for (const index of indicesToTry) {
          if (index < tables.length) {
            const table = tables[index];
            const rows = table.querySelectorAll('tr');
            if (rows.length >= 2) {
              const firstRowCells = getCells(rows[0]);
              if (firstRowCells.length >= expectedMinCols) {
                // 检查第一行是否看起来像正确的表头
                const firstRowText = getRowText(rows[0]);
                // 对于不同的表格类型，检查特定的表头关键词
                let isCorrectHeader = false;
                if (titleText === '转股价调整历史') {
                  // 转股价调整历史表头应该包含"股东大会"和"生效日期"
                  isCorrectHeader = firstRowText.includes('股东大会') && firstRowText.includes('生效日期');
                } else if (titleText === '不强赎历史') {
                  // 不强赎历史表头应该包含"公告日"和"重新起算日"
                  isCorrectHeader = firstRowText.includes('公告日') && firstRowText.includes('重新起算日');
                } else if (titleText === '转股价不下修历史') {
                  // 转股价不下修历史表头应该包含"决议日"和"重新起算日"
                  isCorrectHeader = firstRowText.includes('决议日') && firstRowText.includes('重新起算日');
                }

                if (isCorrectHeader && !looksLikeDate(firstRowText)) {
                  return index;
                }
              }
            }
          }
        }

        // 如果固定索引失败，尝试所有表格
        for (let i = 0; i < tables.length; i++) {
          const table = tables[i];
          const rows = table.querySelectorAll('tr');
          if (rows.length >= 2) {
            const firstRowCells = getCells(rows[0]);
            if (firstRowCells.length >= expectedMinCols) {
              // 检查第一行是否看起来像正确的表头
              const firstRowText = getRowText(rows[0]);
              let isCorrectHeader = false;
              if (titleText === '转股价调整历史') {
                isCorrectHeader = firstRowText.includes('股东大会') && firstRowText.includes('生效日期');
              } else if (titleText === '不强赎历史') {
                isCorrectHeader = firstRowText.includes('公告日') && firstRowText.includes('重新起算日');
              } else if (titleText === '转股价不下修历史') {
                isCorrectHeader = firstRowText.includes('决议日') && firstRowText.includes('重新起算日');
              }

              if (isCorrectHeader && !looksLikeDate(firstRowText)) {
                return i;
              }
            }
          }
        }

        return -1;
      }

      // 查找转股价调整历史表格（期望7列）
      const table5Index = findEventTable('转股价调整历史', 7);
      if (table5Index !== -1) {
        const table5 = tables[table5Index];
        const rows = table5.querySelectorAll('tr');
        // 跳过表头行（索引0）
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const cells = getCells(row);
          if (cells.length >= 7) {
            const meetingDate = cells[0]?.textContent.trim() || '';
            const effectiveDate = cells[1]?.textContent.trim() || '';
            const newPrice = cells[2]?.textContent.trim() || '';
            const oldPrice = cells[3]?.textContent.trim() || '';
            const eventType = cells[4]?.textContent.trim() || '';
            const status = cells[5]?.textContent.trim() || '';
            const detail = cells[6]?.textContent.trim() || '';

            // 事件时间：优先股东大会，如果为空则用生效日期
            const eventTime = meetingDate || effectiveDate;

            // 确定事件类型英文
            let eventTypeEn = 'down_revise';
            if (eventType.includes('下修')) {
              eventTypeEn = 'down_revise';
            } else if (eventType.includes('其它')) {
              if (detail.includes('股派')) {
                eventTypeEn = 'bonus';
              } else if (detail.includes('激励')) {
                eventTypeEn = 'stock_incentive';
              } else if (detail.includes('增发')) {
                eventTypeEn = 'issue';
              } else {
                eventTypeEn = 'other';
              }
            } else {
              eventTypeEn = 'undefined';
            }

            // 只有当有实际数据时才添加事件
            if (eventTime || detail) {
              allEvents.push({
                event_time: eventTime,
                event_type: eventTypeEn,
                detail: detail
              });
            }
          }
        }
      }

      // 查找转股价不下修历史表格（期望3列）
      const table6Index = findEventTable('转股价不下修历史', 3);
      if (table6Index !== -1) {
        const table6 = tables[table6Index];
        const rows = table6.querySelectorAll('tr');
        // 跳过表头行（索引0）
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const cells = getCells(row);
          if (cells.length >= 3) {
            const resolutionDate = cells[0]?.textContent.trim() || '';
            const reStartDate = cells[1]?.textContent.trim() || '';
            const detail = cells[2]?.textContent.trim() || '';

            // 从detail推断事件类型
            let eventType = 'no_revise';
            if (detail.includes('不下修')) {
              eventType = 'no_revise';
            } else {
              eventType = 'undefined';
            }

            // 只有当有实际数据时才添加事件
            if (resolutionDate || detail) {
              allEvents.push({
                event_time: resolutionDate,
                event_type: eventType,
                detail: detail
              });
            }
          }
        }
      }

      // 查找不强赎历史表格（期望3列）
      const table7Index = findEventTable('不强赎历史', 3);
      if (table7Index !== -1) {
        const table7 = tables[table7Index];
        const rows = table7.querySelectorAll('tr');
        // 跳过表头行（索引0）
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const cells = getCells(row);
          if (cells.length >= 3) {
            const announcementDate = cells[0]?.textContent.trim() || '';
            const reStartDate = cells[1]?.textContent.trim() || '';
            const detail = cells[2]?.textContent.trim() || '';

            // 只有当有实际数据时才添加事件
            if (announcementDate || detail) {
              allEvents.push({
                event_time: announcementDate,
                event_type: 'no_redemption',
                detail: detail
              });
            }
          }
        }
      }

      return allEvents;
    })()`);

    result.cb_event_list = events.length > 0 ? events : [];

    return [result];
  } catch (error) {
    if (error instanceof Error) {
      throw new CliError('CB_DETAIL_ERROR', `获取可转债详情失败: ${error.message}`);
    }
    throw error;
  }
},
});
