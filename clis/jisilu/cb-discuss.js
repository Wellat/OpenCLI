import { cli, Strategy } from '@jackwener/opencli/registry';
import { CliError } from '@jackwener/opencli/errors';

cli({
  site: 'jisilu',
  name: 'cb-discuss',
  description: '获取集思录可转债相关讨论帖',
  domain: 'www.jisilu.cn',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'code', required: true, positional: true, help: '可转债代码，例如127109' },
    { name: 'limit', type: 'int', default: 10, help: '返回帖子数量，默认10' },
    { name: 'sort', type: 'string', default: 'new', help: '排序：new(最新) / hot(热门)' },
  ],
  columns: [
    'questionId',
    'title',
    'replies',
    'views',
    'publishTime',
    'url',
  ],
  func: async (page, kwargs) => {
    const code = String(kwargs.code || '').trim();
    if (!code) {
      throw new CliError('INVALID_ARGUMENT', '可转债代码不能为空');
    }

    const limit = Math.max(1, Math.min(Number(kwargs.limit) || 10, 50));

    // Step 1: 访问可转债详情页
    await page.goto(`https://www.jisilu.cn/data/convert_bond_detail/${code}`, { waitUntil: 'networkidle0' });

    // Step 2: 使用 evaluate 直接提取讨论帖数据
    // 注意：必须使用模板字符串（IIFE 格式），不能使用函数参数
    const postsData = await page.evaluate(`(() => {
      const container = document.querySelector('#tbl_questions');
      if (!container) return { error: 'Container not found' };
      
      const items = container.querySelectorAll('li');
      if (!items || items.length === 0) return { error: 'No items found' };
      
      const results = [];
      const maxLimit = ${limit};
      for (let i = 0; i < Math.min(items.length, maxLimit); i++) {
        const item = items[i];
        const linkEl = item.querySelector('a');
        const title = linkEl?.textContent?.trim() || '';
        const href = linkEl?.getAttribute('href') || '';
        const questionIdMatch = href?.match(/\\/question\\/(\\d+)/);
        const questionId = questionIdMatch ? questionIdMatch[1] : '';
        
        // 提取元信息
        const metaText = item.textContent || '';
        const repliesMatch = metaText.match(/(\\d+)\\s*个回复/);
        const viewsMatch = metaText.match(/(\\d+)\\s*次浏览/);
        const dateMatch = metaText.match(/(\\d{4}-\\d{2}-\\d{2})/);
        
        if (title && questionId) {
          results.push({
            questionId,
            title,
            replies: repliesMatch ? parseInt(repliesMatch[1], 10) : 0,
            views: viewsMatch ? parseInt(viewsMatch[1], 10) : 0,
            publishTime: dateMatch ? dateMatch[1] : '',
            url: 'https://www.jisilu.cn' + href,
          });
        }
      }
      return results;
    })()`);
    
    if (!postsData || postsData.error) {
      throw new CliError('NOT_FOUND', `未找到可转债 ${code}`);
    }
    
    const posts = postsData;

    if (posts.length === 0) {
      throw new CliError('NOT_FOUND', `未找到可转债 ${code}`);
    }

    return posts;
  },
});
