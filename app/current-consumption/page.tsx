'use client';

import { useEffect, useMemo, useState } from 'react';
import WorkArea from '@/components/layout/WorkArea';

type ActivityListItem = {
  id: number;
  activityMonth: string | null;
  theme: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
};

type ActivitySku = {
  id: number;
  goodsCode: string | null;
  goodsName: string | null;
  displayName: string | null;
  finalPurchaseQuantity: number | null;
  suggestedPurchaseQuantity: number | null;
  status: string | null;
};

type ActivityDetail = ActivityListItem & {
  forecast: {
    nextMonthEstimatedOrders: number | null;
    forecastBasis: string | null;
  } | null;
  skus: ActivitySku[];
};

type BaseConfig = {
  keyfromKeywords: string[];
  keyfromP1Values: string[];
  supplyChannelId: number;
  supplyChannelName: string;
};

type ConsumptionSkuResult = {
  goodsCode: string;
  goodsName?: string;
  consumedQuantity: number;
  projectedTotalQuantity: number;
  remainingEstimatedQuantity: number;
  availableQuantity: number;
  endingAvailableQuantity: number;
  status: string;
};

type ConsumptionResult = {
  progressRate: number;
  completedOrders: number;
  projectedTotalOrders: number;
  remainingEstimatedOrders: number;
  consumedSkuQuantity: number;
  projectedTotalSkuQuantity: number;
  remainingEstimatedSkuQuantity: number;
  inventoryRiskSummary: string;
  skuItems: ConsumptionSkuResult[];
};

const defaultBaseConfig: BaseConfig = {
  keyfromKeywords: [],
  keyfromP1Values: [],
  supplyChannelId: 1051,
  supplyChannelName: '辅导服务-用户增长-扩科',
};

const formatMetric = (value: number | null | undefined, unit = '') =>
  typeof value === 'number' ? `${value.toLocaleString()}${unit}` : '待回填';

const formatDailyMetric = (value: number | null | undefined) =>
  typeof value === 'number' ? `${value.toFixed(1)}` : '待回填';

const normalizeGoodsCode = (goodsCode: string | null | undefined) => goodsCode?.trim() || '';

const getInventoryStatus = (
  status: string | undefined,
  availableQuantity: number | undefined,
  endingAvailableQuantity: number | undefined,
) => {
  if (typeof availableQuantity === 'number' && availableQuantity > 2000) {
    return '滞销风险';
  }

  if (typeof endingAvailableQuantity === 'number' && endingAvailableQuantity > 2000) {
    return '滞销风险';
  }

  if (typeof endingAvailableQuantity === 'number' && endingAvailableQuantity < 100) {
    return '库存偏低';
  }

  return status || '待查数';
};

const getStatusClassName = (status: string) => {
  if (status === '够用') {
    return 'bg-green-50 text-green-700';
  }

  if (status === '待查数') {
    return 'bg-gray-50 text-gray-600';
  }

  if (status === '滞销风险') {
    return 'bg-red-50 text-red-700';
  }

  return 'bg-amber-50 text-amber-700';
};

const getInclusiveDays = (startDate: string | null | undefined, endDate: string | null | undefined) => {
  if (!startDate || !endDate) {
    return null;
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);
};

const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isActiveOnDate = (activity: ActivityListItem, dateString: string) =>
  Boolean(
    activity.startDate &&
      activity.endDate &&
      activity.startDate <= dateString &&
      dateString <= activity.endDate,
  );

const getCurrentActivity = (activityList: ActivityListItem[]) => {
  const today = toLocalDateString(new Date());
  const currentActivities = activityList.filter((activity) => isActiveOnDate(activity, today));

  return currentActivities.reduce<ActivityListItem | null>(
    (latest, activity) => (!latest || activity.id > latest.id ? activity : latest),
    null,
  );
};

