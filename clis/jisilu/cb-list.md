# jisilu cb-list 命令文档

## 命令描述

获取集思录可转债列表，支持活跃和已退市两种状态。该命令通过浏览器访问集思录网站（需要登录），从页面组件中提取数据。

## 使用方法

```bash
opencli jisilu cb-list -f json                  # 活跃可转债列表（默认）
opencli jisilu cb-list --delisted -f json       # 已退市可转债列表
```

### 参数说明

| 参数 | 类型 | 默认值 | 说明 | 是否必需 |
|------|------|--------|------|----------|
| `--delisted` | bool | `false` | 传 `true` 返回已退市列表，默认返回活跃列表 | 否 |

## 输出字段说明

`columns` 为固定 5 列并集。活跃模式下 `lastPrice` / `lastTradeDate` 不适用，返回 `null`。

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `bondId` | string | 可转债代码 | `"132024"` |
| `bondName` | string | 可转债名称 | `"26江铜EB"` |
| `status` | string | 状态：`active`（活跃）/ `delisted`（已退市） | `"active"` |
| `lastPrice` | number\|null | 最后交易价格（元），仅已退市模式有效，活跃模式为 `null` | `168.904` |
| `lastTradeDate` | string\|null | 最后交易日（YYYY-MM-DD），仅已退市模式有效，活跃模式为 `null`；退债可能为空 | `"2026-08-07"` |

## 使用示例

### 示例1：活跃可转债列表

```bash
opencli jisilu cb-list -f json
```

输出示例（JSON格式，节选）：
```json
[
  {
    "bondId": "132024",
    "bondName": "26江铜EB",
    "status": "active",
    "lastPrice": null,
    "lastTradeDate": null
  },
  {
    "bondId": "118073",
    "bondName": "赛斯转债",
    "status": "active",
    "lastPrice": null,
    "lastTradeDate": null
  }
]
```

### 示例2：已退市可转债列表

```bash
opencli jisilu cb-list --delisted -f json
```

输出示例（JSON格式，节选）：
```json
[
  {
    "bondId": "118053",
    "bondName": "正帆转债",
    "status": "delisted",
    "lastPrice": 168.904,
    "lastTradeDate": "2026-08-07"
  },
  {
    "bondId": "113658",
    "bondName": "密卫转债",
    "status": "delisted",
    "lastPrice": 122.192,
    "lastTradeDate": "2026-08-06"
  }
]
```

## 数据来源

| 模式 | 页面 | 页面组件 |
|------|------|----------|
| 默认 | `https://www.jisilu.cn/web/data/cb/list` | `nav-data-cb-list` |
| `--delisted` | `https://www.jisilu.cn/web/data/cb/delisted` | `nav-data-cb-delisted` |

## 注意事项

- 该命令**需要登录集思录**。未登录时组件数据加载不出来，命令会抛 `AuthRequiredError`（exit code 77），请在浏览器中先登录再重试。
- 当前数据量参考：活跃约 319 条、已退市约 720 条，随市场情况变化。
- `status` 返回英文值：`active`（活跃）/ `delisted`（已退市）。
- 退债（如 `404004 鸿达退债`）可能没有最后交易日，`lastTradeDate` 返回 `null`。
