# jisilu cb-detail 命令文档

## 命令描述

获取集思录可转债详情信息，支持未退市和已退市的可转债。该命令通过浏览器访问集思录网站，提取可转债的基本信息、关键日期、价格指标以及历史事件。

## 使用方法

```bash
opencli jisilu cb-detail <code> -f json
```

### 参数说明

| 参数 | 说明 | 是否必需 |
|------|------|----------|
| `code` | 可转债代码（如111000） | 是 |


## 输出字段说明

| 字段名（英文） | 字段名（中文） | 说明 | 示例 |
|----------------|----------------|------|------|
| `bond_code` | 债券代码 | 可转债代码 | "111000" |
| `bond_name` | 债券名称 | 可转债中文名称 | "起帆转债" |
| `current_price` | 当前价格 | 页面顶部行情区显示的可转债当前价格；已退市债券可能为 "-" | "141.429" |
| `industry` | 行业 | 所属行业分类 | "电力设备-电网设备-线缆部件及其他" |
| `start_date` | 起息日 | 债券开始计息日期 | "2021-05-24" |
| `list_date` | 上市日 | 债券上市交易日期 | "2021-06-17" |
| `maturity_date` | 到期日 | 债券到期日期 | "2027-05-24" |
| `convert_start_date` | 转股起始日 | 可以开始转股的日期 | "2021-11-29" |
| `put_start_date` | 回售起算日 | 可以开始回售的日期 | "2025-05-23" |
| `convert_price` | 转股价 | 当前转股价格（元） | "17.35" |
| `put_price` | 回售价 | 回售价格（元），不含利息部分 | "100.00" |
| `redemption_price` | 到期赎回价 | 到期赎回价格（元） | "115.00" |
| `issue_size` | 发行规模（亿） | 原始发行规模（亿元） | "10.000" |
| `remaining_size` | 剩余规模（亿） | 当前剩余规模（亿元） | "9.992" |
| `bond_rating` | 债券评级 | 债券信用评级 | "AA-" |
| `force_redemption_trigger_price` | 强赎触发价 | 触发强制赎回的正股价（元） | "22.555" |
| `adjust_trigger_price` | 下修触发价 | 触发转股价下修的正股价（元） | "14.748" |
| `put_trigger_price` | 回售触发价 | 触发回售的正股价（元） | "12.145" |
| `force_redeem_countdown` | 强赎天计数 | 强赎触发计数状态文本（暂不强赎 / 已计天数等） | "暂不强赎 ! 2026-10-21重新计" |
| `down_revise_countdown` | 下修天计数 | 下修触发计数状态文本（如"至少还需15天"） | "至少还需15天 ( 30天内 0/15 2025-09-11 重新计)" |
| `put_countdown` | 回售天计数 | 回售触发计数状态文本（已计/需计天数） | "0/30 \| 30" |
| `delisted` | 是否退市 | 布尔值字符串，`"true"` 表示已退市，`"false"` 表示未退市 | "false" |
| `delist_reason` | 退市原因 | 退市原因（仅已退市债券有效） | "强赎" |
| `redemption_announcement_date` | 强赎公告日 | 强赎公告日期（仅已退市债券有效） | "2026-04-03" |
| `last_trading_date` | 最后交易日 | 最后交易日（仅已退市债券有效） | "2026-04-03" |
| `last_conversion_date` | 最后转股日 | 最后转股日期（仅已退市债券有效） | "2026-04-09" |
| `cb_event_list` | 可转债事件列表 | JSON数组，包含债券历史事件 | 见下文详细说明 |

### `cb_event_list` 事件列表说明

`cb_event_list` 字段是一个JSON数组，包含可转债的历史事件，包括转股价调整、是否下修、是否强赎，以及评级历史表里的债项评级变更。每个事件包含以下字段：

```json
{
  "event_time": "事件时间（YYYY-MM-DD格式）",
  "event_type": "事件类型（见事件类型说明）",
  "detail": "事件详情描述",
  "rating_from": "变更前债项评级（仅bond_rating_change事件）",
  "rating_to": "变更后债项评级（仅bond_rating_change事件）",
  "issuer_rating": "主体评级（仅bond_rating_change事件，如页面表格提供）"
}
```

#### 事件类型说明

| 事件类型 | 说明 | 示例详情 |
|----------|------|----------|
| `down_revise` | 转股价下修 | "下修底价 17.330 元" |
| `no_revise` | 转股价不下修 | "本次不下修" |
| `no_redemption` | 不强赎（不提前赎回） | "本次（2022年10月18日至2022年11月8日）不提前赎回，以2023年5月9日（若为非交易日则顺延）为首个交易日重新起算" |
| `force_redemption` | 强赎公告 | "强赎公告 \| 强赎公告价 100.6020" |
| `other` | 其他事件 | - |
| `bonus` | 分红 | "2024年每xx股派0.04元" |
| `stock_incentive` | 股票激励 | "限制性股票激励计划" |
| `issue` | 增发 | "增发H股" |
| `bond_rating_change` | 债项评级变更 | "债项评级 A+ -> BBB+" |
| `undefined` | 未识别的事件类型（保留字段） | - |

## 使用示例

### 示例1：获取未退市可转债详情（111000）

```bash
opencli jisilu cb-detail 111000 -f json
```

输出示例（JSON格式）：
```json
{
  "bond_code": "111000",
  "bond_name": "起帆转债",
  "current_price": "141.429",
  "industry": "电力设备-电网设备-线缆部件及其他",
  "start_date": "2021-05-24",
  "list_date": "2021-06-17",
  "maturity_date": "2027-05-24",
  "convert_start_date": "2021-11-29",
  "put_start_date": "2025-05-23",
  "convert_price": "17.35",
  "put_price": "100.00",
  "redemption_price": "115.00",
  "issue_size": "10.000",
  "remaining_size": "9.992",
  "bond_rating": "AA-",
  "force_redemption_trigger_price": "22.555",
  "adjust_trigger_price": "14.748",
  "put_trigger_price": "12.145",
  "delisted": "false",
  "delist_reason": "",
  "redemption_announcement_date": "",
  "last_trading_date": "-",
  "last_conversion_date": "-",
  "cb_event_list": [
    {
      "detail": "下修底价 17.330 元",
      "event_time": "2025-09-08",
      "event_type": "down_revise"
    },
    {
      "detail": "2024年每股派0.04元",
      "event_time": "2025-07-10",
      "event_type": "other"
    }
    // ... 更多事件
  ]
}
```

### 示例2：获取已退市可转债详情（113601）

```bash
opencli jisilu cb-detail 113601 -f json
```

输出示例（JSON格式）：
```json
{
  "bond_code": "113601",
  "bond_name": "塞力转债",
  "current_price": "-",
  "industry": "医药生物-医药商业-医药流通",
  // ... 其他字段
  "delisted": "true",
  "delist_reason": "强赎",
  "redemption_announcement_date": "2026-04-03",
  "last_trading_date": "2026-04-03",
  "last_conversion_date": "2026-04-09",
  "cb_event_list": [
    {
      "detail": "下修底价 7.770 元",
      "event_time": "2025-02-06",
      "event_type": "down_revise"
    }
    // ... 更多事件
  ]
}
```
