'use client';

import { useEffect, useMemo, useState } from 'react';
import WorkArea from '@/components/layout/WorkArea';

type SkuItem = {
  packageId?: number | null;
  packageName: string;
  productType: '新品' | '老品';
  goodsCode: string;
  goodsName: string;
  displayName: string;
  estimatedQuantity: number;
  actualQuantity: number;
  unitCost: number;
  isOutOfStock: boolean;
  remark?: string;
};

type ReviewActivity = {
  id: string;
  activityMonth: string;
  theme: string;
  startDate: string;
  endDate: string;
  status: '待复盘' | '已复盘';
  estimatedOrders: number;
  actualOrders: number;
  estimatedSkuQuantity: number;
  actualSkuQuantity: number;
  totalCost: number;
  generatedAt: string;
  newProductRatio: number;
  oldProductRatio: number;
  skuItems: SkuItem[];
  reviewNote: string;
  exceptionNote: string;
  nextMonthNote: string;
};

type ReviewOverviewRow = {
  id: number;
  activityMonth: string | null;
  theme: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  estimatedOrderCount: number | null;
  actualOrderCount: number | null;
  estimatedSkuQuantity: number | null;
  actualSkuQuantity: number | null;
  totalCost: number | null;
  generatedAt: string | null;
};

type ActivityDetail = {
  id: number;
  activityMonth: string | null;
  theme: string;
  startDate: string | null;
  endDate: string | null;
  packages: Array<{
    packageName: string;
    optionCount: number | null;
    chooseCount: number | null;
    applicableScope: string | null;
  }>;
  forecast: {
    nextMonthEstimatedOrders: number | null;
    forecastBasis: string | null;
  } | null;
  skus: Array<{
    packageId?: number | null;
    packageName?: string | null;
    isNewProduct?: boolean | null;
    goodsCode?: string | null;
    goodsName?: string | null;
    displayName?: string | null;
    unitCost?: number | null;
    suggestedPurchaseQuantity?: number | null;
    finalPurchaseQuantity?: number | null;
  }>;
};

type ReviewResult = {
  actualOrderCount: number;
  estimatedOrderCount?: number;
  reviewNote?: string;
  exceptionNote?: string;
  nextMonthNote?: string;
  skuItems: Array<{
    packageId?: number | null;
    packageName?: string;
    isNewProduct?: boolean;
    goodsCode: string;
    goodsName?: string;
    displayName?: string;
    estimatedQuantity?: number;
    actualQuantity: number;
    unitCost?: number;
    totalCost?: number;
    isOutOfStock?: boolean;
    remark?: string;
  }>;
};

type ReviewDetailResponse = {
  review: {
    actualOrderCount: number | null;
    estimatedOrderCount: number | null;
    actualSkuQuantity: number | null;
    estimatedSkuQuantity: number | null;
    totalCost: number | null;
    generatedAt: string | null;
    reviewNote: string | null;
    exceptionNote: string | null;
    nextMonthNote: string | null;
  };
  skuItems: Array<{
    packageId?: number | null;
    packageName?: string | null;
    isNewProduct?: boolean | null;
    goodsCode?: string | null;
    goodsName?: string | null;
    displayName?: string | null;
    estimatedQuantity?: number | null;
    actualQuantity?: number | null;
    unitCost?: number | null;
    isOutOfStock?: boolean | null;
    remark?: string | null;
  }>;
};

const emptyActivity: ReviewActivity = {
  id: '',
  activityMonth: '',
  theme: '暂无活动',
  startDate: '',
  endDate: '',
  status: '待复盘',
  estimatedOrders: 0,
  actualOrders: 0,
  estimatedSkuQuantity: 0,
  actualSkuQuantity: 0,
  totalCost: 0,
  generatedAt: '',
  newProductRatio: 0,
  oldProductRatio: 0,
  skuItems: [],
  reviewNote: '',
  exceptionNote: '',
  nextMonthNote: '',
};

