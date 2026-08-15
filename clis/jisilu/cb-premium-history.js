import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, CommandExecutionError, EmptyResultError, AuthRequiredError } from '@jackwener/opencli/errors';

const DOMAIN = 'www.jisilu.cn';

function parseDisplayNumber(value) {
  if (value == null) return null;
  const text = String(value).replace(/,/g, '').replace(/%$/, '').trim();
  if (!text || text === '-' || text === '--') return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

cli({
  site: 'jisilu',
  name: 'cb-premium-history',
  description: '集思录单只可转债历史转股溢价率数据',
  domain: DOMAIN,
  strategy: Strategy.COOKIE,
  access: 'read',
  browser: true,
  args: [
    { name: 'code', required: true, positional: true, help: '可转债代码，例如113039' },
  ],
  columns: [
    'date',
    'closePrice',
    'premiumRate',
    'remainingSize',
  ],
  func: async (page, kwargs) => {
    const code = String(kwargs.code || '').trim();
    if (!/^\d{6}$/.test(code)) {
      throw new ArgumentError('code must be a 6-digit convertible bond code');
    }

    const detailUrl = `https://${DOMAIN}/data/convert_bond_detail/${code}`;
    try {
      await page.goto(detailUrl);
    } catch (error) {
      throw new CommandExecutionError(`Failed to open jisilu convertible bond detail page: ${error.message}`);
    }

    let payloadEnvelope;
    try {
      payloadEnvelope = await page.evaluate(`(async () => {
        const response = await fetch('/data/cbnew/detail_hist/${code}', {
          credentials: 'include',
          headers: {
            Accept: 'application/json, text/javascript, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        const bodyText = await response.text();
        return {
          ok: response.ok,
          status: response.status,
          contentType: response.headers.get('content-type') || '',
          bodyText,
        };
      })()`);
    } catch (error) {
      throw new CommandExecutionError(`Failed to fetch jisilu cb premium history in page context: ${error.message}`);
    }

    if (
      payloadEnvelope.status === 401
      || payloadEnvelope.status === 403
      || /\/login\/|请登录|登录<\/a>/.test(payloadEnvelope.bodyText || '')
    ) {
      throw new AuthRequiredError(DOMAIN, '请先在浏览器中登录集思录，再重试');
    }
    if (!payloadEnvelope.ok) {
      throw new CommandExecutionError(`Jisilu cb premium history request failed: HTTP ${payloadEnvelope.status}`);
    }

    let payload;
    try {
      payload = JSON.parse(payloadEnvelope.bodyText);
    } catch (error) {
      throw new CommandExecutionError(`Failed to parse jisilu cb premium history response: ${error.message}`);
    }

    if (!payload || !Array.isArray(payload.rows)) {
      throw new CommandExecutionError('Unexpected jisilu cb premium history response shape');
    }
    if (payload.rows.length === 0) {
      throw new EmptyResultError('jisilu cb-premium-history', `No history rows for ${code}`);
    }

    const rows = payload.rows.map((entry) => {
      const sourceCell = entry?.cell || {};
      return {
        date: String(sourceCell.last_chg_dt || ''),
        closePrice: parseDisplayNumber(sourceCell.price),
        premiumRate: parseDisplayNumber(sourceCell.premium_rt),
        remainingSize: parseDisplayNumber(sourceCell.curr_iss_amt),
      };
    }).filter(row => row.date);

    if (rows.length === 0) {
      throw new EmptyResultError('jisilu cb-premium-history', `No parsable history rows for ${code}`);
    }

    return rows;
  },
});