export default function CurrentConsumptionPage() {
  const [activities, setActivities] = useState<ActivityListItem[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<ActivityDetail | null>(null);
  const [baseConfig, setBaseConfig] = useState<BaseConfig>(defaultBaseConfig);
  const [consumptionResultText, setConsumptionResultText] = useState('');
  const [consumptionResult, setConsumptionResult] = useState<ConsumptionResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let ignore = false;

    const loadInitialData = async () => {
      try {
        const [activitiesResponse, baseConfigResponse] = await Promise.all([
          fetch('/api/procurement/activities'),
          fetch('/api/procurement/base-config'),
        ]);

        if (!activitiesResponse.ok || !baseConfigResponse.ok) {
          throw new Error('接口请求失败');
        }

        const activityList = (await activitiesResponse.json()) as ActivityListItem[];
        const config = (await baseConfigResponse.json()) as BaseConfig;

        if (!ignore) {
          setActivities(activityList);
          setBaseConfig(config);
          const currentActivity = getCurrentActivity(activityList);
          setSelectedActivityId(currentActivity ? String(currentActivity.id) : '');
        }
      } catch {
        if (!ignore) {
          setMessage('活动或基础配置读取失败，请稍后重试');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    void loadInitialData();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedActivityId) {
      return;
    }

    let ignore = false;

    const loadActivityDetail = async () => {
      setIsDetailLoading(true);
      try {
        const response = await fetch(`/api/procurement/activities/${selectedActivityId}`);
        if (!response.ok) {
          throw new Error('活动详情请求失败');
        }

        const detail = (await response.json()) as ActivityDetail;
        if (!ignore) {
          setSelectedActivity(detail);
        }
      } catch {
        if (!ignore) {
          setMessage('活动详情读取失败，请稍后重试');
        }
      } finally {
        if (!ignore) {
          setIsDetailLoading(false);
        }
      }
    };

    void loadActivityDetail();

    return () => {
      ignore = true;
    };
  }, [selectedActivityId]);

  const totalFinalSkuQuantity = useMemo(
    () =>
      selectedActivity?.skus.reduce(
        (sum, item) => sum + (item.finalPurchaseQuantity || item.suggestedPurchaseQuantity || 0),
        0,
      ) || 0,
    [selectedActivity],
  );

  const elapsedActivityDays = useMemo(() => {
    const totalDays = getInclusiveDays(selectedActivity?.startDate, selectedActivity?.endDate);
    if (!totalDays || typeof consumptionResult?.progressRate !== 'number') {
      return null;
    }

    return Math.max(1, Math.round((totalDays * consumptionResult.progressRate) / 100));
  }, [consumptionResult, selectedActivity]);

  const resultByGoodsCode = useMemo(() => {
    const map = new Map<string, ConsumptionSkuResult>();
    consumptionResult?.skuItems.forEach((item) => {
      map.set(normalizeGoodsCode(item.goodsCode), item);
    });
    return map;
  }, [consumptionResult]);

  const skuTableRows = useMemo(() => {
    const savedSkus = selectedActivity?.skus || [];

    if (savedSkus.length > 0) {
      return savedSkus.map((item) => {
        const goodsCode = normalizeGoodsCode(item.goodsCode);
        const result = goodsCode ? resultByGoodsCode.get(goodsCode) : undefined;
        return {
          rowKey: String(item.id),
          goodsCode,
          goodsName: item.goodsName || item.displayName || result?.goodsName || '-',
          consumedQuantity: result?.consumedQuantity,
          dailyConsumedQuantity:
            typeof result?.consumedQuantity === 'number' && elapsedActivityDays
              ? result.consumedQuantity / elapsedActivityDays
              : undefined,
          projectedTotalQuantity: result?.projectedTotalQuantity,
          remainingEstimatedQuantity: result?.remainingEstimatedQuantity,
          availableQuantity: result?.availableQuantity,
          endingAvailableQuantity: result?.endingAvailableQuantity,
          status: getInventoryStatus(result?.status, result?.availableQuantity, result?.endingAvailableQuantity),
        };
      });
    }

    return (
      consumptionResult?.skuItems.map((item) => ({
        rowKey: item.goodsCode,
        goodsCode: item.goodsCode,
        goodsName: item.goodsName || '-',
        consumedQuantity: item.consumedQuantity,
        dailyConsumedQuantity: elapsedActivityDays ? item.consumedQuantity / elapsedActivityDays : undefined,
        projectedTotalQuantity: item.projectedTotalQuantity,
        remainingEstimatedQuantity: item.remainingEstimatedQuantity,
        availableQuantity: item.availableQuantity,
        endingAvailableQuantity: item.endingAvailableQuantity,
        status: getInventoryStatus(item.status, item.availableQuantity, item.endingAvailableQuantity),
      })) || []
    );
  }, [consumptionResult, elapsedActivityDays, resultByGoodsCode, selectedActivity]);

  const dataPack = {
    task: '本期消耗情况',
    activity: {
      id: selectedActivity?.id || null,
      theme: selectedActivity?.theme || '',
      activityMonth: selectedActivity?.activityMonth || '',
      startDate: selectedActivity?.startDate || '',
      endDate: selectedActivity?.endDate || '',
      status: selectedActivity?.status || '',
    },
    baseConfig: {
      courseType: '系统课',
      includeAllOrderStatuses: true,
      includeRefunds: true,
      orderFilterLogic: {
        relation: 'AND',
        keyfromP1: {
          operator: 'IN_ANY',
          values: baseConfig.keyfromP1Values,
          description: '一级 keyfrom 必须命中任一值',
        },
        keyfromKeywords: {
          operator: 'CONTAINS_ANY',
          values: baseConfig.keyfromKeywords,
          description: 'keyfrom 同时需要包含任一关键词',
        },
      },
      supplyConsumptionLogic: {
        shipmentType: '系统课加赠',
        supplyChannelId: baseConfig.supplyChannelId,
        supplyChannelName: baseConfig.supplyChannelName,
        consumptionRule: '产生运单即计入，不只看已发货',
      },
    },
    savedFinalSkus: selectedActivity?.skus || [],
    purpose: '把已保存活动的查询口径交给 Cursor，由 Cursor 查询真实订单、运单和库存后回填结果；本模块不输出采购建议',
    requiredOutput: [
      '截止当前订单量',
      '按当前速度预估全期订单',
      '剩余预计订单',
      '截止当前 SKU 消耗',
      '日均消耗',
      '预计全期 SKU 消耗',
      '剩余预计 SKU 消耗',
      '预计活动结束后库存',
      '风险 SKU',
    ],
    expectedJsonFormat: {
      progressRate: 25,
      completedOrders: 1000,
      projectedTotalOrders: 4000,
      remainingEstimatedOrders: 3000,
      consumedSkuQuantity: 1200,
      projectedTotalSkuQuantity: 4800,
      remainingEstimatedSkuQuantity: 3600,
      inventoryRiskSummary: '1 个 SKU 有库存风险',
      skuItems: [
        {
          goodsCode: 'SKU 编码',
          goodsName: '供应链商品名称',
          consumedQuantity: 100,
          dailyConsumedQuantity: 25,
          projectedTotalQuantity: 400,
          remainingEstimatedQuantity: 300,
          availableQuantity: 500,
          endingAvailableQuantity: 200,
          status: '够用',
        },
      ],
    },
  };

  const summary = {
    activityId: selectedActivity?.id || null,
    activityTheme: selectedActivity?.theme || '',
    activityRange: `${selectedActivity?.startDate || ''} 至 ${selectedActivity?.endDate || ''}`,
    source: consumptionResult ? 'Cursor 查数回填结果' : '待 Cursor 查真实订单、运单和库存后回填',
    completedOrders: consumptionResult?.completedOrders || null,
    projectedTotalOrders: consumptionResult?.projectedTotalOrders || null,
    remainingEstimatedOrders: consumptionResult?.remainingEstimatedOrders || null,
    consumedSkuQuantity: consumptionResult?.consumedSkuQuantity || null,
    projectedTotalSkuQuantity: consumptionResult?.projectedTotalSkuQuantity || null,
    remainingEstimatedSkuQuantity: consumptionResult?.remainingEstimatedSkuQuantity || null,
    inventoryRiskSummary: consumptionResult?.inventoryRiskSummary || '待回填',
    skuItems: skuTableRows,
  };

  const applyConsumptionResult = () => {
    try {
      const parsed = JSON.parse(consumptionResultText) as ConsumptionResult;

      if (!Array.isArray(parsed.skuItems)) {
        setMessage('回填失败：JSON 里需要包含 skuItems 数组');
        return;
      }

      setConsumptionResult(parsed);
      setMessage('本期消耗结果已回填到页面');
    } catch {
      setMessage('回填失败：请粘贴合法 JSON');
    }
  };

  const copyText = async (text: string, successMessage: string) => {
    if (!selectedActivity) {
      setMessage('当前没有本期活动，请先到“新增活动”保存当前进行中的活动');
      return;
    }

    await navigator.clipboard.writeText(text);
    setMessage(successMessage);
  };

  return (
    <WorkArea>
      <div className="max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">本期消耗情况</h1>
          <p className="mt-2 text-sm text-gray-500">
            自动展示当前进行中的本期活动，生成查询参数给本地脚本查真实运单和库存；结果回填后，再作为下期采购预扣依据。
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        )}

        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">本期活动</h2>
          {isLoading ? (
            <p className="text-sm text-gray-500">正在读取已保存活动...</p>
          ) : activities.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              还没有已保存活动。请先到“新增活动”保存本期活动，再回到这里生成本期消耗查询参数。
            </div>
          ) : !selectedActivityId ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              当前没有正在进行中的本期活动。请确认已在“新增活动”保存当前日期范围覆盖今天的活动。
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              {isDetailLoading ? (
                <p className="text-gray-500">正在读取活动详情...</p>
              ) : (
                <>
                  <div className="grid gap-2 lg:grid-cols-2">
                    <p>
                      <span className="text-gray-500">活动主题：</span>
                      {selectedActivity?.theme || '-'}
                    </p>
                    <p>
                      <span className="text-gray-500">活动时间：</span>
                      {selectedActivity?.startDate || '-'} 至 {selectedActivity?.endDate || '-'}
                    </p>
                    <p>
                      <span className="text-gray-500">一级 keyfrom：</span>
                      {baseConfig.keyfromP1Values.length > 0
                        ? baseConfig.keyfromP1Values.join('、')
                        : '未配置'}
                    </p>
                    <p>
                      <span className="text-gray-500">keyfrom 关键词：</span>
                      {baseConfig.keyfromKeywords.length > 0
                        ? baseConfig.keyfromKeywords.join('、')
                        : '未配置'}
                    </p>
                  </div>
                  <p className="mt-3 text-gray-500">
                    订单筛选逻辑：一级 keyfrom 命中任一值 AND keyfrom 包含任一关键词。
                  </p>
                </>
              )}
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="mb-4 flex flex-wrap gap-3">
            <button
              onClick={() =>
                copyText(
                  JSON.stringify(dataPack, null, 2),
                  '本期消耗数据包已复制，可以粘贴给 Cursor',
                )
              }
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              生成本期消耗查询参数（复制给 Cursor）
            </button>
            <button
              onClick={() =>
                copyText(
                  JSON.stringify(summary, null, 2),
                  '本期消耗摘要已复制，可粘贴到新增活动的下期采购测算里',
                )
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              复制本期消耗摘要（查数后回填）
            </button>
          </div>

          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <label className="block text-sm font-medium mb-2">
              Cursor 返回结果（JSON）
            </label>
            <textarea
              className="h-32 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={consumptionResultText}
              onChange={(event) => setConsumptionResultText(event.target.value)}
              placeholder="把 Cursor 查到的本期消耗结果 JSON 粘贴到这里，然后点击应用回填结果"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={applyConsumptionResult}
                className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800"
              >
                应用回填结果
              </button>
              <p className="text-xs text-gray-500">
                这里先做半自动闭环；后面接真实接口后，这一步可以替换成一键自动刷新。
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-500">活动进度</p>
              <p className="mt-1 text-2xl font-bold">
                {formatMetric(consumptionResult?.progressRate, '%')}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {consumptionResult ? '已按回填结果更新' : '由 Cursor 查真实数据后更新'}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-500">截止当前订单</p>
              <p className="mt-1 text-2xl font-bold">
                {formatMetric(consumptionResult?.completedOrders)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-500">预估全期订单</p>
              <p className="mt-1 text-2xl font-bold">
                {formatMetric(consumptionResult?.projectedTotalOrders)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-500">剩余预计订单</p>
              <p className="mt-1 text-2xl font-bold">
                {formatMetric(consumptionResult?.remainingEstimatedOrders)}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">SKU 消耗与库存风险</h2>
          <div className="mb-6 grid gap-4 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-500">截止当前 SKU 消耗</p>
              <p className="mt-1 text-2xl font-bold">
                {formatMetric(consumptionResult?.consumedSkuQuantity, ' 件')}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-500">已定稿 SKU 数量</p>
              <p className="mt-1 text-2xl font-bold">
                {totalFinalSkuQuantity.toLocaleString()} 件
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-500">剩余预计 SKU 消耗</p>
              <p className="mt-1 text-2xl font-bold">
                {formatMetric(consumptionResult?.remainingEstimatedSkuQuantity, ' 件')}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-500">库存风险</p>
              <p className="mt-1 text-2xl font-bold">
                {consumptionResult?.inventoryRiskSummary || '待回填'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-max w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left whitespace-nowrap">SKU 编码</th>
                  <th className="px-4 py-2 text-left whitespace-nowrap">供应链商品名称</th>
                  <th className="px-4 py-2 text-right whitespace-nowrap">截止当前消耗</th>
                  <th className="px-4 py-2 text-right whitespace-nowrap">日均消耗</th>
                  <th className="px-4 py-2 text-right whitespace-nowrap">预计全期消耗</th>
                  <th className="px-4 py-2 text-right whitespace-nowrap">剩余预计消耗</th>
                  <th className="px-4 py-2 text-right whitespace-nowrap">当前库存</th>
                  <th className="px-4 py-2 text-right whitespace-nowrap">预计活动结束后库存</th>
                  <th className="px-4 py-2 text-left whitespace-nowrap">状态</th>
                </tr>
              </thead>
              <tbody>
                {skuTableRows.map((item) => (
                  <tr key={item.rowKey} className="border-b border-gray-100">
                    <td className="px-4 py-3">{item.goodsCode || '-'}</td>
                    <td className="px-4 py-3">{item.goodsName}</td>
                    <td className="px-4 py-3 text-right">
                      {formatMetric(item.consumedQuantity)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatDailyMetric(item.dailyConsumedQuantity)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMetric(item.projectedTotalQuantity)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMetric(item.remainingEstimatedQuantity)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMetric(item.availableQuantity)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMetric(item.endingAvailableQuantity)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${getStatusClassName(item.status)}`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {selectedActivity && skuTableRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      当前活动还没有定稿 SKU，保存最终 SKU 后这里会带出用于查数。
                    </td>
                  </tr>
                )}
                {!selectedActivity && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      请先选择一个已保存活动。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </WorkArea>
  );
}