function formatPercent(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function formatMoney(value: number) {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

function formatMetric(value: number, suffix = '') {
  return value ? `${value.toLocaleString()}${suffix}` : '-';
}

function getDeviationRate(estimated: number, actual: number) {
  if (!estimated) {
    return 0;
  }

  return ((actual - estimated) / estimated) * 100;
}

function getBarWidth(value: number, max: number) {
  if (!max) {
    return '0%';
  }

  return `${Math.max(8, (value / max) * 100)}%`;
}

function normalizeReviewSku(item: ReviewResult['skuItems'][number] | ReviewDetailResponse['skuItems'][number]): SkuItem {
  const estimatedQuantity = Number(item.estimatedQuantity || 0);
  const actualQuantity = Number(item.actualQuantity || 0);
  const unitCost = Number(item.unitCost || 0);

  return {
    packageId: item.packageId,
    packageName: item.packageName || '-',
    productType: item.isNewProduct ? '新品' : '老品',
    goodsCode: item.goodsCode || '',
    goodsName: item.goodsName || item.displayName || '',
    displayName: item.displayName || item.goodsName || '',
    estimatedQuantity,
    actualQuantity,
    unitCost,
    isOutOfStock: Boolean(item.isOutOfStock),
    remark: item.remark || '',
  };
}

export default function RetrospectPage() {
  const [activities, setActivities] = useState<ReviewActivity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [reviewResultText, setReviewResultText] = useState('');
  const [loadedReviewDetailIds, setLoadedReviewDetailIds] = useState<string[]>([]);

  useEffect(() => {
    let ignore = false;

    const loadReviews = async () => {
      try {
        const response = await fetch('/api/procurement/reviews');
        if (!response.ok) {
          throw new Error('复盘列表接口失败');
        }

        const rows = (await response.json()) as ReviewOverviewRow[];
        const nextActivities = rows.map((row) => ({
          id: String(row.id),
          activityMonth: row.activityMonth || row.startDate?.slice(0, 7) || '',
          theme: row.theme,
          startDate: row.startDate || '',
          endDate: row.endDate || '',
          status: row.generatedAt || row.status === '已复盘' ? '已复盘' : '待复盘',
          estimatedOrders: row.estimatedOrderCount || 0,
          actualOrders: row.actualOrderCount || 0,
          estimatedSkuQuantity: row.estimatedSkuQuantity || 0,
          actualSkuQuantity: row.actualSkuQuantity || 0,
          totalCost: row.totalCost || 0,
          generatedAt: row.generatedAt || '',
          newProductRatio: 0,
          oldProductRatio: 0,
          skuItems: [],
          reviewNote: row.generatedAt || row.status === '已复盘' ? '复盘结果已生成。' : '',
          exceptionNote: '',
          nextMonthNote: '',
        })) satisfies ReviewActivity[];

        if (!ignore) {
          setActivities(nextActivities);
          setSelectedActivityId(nextActivities[0]?.id || '');
        }
      } catch {
        if (!ignore) {
          setMessage('活动复盘列表读取失败，请刷新后重试');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    void loadReviews();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedActivityId) {
      return;
    }

    const currentActivity = activities.find((activity) => activity.id === selectedActivityId);
    if (
      !currentActivity ||
      currentActivity.status !== '已复盘' ||
      currentActivity.skuItems.length > 0 ||
      loadedReviewDetailIds.includes(selectedActivityId)
    ) {
      return;
    }

    let ignore = false;

    const loadReviewDetail = async () => {
      try {
        const response = await fetch(`/api/procurement/activities/${selectedActivityId}/review`);
        if (!response.ok) {
          throw new Error('复盘详情接口失败');
        }

        const detail = (await response.json()) as ReviewDetailResponse | null;
        if (ignore) {
          return;
        }

        if (!detail) {
          setLoadedReviewDetailIds((currentIds) => [...currentIds, selectedActivityId]);
          return;
        }

        const skuItems = detail.skuItems.map(normalizeReviewSku);
        const actualSkuQuantity =
          Number(detail.review.actualSkuQuantity || 0) ||
          skuItems.reduce((sum, item) => sum + item.actualQuantity, 0);
        const totalCost =
          Number(detail.review.totalCost || 0) ||
          skuItems.reduce((sum, item) => sum + item.actualQuantity * item.unitCost, 0);
        const newProductQuantity = skuItems
          .filter((item) => item.productType === '新品')
          .reduce((sum, item) => sum + item.actualQuantity, 0);
        const newProductRatio = actualSkuQuantity
          ? Math.round((newProductQuantity / actualSkuQuantity) * 100)
          : 0;

        setActivities((currentActivities) =>
          currentActivities.map((activity) =>
            activity.id === selectedActivityId
              ? {
                  ...activity,
                  status: '已复盘',
                  actualOrders: Number(detail.review.actualOrderCount || 0),
                  estimatedOrders: Number(
                    detail.review.estimatedOrderCount || activity.estimatedOrders,
                  ),
                  actualSkuQuantity,
                  estimatedSkuQuantity: Number(
                    detail.review.estimatedSkuQuantity || activity.estimatedSkuQuantity,
                  ),
                  totalCost,
                  generatedAt: String(detail.review.generatedAt || activity.generatedAt || ''),
                  newProductRatio,
                  oldProductRatio: 100 - newProductRatio,
                  skuItems,
                  reviewNote: detail.review.reviewNote || '',
                  exceptionNote: detail.review.exceptionNote || '',
                  nextMonthNote: detail.review.nextMonthNote || '',
                }
              : activity,
          ),
        );
        setLoadedReviewDetailIds((currentIds) => [...currentIds, selectedActivityId]);
      } catch {
        if (!ignore) {
          setMessage('复盘详情读取失败，请刷新后重试');
        }
      }
    };

    void loadReviewDetail();

    return () => {
      ignore = true;
    };
  }, [activities, loadedReviewDetailIds, selectedActivityId]);

  const selectedActivity =
    activities.find((activity) => activity.id === selectedActivityId) ||
    activities[0] ||
    emptyActivity;

  const topSkuItems = useMemo(
    () =>
      [...selectedActivity.skuItems]
        .sort((a, b) => b.actualQuantity - a.actualQuantity)
        .slice(0, 10),
    [selectedActivity],
  );

  const selectedDeviationRate =
    selectedActivity.status === '已复盘'
      ? getDeviationRate(selectedActivity.estimatedOrders, selectedActivity.actualOrders)
      : 0;
  const selectedOrderDeviation =
    selectedActivity.status === '已复盘'
      ? selectedActivity.actualOrders - selectedActivity.estimatedOrders
      : 0;
  const selectedAvgCost =
    selectedActivity.status === '已复盘' && selectedActivity.actualOrders
      ? selectedActivity.totalCost / selectedActivity.actualOrders
      : 0;

  const buildReviewPack = async (activity: ReviewActivity) => {
    const response = await fetch(`/api/procurement/activities/${activity.id}`);
    if (!response.ok) {
      throw new Error('活动详情读取失败');
    }

    const detail = (await response.json()) as ActivityDetail;
    return {
      task: '活动复盘真实查数',
      activity: {
        id: activity.id,
        theme: activity.theme,
        activityMonth: activity.activityMonth,
        startDate: activity.startDate,
        endDate: activity.endDate,
      },
      forecast: {
        estimatedOrderCount: activity.estimatedOrders,
        forecastBasis: detail.forecast?.forecastBasis || '',
      },
      costSource: {
        oldProductSheet: {
          url: 'https://shimo.zhenguanyu.com/sheets/qeOJrZpNDPj9ulMw/MODOC',
          range: '工作表1!A1:D1000',
          matchRule: '优先按商品编码精确匹配，读取“手工价格”作为 unitCost',
        },
        candidatePoolSheet: {
          url: 'https://shimo.zhenguanyu.com/sheets/YdypXjyRpcrYWrjq/CmVe2',
          range: '候补池!A1:I452',
          matchRule: '新品候补池优先按产品编码精确匹配，读取成本范围作为参考成本',
        },
      },
      savedFinalSkus: detail.skus,
      requiredOutput: [
        'actualOrderCount',
        'skuItems.actualQuantity',
        'skuItems.unitCost',
        'reviewNote',
        'exceptionNote',
        'nextMonthNote',
      ],
      expectedJsonFormat: {
        actualOrderCount: 3800,
        estimatedOrderCount: activity.estimatedOrders,
        reviewNote: '真实复盘结论',
        exceptionNote: '异常说明',
        nextMonthNote: '下期注意事项',
        skuItems: [
          {
            packageId: null,
            packageName: '礼包名称',
            isNewProduct: false,
            goodsCode: 'SKU 编码',
            goodsName: '供应链商品名称',
            displayName: '前台展示名称',
            estimatedQuantity: 1000,
            actualQuantity: 900,
            unitCost: 20,
            totalCost: 18000,
            isOutOfStock: false,
            remark: '真实消耗备注',
          },
        ],
      },
    };
  };

  const copyReviewPack = async (activity: ReviewActivity) => {
    try {
      const pack = await buildReviewPack(activity);
      await navigator.clipboard.writeText(JSON.stringify(pack, null, 2));
      setSelectedActivityId(activity.id);
      setReviewResultText('');
      setMessage('复盘查数参数已复制，请用真实订单、运单和库存结果回填；保存后会覆盖旧复盘');
    } catch {
      setMessage('复盘查数参数复制失败，请刷新后重试');
    }
  };

  const applyReviewResult = async () => {
    if (!selectedActivity.id) {
      setMessage('请先选择一个活动');
      return;
    }

    try {
      const parsed = JSON.parse(reviewResultText) as ReviewResult;
      if (typeof parsed.actualOrderCount !== 'number' || !Array.isArray(parsed.skuItems)) {
        setMessage('复盘回填失败：JSON 里需要包含 actualOrderCount 和 skuItems');
        return;
      }

      const response = await fetch(`/api/procurement/activities/${selectedActivity.id}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...parsed,
          estimatedOrderCount: parsed.estimatedOrderCount || selectedActivity.estimatedOrders,
        }),
      });

      if (!response.ok) {
        throw new Error('复盘保存失败');
      }

      const skuItems = parsed.skuItems.map(normalizeReviewSku);
      const actualSkuQuantity = skuItems.reduce((sum, item) => sum + item.actualQuantity, 0);
      const totalCost = skuItems.reduce(
        (sum, item) => sum + item.actualQuantity * item.unitCost,
        0,
      );
      const newProductQuantity = skuItems
        .filter((item) => item.productType === '新品')
        .reduce((sum, item) => sum + item.actualQuantity, 0);
      const newProductRatio = actualSkuQuantity
        ? Math.round((newProductQuantity / actualSkuQuantity) * 100)
        : 0;

      setActivities((currentActivities) =>
        currentActivities.map((activity) =>
          activity.id === selectedActivity.id
            ? {
                ...activity,
                status: '已复盘',
                actualOrders: parsed.actualOrderCount,
                estimatedOrders: parsed.estimatedOrderCount || activity.estimatedOrders,
                actualSkuQuantity,
                estimatedSkuQuantity: skuItems.reduce(
                  (sum, item) => sum + item.estimatedQuantity,
                  0,
                ),
                totalCost,
                generatedAt: new Date().toLocaleString('zh-CN'),
                newProductRatio,
                oldProductRatio: 100 - newProductRatio,
                skuItems,
                reviewNote: parsed.reviewNote || '',
                exceptionNote: parsed.exceptionNote || '',
                nextMonthNote: parsed.nextMonthNote || '',
              }
            : activity,
        ),
      );
      setMessage('真实复盘结果已保存');
    } catch {
      setMessage('复盘回填失败：请粘贴合法 JSON');
    }
  };

  return (
    <WorkArea>
      <div className="max-w-7xl">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">活动复盘</h1>
              <p className="mt-2 text-sm text-gray-500">
                按主题活动沉淀复盘数据，一行代表一场已结束活动，不按自然月自动生成。
              </p>
            </div>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        )}

        {isLoading && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
            正在读取已保存活动...
          </div>
        )}

        {!isLoading && activities.length === 0 && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            还没有已保存活动。请先到“新增活动”保存活动，再回到这里复盘。
          </div>
        )}

        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">活动表现总览</h2>
              <p className="mt-1 text-sm text-gray-500">
                活动列表来自工作台保存数据；订单实际、SKU 消耗、新品/老品占比和成本表现待复盘取数后生成。
              </p>
            </div>
            <span className="rounded-full bg-green-50 px-3 py-1 text-sm text-green-700">
              工作台数据
            </span>
          </div>

          <div className="space-y-3">
            {activities.map((activity) => {
              const isReviewed = activity.status === '已复盘';
              const deviationRate = isReviewed
                ? getDeviationRate(activity.estimatedOrders, activity.actualOrders)
                : 0;
              const orderDeviation = activity.actualOrders - activity.estimatedOrders;

              return (
                <button
                  key={activity.id}
                  onClick={() => setSelectedActivityId(activity.id)}
                  className={`w-full rounded-lg border p-4 text-left transition ${
                    selectedActivityId === activity.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr_0.8fr] lg:items-center">
                    <div className="min-w-0">
                      <p className="font-semibold">{activity.theme}</p>
                      <p className="mt-1 text-sm text-gray-500">
                        {activity.startDate} 至 {activity.endDate}
                      </p>
                    </div>

                    <div className="rounded-md bg-white/70 p-3">
                      <p className="text-xs text-gray-500">订单</p>
                      <p className="mt-1 text-sm font-semibold">
                        预估 {formatMetric(activity.estimatedOrders)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        实际 {isReviewed ? formatMetric(activity.actualOrders) : '待复盘'}
                      </p>
                      {isReviewed && (
                        <p
                          className={`mt-1 text-xs ${
                            orderDeviation >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {orderDeviation >= 0 ? '+' : ''}
                          {orderDeviation.toLocaleString()}（{formatPercent(deviationRate)}）
                        </p>
                      )}
                    </div>

                    <div className="rounded-md bg-white/70 p-3">
                      <p className="text-xs text-gray-500">SKU 实际消耗</p>
                      <p className="mt-1 text-sm font-semibold">
                        {isReviewed ? formatMetric(activity.actualSkuQuantity, ' 件') : '-'}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        预估 {formatMetric(activity.estimatedSkuQuantity, ' 件')}
                      </p>
                    </div>

                    <div className="rounded-md bg-white/70 p-3">
                      <p className="text-xs text-gray-500">新品 / 老品</p>
                      <p className="mt-1 text-sm font-semibold">
                        {isReviewed
                          ? `新品 ${activity.newProductRatio}% / 老品 ${activity.oldProductRatio}%`
                          : '-'}
                      </p>
                    </div>

                    <div className="rounded-md bg-white/70 p-3">
                      <p className="text-xs text-gray-500">成本</p>
                      <p className="mt-1 text-sm font-semibold">
                        {isReviewed ? formatMoney(activity.totalCost) : '-'}
                      </p>
                      <p className="text-xs text-gray-500">
                        单均{' '}
                        {isReviewed ? formatMoney(activity.totalCost / activity.actualOrders) : '-'}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">活动总览表</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">活动月份</th>
                  <th className="px-4 py-2 text-left">活动主题</th>
                  <th className="px-4 py-2 text-left">活动时间</th>
                  <th className="px-4 py-2 text-left">状态</th>
                  <th className="px-4 py-2 text-right">预估订单量</th>
                  <th className="px-4 py-2 text-right">实际订单量</th>
                  <th className="px-4 py-2 text-right">订单偏差</th>
                  <th className="px-4 py-2 text-right">预估赠品总量</th>
                  <th className="px-4 py-2 text-right">实际赠品消耗</th>
                  <th className="px-4 py-2 text-right">总成本</th>
                  <th className="px-4 py-2 text-right">单均成本</th>
                  <th className="px-4 py-2 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((activity) => {
                  const isReviewed = activity.status === '已复盘';

                  return (
                    <tr key={activity.id} className="border-b border-gray-100">
                      <td className="px-4 py-3">{activity.activityMonth}</td>
                      <td className="px-4 py-3">{activity.theme}</td>
                      <td className="px-4 py-3">
                        {activity.startDate} 至 {activity.endDate}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${
                            isReviewed
                              ? 'bg-green-50 text-green-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {activity.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatMetric(activity.estimatedOrders)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isReviewed ? formatMetric(activity.actualOrders) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isReviewed
                          ? formatPercent(
                              getDeviationRate(activity.estimatedOrders, activity.actualOrders),
                            )
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatMetric(activity.estimatedSkuQuantity)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isReviewed ? formatMetric(activity.actualSkuQuantity) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isReviewed ? formatMoney(activity.totalCost) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isReviewed ? formatMoney(activity.totalCost / activity.actualOrders) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {isReviewed ? (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => setSelectedActivityId(activity.id)}
                              className="text-left text-blue-600 hover:text-blue-800"
                            >
                              查看
                            </button>
                            <button
                              onClick={() => void copyReviewPack(activity)}
                              className="text-left text-green-600 hover:text-green-800"
                            >
                              重新复盘
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => void copyReviewPack(activity)}
                            className="text-green-600 hover:text-green-800"
                          >
                            复制复盘参数
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">选择主题活动</h2>
          <div className="flex flex-wrap gap-3">
            {activities.map((activity) => (
              <button
                key={activity.id}
                onClick={() => setSelectedActivityId(activity.id)}
                className={`rounded-md px-5 py-2 text-sm transition ${
                  selectedActivityId === activity.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {activity.theme}
              </button>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">当前活动详情</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedActivity.theme}，{selectedActivity.startDate} 至{' '}
                  {selectedActivity.endDate}
                  {selectedActivity.status === '已复盘'
                    ? `，生成时间 ${selectedActivity.generatedAt}`
                    : '，当前待复盘'}
                </p>
              </div>
              {selectedActivity.status === '已复盘' && (
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-green-50 px-3 py-1 text-sm text-green-700">
                    真实取数
                  </span>
                  <button
                    onClick={() => void copyReviewPack(selectedActivity)}
                    className="rounded-md bg-green-600 px-5 py-2 text-sm text-white hover:bg-green-700"
                  >
                    重新复盘
                  </button>
                </div>
              )}
              {selectedActivity.status === '待复盘' && selectedActivity.id && (
                <button
                  onClick={() => void copyReviewPack(selectedActivity)}
                  className="rounded-md bg-green-600 px-5 py-2 text-sm text-white hover:bg-green-700"
                >
                  复制复盘参数
                </button>
              )}
            </div>
          </div>

          {selectedActivity.id && (
            <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-blue-900">真实复盘回填</h3>
                  <p className="mt-1 text-sm text-blue-700">
                    先复制复盘参数完成真实查数，再把返回 JSON 粘贴到这里保存；重新保存会覆盖旧复盘。
                  </p>
                </div>
                <button
                  onClick={() => void applyReviewResult()}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                >
                  保存复盘结果
                </button>
              </div>
              <textarea
                className="h-28 w-full rounded-md border border-blue-200 px-3 py-2 text-sm"
                value={reviewResultText}
                onChange={(event) => setReviewResultText(event.target.value)}
                placeholder="粘贴真实复盘 JSON：actualOrderCount、skuItems、reviewNote、exceptionNote、nextMonthNote"
              />
            </div>
          )}

          <div className="mb-6 grid grid-cols-4 gap-4">
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-500">预估订单量</p>
              <p className="mt-1 text-2xl font-bold">
                {formatMetric(selectedActivity.estimatedOrders)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-500">实际订单量</p>
              <p className="mt-1 text-2xl font-bold">
                {selectedActivity.status === '已复盘'
                  ? formatMetric(selectedActivity.actualOrders)
                  : '-'}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-500">订单偏差</p>
              <p className="mt-1 text-2xl font-bold">
                {selectedActivity.status === '已复盘' ? (
                  <>
                    {selectedOrderDeviation > 0 ? '+' : ''}
                    {selectedOrderDeviation.toLocaleString()}
                  </>
                ) : (
                  '-'
                )}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-500">偏差率</p>
              <p className="mt-1 text-2xl font-bold">
                {selectedActivity.status === '已复盘'
                  ? formatPercent(selectedDeviationRate)
                  : '-'}
              </p>
            </div>
          </div>

          <h3 className="mb-3 text-lg font-semibold">SKU 消耗复盘</h3>
          <div className="mb-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">礼包</th>
                  <th className="px-4 py-2 text-left">新品/老品</th>
                  <th className="px-4 py-2 text-left">SKU 编码</th>
                  <th className="px-4 py-2 text-left">供应链商品名称</th>
                  <th className="px-4 py-2 text-left">前台展示名</th>
                  <th className="px-4 py-2 text-right">预估需求</th>
                  <th className="px-4 py-2 text-right">实际消耗</th>
                  <th className="px-4 py-2 text-right">偏差</th>
                  <th className="px-4 py-2 text-right">单价</th>
                  <th className="px-4 py-2 text-right">总成本</th>
                  <th className="px-4 py-2 text-left">是否缺货</th>
                </tr>
              </thead>
              <tbody>
                {selectedActivity.skuItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                      当前活动尚未生成真实复盘。请先完成本期消耗查数，再回填复盘结果。
                    </td>
                  </tr>
                ) : (
                  selectedActivity.skuItems.map((item) => {
                    const deviation = item.actualQuantity - item.estimatedQuantity;
                    return (
                      <tr key={item.goodsCode} className="border-b border-gray-100">
                        <td className="px-4 py-3">{item.packageName}</td>
                        <td className="px-4 py-3">{item.productType}</td>
                        <td className="px-4 py-3">{item.goodsCode}</td>
                        <td className="px-4 py-3">{item.goodsName}</td>
                        <td className="px-4 py-3">{item.displayName}</td>
                        <td className="px-4 py-3 text-right">
                          {item.estimatedQuantity.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.actualQuantity.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {deviation > 0 ? '+' : ''}
                          {deviation.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">{formatMoney(item.unitCost)}</td>
                        <td className="px-4 py-3 text-right">
                          {formatMoney(item.unitCost * item.actualQuantity)}
                        </td>
                        <td className="px-4 py-3">{item.isOutOfStock ? '是' : '否'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="mb-4 text-lg font-semibold">SKU 消耗排行</h3>
              <div className="space-y-3">
                {topSkuItems.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">待真实复盘查数后展示</p>
                ) : (
                  topSkuItems.map((item, index) => (
                    <div key={item.goodsCode} className="flex items-center gap-3">
                      <span className="w-6 text-sm text-gray-500">{index + 1}</span>
                      <div className="flex-1">
                        <div className="mb-1 flex justify-between text-sm">
                          <span>{item.displayName}</span>
                          <span>{item.actualQuantity.toLocaleString()} 件</span>
                        </div>
                        <div className="h-2 rounded bg-gray-100">
                          <div
                            className="h-2 rounded bg-blue-500"
                            style={{
                              width: getBarWidth(
                                item.actualQuantity,
                                topSkuItems[0]?.actualQuantity || 0,
                              ),
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="mb-4 text-lg font-semibold">新品 / 老品消耗占比</h3>
              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>新品</span>
                    <span>
                      {selectedActivity.status === '已复盘'
                        ? `${selectedActivity.newProductRatio}%`
                        : '-'}
                    </span>
                  </div>
                  <div className="h-3 rounded bg-gray-100">
                    <div
                      className="h-3 rounded bg-orange-400"
                      style={{ width: `${selectedActivity.newProductRatio}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>老品</span>
                    <span>
                      {selectedActivity.status === '已复盘'
                        ? `${selectedActivity.oldProductRatio}%`
                        : '-'}
                    </span>
                  </div>
                  <div className="h-3 rounded bg-gray-100">
                    <div
                      className="h-3 rounded bg-emerald-500"
                      style={{ width: `${selectedActivity.oldProductRatio}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
                  {selectedActivity.status === '已复盘'
                    ? `本期总成本 ${formatMoney(selectedActivity.totalCost)}，单均成本 ${formatMoney(
                        selectedAvgCost,
                      )}。`
                    : '真实复盘查数后展示总成本和单均成本。'}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">复盘备注</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="mb-2 font-medium">复盘备注</p>
              <p className="text-sm text-gray-600">
                {selectedActivity.reviewNote || '待真实复盘查数后补充。'}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="mb-2 font-medium">异常说明</p>
              <p className="text-sm text-gray-600">
                {selectedActivity.exceptionNote || '待真实复盘查数后补充。'}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="mb-2 font-medium">下月注意事项</p>
              <p className="text-sm text-gray-600">
                {selectedActivity.nextMonthNote || '待真实复盘查数后补充。'}
              </p>
            </div>
          </div>
        </section>
      </div>
    </WorkArea>
  );
}
