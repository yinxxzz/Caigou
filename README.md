# 赠品采购预测工作台

供应链侧销售转化赠品采购预测管理系统。

## 功能概述

- **新增活动**：配置活动信息、赠品组合、订单预测、采购建议、最终 SKU 定稿
- **活动复盘**：查看历史活动复盘数据，包括 SKU 消耗、订单对比、消耗排行等

## 技术栈

- **框架**: Next.js 16 + React 19 + TypeScript
- **样式**: Tailwind CSS
- **数据库**: SQLite (使用 @libsql/client)
- **包管理**: npm

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

启动开发服务器后，访问以下接口初始化数据库：

```bash
curl -X POST http://localhost:3001/api/db/init
```

或者在浏览器中访问：`http://localhost:3001/api/db/init`

### 3. 启动开发服务器

```bash
npm run dev
```

项目将在 http://localhost:3001 启动。

## 项目结构

```
gift-procurement-workbench/
├── app/
│   ├── api/                          # API 路由
│   │   ├── db/init/                  # 数据库初始化
│   │   └── procurement/              # 业务 API
│   │       ├── base-config/          # 基础配置 API
│   │       └── activities/           # 活动管理 API
│   ├── new-activity/                 # 新增活动页面
│   ├── retrospect/                   # 活动复盘页面
│   └── layout.tsx                    # 根布局
├── components/
│   ├── layout/                       # 布局组件
│   │   ├── Sidebar.tsx               # 左侧导航
│   │   └── WorkArea.tsx              # 右侧工作区
│   ├── new-activity/                 # 新增活动相关组件
│   ├── retrospect/                   # 活动复盘相关组件
│   └── ui/                           # 通用 UI 组件
├── lib/
│   ├── db.ts                         # 数据库连接
│   ├── types.ts                      # TypeScript 类型定义
│   ├── services/                     # 业务服务层
│   └── cursor-data-packs/            # Cursor 数据包生成
└── README.md
```

## 数据表设计

### procurement_base_config
基础配置表（单例），存储全局配置如 keyfrom、成本上限、供应链渠道等。

### procurement_activities
月度活动表，存储活动主题、时间、状态、订单预测和采购建议等信息。

### procurement_gift_packages
礼包配置表，存储礼包名称、选择规则（N选M）、适用范围等。

### procurement_order_forecasts
订单预测结果表，存储本月预估/已完成/剩余订单、下月预估订单、预测依据等。

### procurement_final_skus
最终 SKU 定稿表，存储 SKU 编码、商品名称、采购量、状态等。

### procurement_review_snapshots
复盘快照表，存储活动复盘的汇总数据（订单偏差、SKU 偏差、成本等）。

### procurement_review_sku_items
SKU 消耗复盘表，存储每个 SKU 的预估需求、实际消耗、偏差等明细。

### procurement_candidate_pool_items
候补池快照表，存储候补商品信息（V2 功能）。

## API 文档

### 基础配置

- `GET /api/procurement/base-config` - 获取基础配置
- `PUT /api/procurement/base-config` - 更新基础配置

### 活动管理

- `GET /api/procurement/activities` - 获取活动列表（可按月份筛选）
- `POST /api/procurement/activities` - 创建新活动
- `GET /api/procurement/activities/:id` - 获取活动详情（包含礼包、订单预测、SKU）
- `PUT /api/procurement/activities/:id` - 更新活动

### 礼包配置

- `PUT /api/procurement/activities/:id/packages` - 保存礼包配置

### 订单预测

- `PUT /api/procurement/activities/:id/order-forecast` - 保存订单预测结果

## 开发计划

### ✅ 已完成（V1 MVP）

- [x] 项目初始化和基础配置
- [x] 数据库表结构设计和初始化
- [x] 左侧导航和布局
- [x] 新增活动页面（基础版）
- [x] 活动复盘页面（基础版）
- [x] 活动管理 API（创建、查询、更新）
- [x] 礼包配置 API
- [x] 订单预测 API

### 🚧 待完成（V1）

- [ ] 采购建议 API
- [ ] 最终 SKU 定稿 API
- [ ] 复盘数据生成 API
- [ ] 真实查数回填和测试
- [ ] 表单验证和错误提示
- [ ] 生成订单预测/采购建议数据包功能（复制给 Cursor）

### 📋 计划中（V2）

- [ ] 真实数仓接口对接
- [ ] 候补池石墨读取
- [ ] Cursor Skill（订单预测和采购建议）
- [ ] 导出功能（Excel）
- [ ] 图表可视化（Echarts/Recharts）
- [ ] 权限控制

## 业务口径说明

### 订单口径（V1 固定内置）
- 指定 keyfrom / 一级 keyfrom
- 系统课
- 全部订单状态，包含退费

### 供应链消耗口径（V1 固定内置）
- 运单类型：系统课加赠
- 库存渠道：辅导服务-用户增长-扩科
- channelId=1051
- 实际消耗：产生运单即计入，不只看已发货

## 注意事项

1. 工作台只展示真实保存和回填数据；未完成真实查数前保持待回填状态
2. 供应链接口分页从 page=0 开始
3. 数据库使用本地 SQLite，生产环境可考虑迁移到 PostgreSQL 或其他数据库

## License

内部项目，仅供内部使用。
