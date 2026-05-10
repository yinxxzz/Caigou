'use client';

import { useEffect, useMemo, useState } from 'react';
import WorkArea from '@/components/layout/WorkArea';

type PackageDraft = {
  packageName: string;
  optionCount: number;
  chooseCount: number;
  costLimit: number | '';
};

type SkuDraft = {
  packageId?: number;
  packageName: string;
  isNewProduct: boolean;
  goodsCode: string;
  goodsName: string;
  displayName: string;
  category: string;
  unitCost: number;
  suggestedPurchaseQuantity: number;
  finalPurchaseQuantity: number;
  currentWithPendingQuantity?: number;
  activityStartEstimatedQuantity?: number;
  juneEndingRemainingQuantity?: number;
  realtimeInventoryQuantity?: number;
  status: '采购' | '借调' | '备货' | '无需处理';
  remark: string;
};

type ConsumptionSkuItem = {
  goodsCode?: string;
  goodsName?: string;
  displayName?: string;
  remainingEstimatedQuantity?: number;
  availableQuantity?: number;
  endingAvailableQuantity?: number;
};

type NextOrderForecastResult = {
  nextEstimatedOrders: number;
  forecastBasis: string;
};

type NextProcurementResult = {
  procurementAdviceText: string;
  riskSummary: string;
  skus?: SkuDraft[];
};

type PendingInboundItem = {
  goodsCode?: string;
  goodsName: string;
  displayName?: string;
  unitCost?: number;
  pendingQuantity: number;
  expectedArrivalDate?: string;
  source?: string;
  remark?: string;
};

type BaseConfigResponse = {
  keyfromKeywords: string[];
  keyfromP1Values: string[];
  costLimit: number;
};

type SavedActivityListItem = {
  id: number;
  theme: string;
  startDate: string | null;
  endDate: string | null;
};

type SavedActivityDetail = {
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
  purchaseAdviceText: string | null;
  riskSummary: string | null;
  currentConsumptionSummary: string | null;
  pendingInboundItemsText: string | null;
  skus: SkuDraft[];
};

const parseCostLimit = (value: string | null, fallback: number) => {
  const match = value?.match(/\d+/);
  return match ? Number(match[0]) : fallback;
};

const normalizeStatus = (status?: string): SkuDraft['status'] => {
  if (status === '采购' || status === '借调' || status === '备货' || status === '无需处理') {
    return status;
  }

  if (status === '可采购') {
    return '采购';
  }

  return '无需处理';
};

const normalizeSkuDraft = (sku: Partial<SkuDraft>): SkuDraft => ({
  packageId: sku.packageId,
  packageName: sku.packageName || '',
  isNewProduct: Boolean(sku.isNewProduct),
  goodsCode: sku.goodsCode || '',
  goodsName: sku.goodsName || '',
  displayName: sku.displayName || '',
  category: sku.category || '',
  unitCost: Number(sku.unitCost || 0),
  suggestedPurchaseQuantity: Number(sku.suggestedPurchaseQuantity || 0),
  finalPurchaseQuantity: Number(sku.finalPurchaseQuantity || 0),
  currentWithPendingQuantity: Number(sku.currentWithPendingQuantity || 0),
  activityStartEstimatedQuantity: Number(sku.activityStartEstimatedQuantity || 0),
  juneEndingRemainingQuantity: Number(sku.juneEndingRemainingQuantity || 0),
  realtimeInventoryQuantity: Number(sku.realtimeInventoryQuantity || 0),
  status: normalizeStatus(sku.status),
  remark: sku.remark || '',
});

const parsePendingInboundItems = (value: string): PendingInboundItem[] => {
  if (!value.trim()) {
    return [];
  }

  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('pending inbound items must be an array');
  }

  return parsed.map((item) => {
    const record = item as Partial<PendingInboundItem>;
    return {
      goodsCode: record.goodsCode?.trim() || '',
      goodsName: record.goodsName || '',
      displayName: record.displayName || '',
      unitCost: Number(record.unitCost || 0),
      pendingQuantity: Number(record.pendingQuantity || 0),
      expectedArrivalDate: record.expectedArrivalDate || '',
      source: record.source || '已采购未入库',
      remark: record.remark || '',
    };
  });
};

const normalizeText = (value?: string) => (value || '').trim().toLowerCase();

const normalizeGoodsCode = (value?: string) => (value || '').trim().toUpperCase();

const extractJsonText = (value: string) => {
  const text = value.trim();
  if (!text) {
    return '';
  }

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }

  const objectStart = text.indexOf('{');
  const arrayStart = text.indexOf('[');
  const startCandidates = [objectStart, arrayStart].filter((index) => index >= 0);
  const start = startCandidates.length > 0 ? Math.min(...startCandidates) : -1;
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));

  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }

  return text;
};

const parseConsumptionSummary = (value: string): ConsumptionSkuItem[] => {
  const jsonText = extractJsonText(value);
  if (!jsonText) {
    return [];
  }

  const parsed = JSON.parse(jsonText) as unknown;
  const items = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { skuItems?: unknown[] }).skuItems)
      ? (parsed as { skuItems: unknown[] }).skuItems
      : [];

  return items.map((item) => {
    const record = item as Partial<ConsumptionSkuItem>;
    return {
      goodsCode: record.goodsCode || '',
      goodsName: record.goodsName || '',
      displayName: record.displayName || '',
      remainingEstimatedQuantity: Number(record.remainingEstimatedQuantity || 0),
      availableQuantity: Number(record.availableQuantity || 0),
      endingAvailableQuantity: Number(record.endingAvailableQuantity || 0),
    };
  });
};

const validateConsumptionSummaryText = (value: string) => {
  if (!value.trim()) {
    return { ok: true, message: '未填写本期消耗摘要，相关库存预扣按 0 处理' };
  }

  try {
    const items = parseConsumptionSummary(value);
    if (items.length === 0) {
      return { ok: false, message: '未识别到 skuItems 数组，请粘贴本期消耗情况模块生成的完整 JSON' };
    }

    return { ok: true, message: `已识别 ${items.length} 个本期消耗 SKU` };
  } catch {
    return { ok: false, message: '本期消耗摘要不是合法 JSON，请检查括号、逗号和引号' };
  }
};

const validatePendingInboundItemsText = (value: string) => {
  if (!value.trim()) {
    return { ok: true, message: '未填写未入库/在途商品，按空数组处理' };
  }

  try {
    const items = parsePendingInboundItems(value);
    const invalidIndex = items.findIndex((item) => !item.goodsCode && !item.goodsName);
    if (invalidIndex >= 0) {
      return { ok: false, message: `第 ${invalidIndex + 1} 条缺少 goodsCode 或 goodsName，无法匹配 SKU` };
    }

    return { ok: true, message: `已识别 ${items.length} 个未入库/在途商品` };
  } catch {
    return { ok: false, message: '未入库/在途商品不是合法 JSON 数组，请检查格式' };
  }
};

const parseQuantityText = (value?: string) => {
  if (!value) {
    return 0;
  }

  const match = value.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
};

const formatReadonlyQuantity = (value?: number) => Number(value || 0).toLocaleString();

const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const draftStorageKey = 'gift-procurement-new-activity-draft-v1';

type NewActivityDraft = {
  activityId: number | null;
  formData: {
    theme: string;
    startDate: string;
    endDate: string;
    keyfromKeywords: string;
    keyfromP1Values: string;
    costLimit: number;
  };
  packages: PackageDraft[];
  nextOrderForecast: {
    nextEstimatedOrders: number;
    forecastBasis: string;
  };
  nextProcurement: {
    currentConsumptionSummary: string;
    pendingInboundItemsText: string;
    procurementAdviceText: string;
    riskSummary: string;
  };
  skus: SkuDraft[];
  nextOrderForecastResultText: string;
  nextProcurementResultText: string;
};

export default function NewActivityPage() {
  const [activityId, setActivityId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isBaseConfigOpen, setIsBaseConfigOpen] = useState(false);
  const [savedActivities, setSavedActivities] = useState<SavedActivityListItem[]>([]);
  const [formData, setFormData] = useState({
    theme: '',
    startDate: '',
    endDate: '',
    keyfromKeywords: '',
    keyfromP1Values: '',
    costLimit: 70,
  });

  const [packages, setPackages] = useState<PackageDraft[]>([]);
  const [nextOrderForecast, setNextOrderForecast] = useState({
    nextEstimatedOrders: 0,
    forecastBasis: '',
  });
  const [nextProcurement, setNextProcurement] = useState({
    currentConsumptionSummary: '',
    pendingInboundItemsText: '',
    procurementAdviceText: '',
    riskSummary: '',
  });
  const [skus, setSkus] = useState<SkuDraft[]>([]);
  const [inventoryByGoodsCode, setInventoryByGoodsCode] = useState<Record<string, string>>({});
  const [nextOrderForecastResultText, setNextOrderForecastResultText] = useState('');
  const [nextProcurementResultText, setNextProcurementResultText] = useState('');
  const isNewActivity = activityId === null;
  const isPlanningActivity = isNewActivity || !formData.endDate || formData.endDate >= toLocalDateString(new Date());
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
  const consumptionValidation = useMemo(
    () => validateConsumptionSummaryText(nextProcurement.currentConsumptionSummary),
    [nextProcurement.currentConsumptionSummary],
  );
  const pendingInboundValidation = useMemo(
    () => validatePendingInboundItemsText(nextProcurement.pendingInboundItemsText),
    [nextProcurement.pendingInboundItemsText],
  );
  const consumptionItems = useMemo(() => {
    try {
      return parseConsumptionSummary(nextProcurement.currentConsumptionSummary);
    } catch {
      return [];
    }
  }, [nextProcurement.currentConsumptionSummary]);
  const pendingInboundItems = useMemo(() => {
    try {
      return parsePendingInboundItems(nextProcurement.pendingInboundItemsText);
    } catch {
      return [];
    }
  }, [nextProcurement.pendingInboundItemsText]);
  const consumptionByCode = useMemo(() => {
    const map = new Map<string, ConsumptionSkuItem>();
    consumptionItems.forEach((item) => {
      const code = normalizeGoodsCode(item.goodsCode);
      if (code) {
        map.set(code, item);
      }
    });
    return map;
  }, [consumptionItems]);
  const consumptionByName = useMemo(() => {
    const map = new Map<string, ConsumptionSkuItem>();
    consumptionItems.forEach((item) => {
      [item.goodsName, item.displayName].forEach((name) => {
        const key = normalizeText(name);
        if (key) {
          map.set(key, item);
        }
      });
    });
    return map;
  }, [consumptionItems]);
  const pendingInboundByCode = useMemo(() => {
    const map = new Map<string, number>();
    pendingInboundItems.forEach((item) => {
      const code = normalizeGoodsCode(item.goodsCode);
      if (code) {
        map.set(code, (map.get(code) || 0) + Number(item.pendingQuantity || 0));
      }
    });
    return map;
  }, [pendingInboundItems]);
  const pendingInboundByName = useMemo(() => {
    const map = new Map<string, number>();
    pendingInboundItems.forEach((item) => {
      [item.goodsName, item.displayName].forEach((name) => {
        const key = normalizeText(name);
        if (key) {
          map.set(key, (map.get(key) || 0) + Number(item.pendingQuantity || 0));
        }
      });
    });
    return map;
  }, [pendingInboundItems]);
  const skusWithCalculatedFields = useMemo(
    () =>
      skus.map((sku) => {
        const code = normalizeGoodsCode(sku.goodsCode);
        const consumptionSku =
          consumptionByCode.get(code) ||
          consumptionByName.get(normalizeText(sku.goodsName)) ||
          consumptionByName.get(normalizeText(sku.displayName));
        const pendingInbound =
          pendingInboundByCode.get(code) ||
          pendingInboundByName.get(normalizeText(sku.goodsName)) ||
          pendingInboundByName.get(normalizeText(sku.displayName)) ||
          0;
        const realtimeInventory =
          parseQuantityText(inventoryByGoodsCode[sku.goodsCode]) ||
          Number(sku.realtimeInventoryQuantity || 0) ||
          Number(consumptionSku?.availableQuantity || 0);
        const remainingEstimatedConsumption = Number(consumptionSku?.remainingEstimatedQuantity || 0);
        const currentWithPendingQuantity = realtimeInventory + pendingInbound;
        const activityStartEstimatedQuantity =
          realtimeInventory - remainingEstimatedConsumption + pendingInbound + Number(sku.finalPurchaseQuantity || 0);
        const juneEndingRemainingQuantity =
          activityStartEstimatedQuantity - Number(sku.suggestedPurchaseQuantity || 0);

        return {
          ...sku,
          realtimeInventoryQuantity: realtimeInventory,
          currentWithPendingQuantity,
          activityStartEstimatedQuantity,
          juneEndingRemainingQuantity,
        };
      }),
    [
      consumptionByCode,
      consumptionByName,
      inventoryByGoodsCode,
      pendingInboundByCode,
      pendingInboundByName,
      skus,
    ],
  );

  useEffect(() => {
    let ignore = false;

    const loadInitialData = async () => {
      try {
        const [baseConfigResponse, activitiesResponse] = await Promise.all([
          fetch('/api/procurement/base-config'),
          fetch('/api/procurement/activities'),
        ]);
        if (!baseConfigResponse.ok || !activitiesResponse.ok) {
          throw new Error('基础配置读取失败');
        }

        const config = (await baseConfigResponse.json()) as BaseConfigResponse;
        const activityList = (await activitiesResponse.json()) as SavedActivityListItem[];
        if (!ignore) {
          const draftText = window.localStorage.getItem(draftStorageKey);
          const draft = draftText ? (JSON.parse(draftText) as Partial<NewActivityDraft>) : null;

          if (draft?.formData) {
            setActivityId(draft.activityId ?? null);
            setFormData({
              theme: draft.formData.theme || '',
              startDate: draft.formData.startDate || '',
              endDate: draft.formData.endDate || '',
              keyfromKeywords: draft.formData.keyfromKeywords || config.keyfromKeywords.join(','),
              keyfromP1Values: draft.formData.keyfromP1Values || config.keyfromP1Values.join(','),
              costLimit: Number(draft.formData.costLimit || config.costLimit || 70),
            });
            setPackages(draft.packages || []);
            setNextOrderForecast({
              nextEstimatedOrders: Number(draft.nextOrderForecast?.nextEstimatedOrders || 0),
              forecastBasis: draft.nextOrderForecast?.forecastBasis || '',
            });
            setNextProcurement({
              currentConsumptionSummary: draft.nextProcurement?.currentConsumptionSummary || '',
              pendingInboundItemsText: draft.nextProcurement?.pendingInboundItemsText || '',
              procurementAdviceText: draft.nextProcurement?.procurementAdviceText || '',
              riskSummary: draft.nextProcurement?.riskSummary || '',
            });
            setSkus((draft.skus || []).map(normalizeSkuDraft));
            setNextOrderForecastResultText(draft.nextOrderForecastResultText || '');
            setNextProcurementResultText(draft.nextProcurementResultText || '');
            setMessage('已恢复上次未保存的本地草稿');
          } else {
            setFormData((current) => ({
              ...current,
              keyfromKeywords: config.keyfromKeywords.join(','),
              keyfromP1Values: config.keyfromP1Values.join(','),
              costLimit: config.costLimit || current.costLimit,
            }));
          }

          setSavedActivities(activityList);
          setHasLoadedDraft(true);
        }
      } catch {
        if (!ignore) {
          setMessage('基础配置或活动列表读取失败，可刷新后重试');
          setHasLoadedDraft(true);
        }
      }
    };

    void loadInitialData();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedDraft) {
      return;
    }

    const draft: NewActivityDraft = {
      activityId,
      formData,
      packages,
      nextOrderForecast,
      nextProcurement,
      skus,
      nextOrderForecastResultText,
      nextProcurementResultText,
    };

    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
  }, [
    activityId,
    formData,
    hasLoadedDraft,
    nextOrderForecast,
    nextOrderForecastResultText,
    nextProcurement,
    nextProcurementResultText,
    packages,
    skus,
  ]);

  const addPackage = () => {
    setPackages([...packages, {
      packageName: '',
      optionCount: 4,
      chooseCount: 1,
      costLimit: formData.costLimit,
    }]);
  };

  const removePackage = (index: number) => {
    setPackages(packages.filter((_, i) => i !== index));
  };

  const updatePackage = (index: number, field: keyof PackageDraft, value: string | number) => {
    const newPackages = [...packages];
    newPackages[index] = { ...newPackages[index], [field]: value };
    setPackages(newPackages);
  };

  const addSku = () => {
    setSkus([
      ...skus,
      {
        packageName: packages[0]?.packageName || '',
        isNewProduct: false,
        goodsCode: '',
        goodsName: '',
        displayName: '',
        category: '',
        unitCost: 0,
        suggestedPurchaseQuantity: 0,
        finalPurchaseQuantity: 0,
        currentWithPendingQuantity: 0,
        activityStartEstimatedQuantity: 0,
        juneEndingRemainingQuantity: 0,
        realtimeInventoryQuantity: 0,
        status: '无需处理',
        remark: '',
      },
    ]);
  };

  const updateSku = (index: number, field: keyof SkuDraft, value: string | number | boolean) => {
    const newSkus = [...skus];
    newSkus[index] = { ...newSkus[index], [field]: value };
    setSkus(newSkus);
  };

  const removeSku = (index: number) => {
    setSkus(skus.filter((_, i) => i !== index));
  };

  const splitValues = (value: string) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  const copyText = async (text: string, successMessage: string) => {
    await navigator.clipboard.writeText(text);
    setMessage(successMessage);
  };

  const copyNextProcurementPack = async () => {
    try {
      if (!consumptionValidation.ok || !pendingInboundValidation.ok) {
        setMessage('下期采购测算数据包生成失败：请先修正本期消耗摘要或未入库/在途商品 JSON');
        return;
      }

      await copyText(
        JSON.stringify(buildNextProcurementPack(), null, 2),
        '下期采购测算数据包已复制，可以粘贴给 Cursor',
      );
    } catch {
      setMessage('下期采购测算数据包生成失败：请检查未入库/在途商品是否为合法 JSON 数组');
    }
  };

  const resetToNewActivity = () => {
    window.localStorage.removeItem(draftStorageKey);
    setActivityId(null);
    setFormData((current) => ({
      ...current,
      theme: '',
      startDate: '',
      endDate: '',
    }));
    setPackages([]);
    setNextOrderForecast({
      nextEstimatedOrders: 0,
      forecastBasis: '',
    });
    setNextProcurement({
      currentConsumptionSummary: '',
      pendingInboundItemsText: '',
      procurementAdviceText: '',
      riskSummary: '',
    });
    setSkus([]);
    setInventoryByGoodsCode({});
    setNextOrderForecastResultText('');
    setNextProcurementResultText('');
    setMessage('已切换为新建活动');
  };

  const queryInventory = async (goodsCode: string) => {
    const code = goodsCode.trim();
    if (!code) {
      setMessage('请先填写 SKU 编码');
      return;
    }

    setInventoryByGoodsCode((current) => ({ ...current, [code]: '查询中...' }));
    try {
      const response = await fetch(`/api/procurement/inventory?goodsCode=${encodeURIComponent(code)}`);
      if (!response.ok) {
        throw new Error('库存接口失败');
      }

      const result = (await response.json()) as { availableQuantity: number };
      setInventoryByGoodsCode((current) => ({
        ...current,
        [code]: `${Number(result.availableQuantity || 0).toLocaleString()} 件`,
      }));
    } catch {
      setInventoryByGoodsCode((current) => ({ ...current, [code]: '查询失败' }));
      setMessage('实时库存查询失败，请稍后重试');
    }
  };

  const loadActivityForEdit = async (id: string) => {
    if (!id) {
      resetToNewActivity();
      return;
    }

    const response = await fetch(`/api/procurement/activities/${id}`);
    if (!response.ok) {
      setMessage('活动读取失败，请刷新后重试');
      return;
    }

    const detail = (await response.json()) as SavedActivityDetail;
    setActivityId(detail.id);
    setFormData((current) => ({
      ...current,
      theme: detail.theme || '',
      startDate: detail.startDate || '',
      endDate: detail.endDate || '',
    }));
    setPackages(
      detail.packages.map((pkg) => ({
        packageName: pkg.packageName || '',
        optionCount: pkg.optionCount || 4,
        chooseCount: pkg.chooseCount || 1,
        costLimit: parseCostLimit(pkg.applicableScope, formData.costLimit),
      })),
    );
    setNextOrderForecast({
      nextEstimatedOrders: Number(detail.forecast?.nextMonthEstimatedOrders || 0),
      forecastBasis: detail.forecast?.forecastBasis || '',
    });
    setNextProcurement({
      ...nextProcurement,
      currentConsumptionSummary: detail.currentConsumptionSummary || '',
      pendingInboundItemsText: detail.pendingInboundItemsText || '',
      procurementAdviceText: detail.purchaseAdviceText || '',
      riskSummary: detail.riskSummary || '',
    });
    setSkus((detail.skus || []).map(normalizeSkuDraft));
    setMessage(`已加载活动 #${detail.id}，可以继续修改后保存`);
  };

  const buildNextOrderForecastPack = () => ({
    task: '下期订单预估',
    activity: {
      id: activityId,
      theme: formData.theme,
      startDate: formData.startDate,
      endDate: formData.endDate,
    },
    baseConfig: {
      courseType: '系统课',
      includeAllOrderStatuses: true,
      includeRefunds: true,
      orderFilterLogic: {
        relation: 'AND',
        keyfromP1: {
          operator: 'IN_ANY',
          values: splitValues(formData.keyfromP1Values),
          description: '一级 keyfrom 必须命中任一值',
        },
        keyfromKeywords: {
          operator: 'CONTAINS_ANY',
          values: splitValues(formData.keyfromKeywords),
          description: 'keyfrom 同时需要包含任一关键词',
        },
      },
    },
    packages: packages.map((pkg) => ({
      packageName: pkg.packageName,
      optionCount: pkg.optionCount,
      chooseCount: pkg.chooseCount,
      costLimit: Number(pkg.costLimit || 0),
      costRule: `总和不超过 ${Number(pkg.costLimit || 0)} 元`,
    })),
    requiredOutput: ['下期预估订单量', '预测依据'],
    expectedJsonFormat: {
      nextEstimatedOrders: 4000,
      forecastBasis: '基于近 3 个月、去年同期、当前活动主题和 keyfrom 口径综合预估',
    },
  });

  const buildNextProcurementPack = () => {
    const pendingInboundItems = parsePendingInboundItems(nextProcurement.pendingInboundItemsText);

    return {
      task: '下期采购测算',
      activity: {
        id: activityId,
        theme: formData.theme,
        startDate: formData.startDate,
        endDate: formData.endDate,
      },
      baseConfig: {
        costLimit: formData.costLimit,
        supplyChannelId: 1051,
        supplyChannelName: '辅导服务-用户增长-扩科',
        orderFilterLogic: {
          relation: 'AND',
          keyfromP1: {
            operator: 'IN_ANY',
            values: splitValues(formData.keyfromP1Values),
            description: '一级 keyfrom 必须命中任一值',
          },
          keyfromKeywords: {
            operator: 'CONTAINS_ANY',
            values: splitValues(formData.keyfromKeywords),
            description: 'keyfrom 同时需要包含任一关键词',
          },
        },
      },
      currentConsumptionSummary: nextProcurement.currentConsumptionSummary,
      reusableOldProductPolicy: {
        source: '从本期消耗摘要的 skuItems 中筛选',
        includeRule: '只把当前库存或预计期末库存大于 2000 的严重滞销品作为下月可继续消化的老品池',
        maxOldProductRatio: 0.4,
        description: '每个礼包老品数量不超过 40%，剩余位置必须从候补池选新品',
      },
      candidatePoolSource: {
        url: 'https://shimo.zhenguanyu.com/sheets/YdypXjyRpcrYWrjq/CmVe2',
        sheet: '候补池',
        range: 'A1:I452',
        usage: '新品从候补池按成本范围、礼包名额和品类丰富度筛选，不把 400 多个候选品全部塞进数据包',
      },
      pendingInboundItems,
      selectionPolicy: {
        oldProductRule: '老品只从严重滞销或明确可消化的老品里选择，且每个礼包不超过 40%',
        newProductRule: '剩余名额从候补池选择新品，并按礼包成本上限给采购建议',
        pendingInboundRule: '未入库品视为下期可用量的一部分，采购建议中必须避免重复采购',
        overstockRule: '库存大于 2000 的品标记为严重滞销；不是继续采购，而是优先消化库存',
      },
      nextProcurementInput: {
        nextEstimatedOrders: nextOrderForecast.nextEstimatedOrders,
        forecastBasis: nextOrderForecast.forecastBasis,
      },
      packages: packages.map((pkg) => ({
        packageName: pkg.packageName,
        optionCount: pkg.optionCount,
        chooseCount: pkg.chooseCount,
        costLimit: Number(pkg.costLimit || 0),
        costRule: `总和不超过 ${Number(pkg.costLimit || 0)} 元`,
      })),
      calculationRule: '先识别可复用老品和未入库可用量；老品不超过比例上限，剩余名额从候补池新品中按成本范围推荐采购',
      currentFinalSkus: skus,
      requiredOutput: ['采购测算建议正文', '风险总结', '老品消化建议', '候补池新品建议', '未入库品处理', '建议 SKU 表'],
      expectedJsonFormat: {
        procurementAdviceText: '建议正文',
        riskSummary: '风险总结',
        reuseOldSkus: [
          {
            packageName: '礼包 A',
            goodsCode: '滞销老品 SKU',
            goodsName: '供应链商品名称',
            endingAvailableQuantity: 2500,
            suggestedPurchaseQuantity: 0,
            remark: '库存大于 2000，建议下期继续消化，不新增采购',
          },
        ],
        newCandidateSkus: [
          {
            packageName: '礼包 A',
            goodsCode: '候补池新品 SKU',
            goodsName: '供应链商品名称',
            displayName: '前台展示商品名',
            category: '品类',
            unitCost: 20,
            suggestedPurchaseQuantity: 1000,
            remark: '从候补池按成本范围筛选，首采保守',
          },
        ],
        pendingInboundSkus: [
          {
            goodsCode: '未入库 SKU',
            goodsName: '商品名称',
            pendingQuantity: 1000,
            handling: '计入下期可用量，不重复采购',
          },
        ],
        overstockRiskSkus: [
          {
            goodsCode: '严重滞销 SKU',
            goodsName: '商品名称',
            availableQuantity: 3000,
            endingAvailableQuantity: 2800,
            remark: '库存大于 2000',
          },
        ],
        skus: [
          {
            packageName: '礼包 A',
            isNewProduct: true,
            goodsCode: 'SKU 编码',
            goodsName: '供应链商品名称',
            displayName: '前台展示商品名',
            category: '品类',
            unitCost: 20,
            suggestedPurchaseQuantity: 1000,
            finalPurchaseQuantity: 1000,
            status: '待确认',
            remark: '建议原因',
          },
        ],
      },
    };
  };

  const applyNextOrderForecastResult = () => {
    try {
      const parsed = JSON.parse(nextOrderForecastResultText) as NextOrderForecastResult;

      if (typeof parsed.nextEstimatedOrders !== 'number') {
        setMessage('订单预估回填失败：JSON 里需要包含 nextEstimatedOrders 数字');
        return;
      }

      setNextOrderForecast({
        nextEstimatedOrders: parsed.nextEstimatedOrders,
        forecastBasis: parsed.forecastBasis || '',
      });
      setMessage('下期订单预估已回填');
    } catch {
      setMessage('订单预估回填失败：请粘贴合法 JSON');
    }
  };

  const applyNextProcurementResult = () => {
    try {
      const parsed = JSON.parse(nextProcurementResultText) as NextProcurementResult;
      const hasAdviceText = typeof parsed.procurementAdviceText === 'string' && parsed.procurementAdviceText.trim();
      const hasRiskSummary = typeof parsed.riskSummary === 'string' && parsed.riskSummary.trim();
      const hasSkus = Array.isArray(parsed.skus) && parsed.skus.length > 0;

      if (!hasAdviceText && !hasRiskSummary && !hasSkus) {
        setMessage(
          '采购测算回填失败：这看起来不是 Cursor 返回结果，请粘贴包含 procurementAdviceText、riskSummary 或 skus 的 JSON',
        );
        return;
      }

      setNextProcurement((current) => ({
        ...current,
        procurementAdviceText: parsed.procurementAdviceText || '',
        riskSummary: parsed.riskSummary || '',
      }));

      if (Array.isArray(parsed.skus)) {
        setSkus(parsed.skus.map(normalizeSkuDraft));
      }

      setMessage(`下期采购测算结果已回填${hasSkus ? `，SKU ${parsed.skus?.length || 0} 个` : ''}`);
    } catch {
      setMessage('采购测算回填失败：请粘贴合法 JSON');
    }
  };

  const saveActivity = async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setMessage('保存中...');

    try {
      if (!consumptionValidation.ok || !pendingInboundValidation.ok) {
        setMessage('保存失败：请先修正本期消耗摘要或未入库/在途商品 JSON');
        return;
      }

      await fetch('/api/db/init', { method: 'POST' });

      await fetch('/api/procurement/base-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyfromKeywords: splitValues(formData.keyfromKeywords),
          keyfromP1Values: splitValues(formData.keyfromP1Values),
          costLimit: formData.costLimit,
          supplyChannelId: 1051,
          supplyChannelName: '辅导服务-用户增长-扩科',
        }),
      });

      const month = formData.startDate ? formData.startDate.slice(0, 7) : '';
      const activityResponse = await fetch(
        activityId ? `/api/procurement/activities/${activityId}` : '/api/procurement/activities',
        {
          method: activityId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activityMonth: month,
            theme: formData.theme || '未命名活动',
            startDate: formData.startDate,
            endDate: formData.endDate,
            status: '草稿',
          }),
        }
      );
      const activityResult = await activityResponse.json();
      const nextActivityId = activityId || Number(activityResult.id);
      setActivityId(nextActivityId);

      await fetch(`/api/procurement/activities/${nextActivityId}/packages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packages: packages.map((pkg) => ({
            ...pkg,
            costLimit: Number(pkg.costLimit || 0),
            applicableScope: `总和不超过 ${Number(pkg.costLimit || 0)} 元`,
          })),
        }),
      });

      await fetch(`/api/procurement/activities/${nextActivityId}/order-forecast`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentMonthEstimatedOrders: 0,
          currentMonthActualOrders: 0,
          currentMonthRemainingOrders: 0,
          nextMonthEstimatedOrders: nextOrderForecast.nextEstimatedOrders,
          forecastBasis: nextOrderForecast.forecastBasis,
        }),
      });

      await fetch(`/api/procurement/activities/${nextActivityId}/purchase-advice`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseAdviceText: nextProcurement.procurementAdviceText,
          riskSummary: nextProcurement.riskSummary,
          currentConsumptionSummary: nextProcurement.currentConsumptionSummary,
          pendingInboundItemsText: nextProcurement.pendingInboundItemsText,
        }),
      });

      if (skusWithCalculatedFields.length > 0) {
        await fetch(`/api/procurement/activities/${nextActivityId}/final-skus`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skus: skusWithCalculatedFields }),
        });
      }

      setMessage(
        `已保存活动 #${nextActivityId}，礼包 ${packages.length} 个，定稿 SKU ${skus.length} 个${
          skus.length === 0 ? '。注意：当前没有保存任何 SKU，后续本期消耗无法判断 SKU 库存。' : ''
        }`,
      );
      const refreshedActivities = await fetch('/api/procurement/activities');
      if (refreshedActivities.ok) {
        setSavedActivities((await refreshedActivities.json()) as SavedActivityListItem[]);
      }
      window.localStorage.removeItem(draftStorageKey);
    } catch {
      setMessage('保存失败，请检查页面内容后重试');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <WorkArea>
      <div className="max-w-6xl">
        <h1 className="text-3xl font-bold mb-8">新增活动</h1>
        {message && (
          <div className="fixed right-6 top-6 z-50 max-w-md rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 shadow-lg">
            <div className="flex items-start gap-3">
              <span className="flex-1">{message}</span>
              <button
                type="button"
                onClick={() => setMessage('')}
                className="text-blue-500 hover:text-blue-700"
              >
                关闭
              </button>
            </div>
          </div>
        )}

        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-2">编辑已保存活动</h2>
          <p className="mb-4 text-sm text-gray-500">
            一个时间段只保留一个活动。选择已保存活动后，可以继续修改并覆盖保存。
          </p>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={activityId || ''}
            onChange={(event) => void loadActivityForEdit(event.target.value)}
          >
            <option value="">新建活动</option>
            {savedActivities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                #{activity.id} {activity.theme}（{activity.startDate || '-'} 至{' '}
                {activity.endDate || '-'}）
              </option>
            ))}
          </select>
        </section>

        {/* 基础配置 */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <button
            type="button"
            onClick={() => setIsBaseConfigOpen(!isBaseConfigOpen)}
            className="flex w-full items-start justify-between gap-4 text-left"
          >
            <div>
              <h2 className="text-xl font-semibold">基础配置</h2>
              <p className="mt-2 text-sm text-gray-500">
                已自动读取上次保存的固定口径；平时不用改，只有 keyfrom 或成本规则变化时再展开。
              </p>
            </div>
            <span className="rounded-md bg-gray-100 px-3 py-1 text-sm text-gray-600">
              {isBaseConfigOpen ? '收起' : '展开修改'}
            </span>
          </button>

          <div className="mt-4 rounded-md bg-gray-50 p-4 text-sm text-gray-600">
            <p>
              当前口径：
              一级 keyfrom ``
              {formData.keyfromP1Values || '未配置'}
              `` AND keyfrom 包含 ``
              {formData.keyfromKeywords || '未配置'}
              ``，成本上限 {formData.costLimit} 元，供应链渠道 1051。
            </p>
          </div>

          {isBaseConfigOpen && (
            <div className="mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    keyfrom 关键词（需包含任一关键词）
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formData.keyfromKeywords}
                    onChange={(e) => setFormData({ ...formData, keyfromKeywords: e.target.value })}
                    placeholder="多个关键词用逗号分隔"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    一级 keyfrom（必须命中任一值）
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formData.keyfromP1Values}
                    onChange={(e) => setFormData({ ...formData, keyfromP1Values: e.target.value })}
                    placeholder="多个值用逗号分隔"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">成本上限</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formData.costLimit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        costLimit: e.target.value === '' ? 0 : Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">供应链渠道</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                    value="辅导服务-用户增长-扩科 (ID: 1051)"
                    disabled
                  />
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-500">
                订单筛选逻辑：一级 keyfrom 命中任一值 AND keyfrom 包含任一关键词。
              </p>
            </div>
          )}
        </section>

        {/* 活动信息 */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">活动信息</h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">活动主题 *</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={formData.theme}
                onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                placeholder="例如：2026年5月促销活动"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">活动开始日期</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">活动结束日期</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 赠品组合 */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">赠品组合</h2>
            <button
              onClick={addPackage}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              + 添加礼包
            </button>
          </div>

          {packages.length === 0 ? (
            <p className="text-gray-500 text-center py-8">暂无礼包，请点击“添加礼包”按钮</p>
          ) : (
            <div className="space-y-4">
              {packages.map((pkg, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-medium">礼包 {index + 1}</h3>
                    <button
                      onClick={() => removePackage(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      删除
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">礼包名称</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        value={pkg.packageName}
                        onChange={(e) => updatePackage(index, 'packageName', e.target.value)}
                        placeholder="例如：扩科礼包 A"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium mb-2">可选项数</label>
                        <input
                          type="number"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={pkg.optionCount}
                          onChange={(e) =>
                            updatePackage(index, 'optionCount', Number(e.target.value || 0))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">可选数量</label>
                        <input
                          type="number"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={pkg.chooseCount}
                          onChange={(e) =>
                            updatePackage(index, 'chooseCount', Number(e.target.value || 0))
                          }
                        />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-2">成本约束</label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">总和不超过</span>
                        <input
                          type="number"
                          className="w-32 px-3 py-2 border border-gray-300 rounded-md"
                          value={pkg.costLimit ?? ''}
                          onChange={(e) =>
                            updatePackage(
                              index,
                              'costLimit',
                              e.target.value === '' ? '' : Number(e.target.value),
                            )
                          }
                          placeholder="70"
                        />
                        <span className="text-sm text-gray-600">元</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {isPlanningActivity && (
          <>
        {/* 下期订单预估 */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-2">下期订单预估</h2>
          <p className="mb-4 text-sm text-gray-500">
            这里只预估下期活动订单量，不做采购。结果会进入下期采购测算。
          </p>
          <div className="mb-4">
            <button
              onClick={() =>
                copyText(
                  JSON.stringify(buildNextOrderForecastPack(), null, 2),
                  '下期订单预估数据包已复制，可以粘贴给 Cursor',
                )
              }
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              生成下期订单预估数据包（复制给 Cursor）
            </button>
          </div>
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <label className="block text-sm font-medium mb-2">
              Cursor 返回的订单预估结果（JSON）
            </label>
            <textarea
              className="h-28 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={nextOrderForecastResultText}
              onChange={(e) => setNextOrderForecastResultText(e.target.value)}
              placeholder="粘贴 Cursor 返回的 JSON，例如包含 nextEstimatedOrders、forecastBasis"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={applyNextOrderForecastResult}
                className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800"
              >
                应用订单预估结果
              </button>
              <p className="text-xs text-gray-500">
                应用后会自动填入下方“下期预估订单量”和“预测依据”。
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">下期预估订单量</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={nextOrderForecast.nextEstimatedOrders}
                onChange={(e) =>
                  setNextOrderForecast({
                    ...nextOrderForecast,
                    nextEstimatedOrders: Number(e.target.value),
                  })
                }
                placeholder="Cursor 回填"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">预测依据</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
                value={nextOrderForecast.forecastBasis}
                onChange={(e) =>
                  setNextOrderForecast({
                    ...nextOrderForecast,
                    forecastBasis: e.target.value,
                  })
                }
                placeholder="Cursor 回填下期订单预测依据"
              />
            </div>
          </div>
        </section>

        {/* 下期采购测算 */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-2">下期采购测算</h2>
          <p className="mb-4 text-sm text-gray-500">
            这里才做采购：结合下期订单预估、本期剩余预计消耗、库存、期货和候补池，输出建议采购数量。
          </p>
          <div className="mb-4">
            <button
              onClick={() => void copyNextProcurementPack()}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              生成下期采购测算数据包（复制给 Cursor）
            </button>
          </div>
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <label className="block text-sm font-medium mb-2">
              Cursor 返回的采购测算结果（JSON）
            </label>
            <textarea
              className="h-32 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={nextProcurementResultText}
              onChange={(e) => setNextProcurementResultText(e.target.value)}
              placeholder="粘贴 Cursor 返回的 JSON，例如包含 procurementAdviceText、riskSummary、skus"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={applyNextProcurementResult}
                className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800"
              >
                应用采购测算结果
              </button>
              <p className="text-xs text-gray-500">
                应用后会自动填入建议正文、风险总结；如果包含 skus，也会更新最终定稿 SKU 表。
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                本期消耗摘要（从左侧“本期消耗情况”复制）
              </label>
              <textarea
                className={`w-full rounded-md border px-3 py-2 ${
                  consumptionValidation.ok ? 'border-gray-300' : 'border-red-400 bg-red-50'
                }`}
                rows={5}
                value={nextProcurement.currentConsumptionSummary}
                onChange={(e) =>
                  setNextProcurement({
                    ...nextProcurement,
                    currentConsumptionSummary: e.target.value,
                  })
                }
                placeholder="粘贴本期消耗情况模块生成的摘要，用于下期采购测算预扣库存"
              />
              <p className={`mt-1 text-xs ${consumptionValidation.ok ? 'text-gray-500' : 'text-red-600'}`}>
                {consumptionValidation.message}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                未入库/在途商品（手动粘贴，可选）
              </label>
              <textarea
                className={`w-full rounded-md border px-3 py-2 ${
                  pendingInboundValidation.ok ? 'border-gray-300' : 'border-red-400 bg-red-50'
                }`}
                rows={5}
                value={nextProcurement.pendingInboundItemsText}
                onChange={(e) =>
                  setNextProcurement({
                    ...nextProcurement,
                    pendingInboundItemsText: e.target.value,
                  })
                }
                placeholder={'粘贴 JSON 数组，例如：[{ "goodsCode": "SKU", "goodsName": "商品名", "pendingQuantity": 1000, "expectedArrivalDate": "2026-05-25", "remark": "已采购未入库" }]'}
              />
              <p className={`mt-1 text-xs ${pendingInboundValidation.ok ? 'text-gray-500' : 'text-red-600'}`}>
                {pendingInboundValidation.message}
              </p>
            </div>
            <div className="rounded-md bg-gray-50 p-4 text-sm text-gray-600">
              <p>
                当前下期订单预估：
                <span className="font-semibold text-gray-900">
                  {nextOrderForecast.nextEstimatedOrders.toLocaleString()} 单
                </span>
              </p>
              <p className="mt-1">
                预测依据：{nextOrderForecast.forecastBasis || '待回填'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">采购测算建议正文</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={6}
                value={nextProcurement.procurementAdviceText}
                onChange={(e) =>
                  setNextProcurement({
                    ...nextProcurement,
                    procurementAdviceText: e.target.value,
                  })
                }
                placeholder="Cursor 回填采购测算建议正文"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">风险总结</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
                value={nextProcurement.riskSummary}
                onChange={(e) =>
                  setNextProcurement({
                    ...nextProcurement,
                    riskSummary: e.target.value,
                  })
                }
                placeholder="Cursor 回填风险总结"
              />
            </div>
          </div>
        </section>
          </>
        )}

        {/* 最终定稿 SKU 表 */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">最终定稿 SKU 表</h2>
            <button
              onClick={addSku}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              + 添加 SKU
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">礼包</th>
                  <th className="px-4 py-2 text-left">新品/老品</th>
                  <th className="px-4 py-2 text-left">SKU 编码</th>
                  <th className="px-4 py-2 text-left">供应链商品名称</th>
                  <th className="px-4 py-2 text-left">前台展示商品名</th>
                  <th className="px-4 py-2 text-left">价格</th>
                  <th className="px-4 py-2 text-left">当前库存（含在途）</th>
                  <th className="px-4 py-2 text-left">活动开始初始库存</th>
                  <th className="px-4 py-2 text-left">6月预计消耗</th>
                  <th className="px-4 py-2 text-left">补充量</th>
                  <th className="px-4 py-2 text-left">是否补充</th>
                  <th className="px-4 py-2 text-left">6月结束后剩余</th>
                  <th className="px-4 py-2 text-left">实时库存</th>
                  <th className="px-4 py-2 text-left">状态</th>
                  <th className="px-4 py-2 text-left">备注</th>
                  <th className="px-4 py-2 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {skus.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="px-4 py-8 text-center text-gray-500">
                      暂无 SKU 数据，请先完成下期采购测算后添加
                    </td>
                  </tr>
                ) : (
                  skusWithCalculatedFields.map((sku, index) => (
                    <tr key={index} className="border-b border-gray-100 align-top">
                      <td className="px-2 py-2">
                        <input
                          className="w-28 rounded border border-gray-300 px-2 py-1"
                          value={sku.packageName}
                          onChange={(e) => updateSku(index, 'packageName', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          className="w-24 rounded border border-gray-300 px-2 py-1"
                          value={sku.isNewProduct ? '新品' : '老品'}
                          onChange={(e) =>
                            updateSku(index, 'isNewProduct', e.target.value === '新品')
                          }
                        >
                          <option>老品</option>
                          <option>新品</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-36 rounded border border-gray-300 px-2 py-1"
                          value={sku.goodsCode}
                          onChange={(e) => updateSku(index, 'goodsCode', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-48 rounded border border-gray-300 px-2 py-1"
                          value={sku.goodsName}
                          onChange={(e) => updateSku(index, 'goodsName', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-40 rounded border border-gray-300 px-2 py-1"
                          value={sku.displayName}
                          onChange={(e) => updateSku(index, 'displayName', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          className="w-24 rounded border border-gray-300 px-2 py-1"
                          value={sku.unitCost}
                          onChange={(e) => updateSku(index, 'unitCost', Number(e.target.value || 0))}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <span className="inline-block min-w-28 rounded bg-gray-50 px-2 py-1 text-sm text-gray-700">
                          {formatReadonlyQuantity(sku.currentWithPendingQuantity)}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <span className="inline-block min-w-28 rounded bg-gray-50 px-2 py-1 text-sm text-gray-700">
                          {formatReadonlyQuantity(sku.activityStartEstimatedQuantity)}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          className="w-24 rounded border border-gray-300 px-2 py-1"
                          value={sku.suggestedPurchaseQuantity}
                          onChange={(e) =>
                            updateSku(index, 'suggestedPurchaseQuantity', Number(e.target.value))
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          className="w-24 rounded border border-gray-300 px-2 py-1"
                          value={sku.finalPurchaseQuantity}
                          onChange={(e) =>
                            updateSku(index, 'finalPurchaseQuantity', Number(e.target.value))
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={`inline-block min-w-14 rounded px-2 py-1 text-center text-sm font-medium ${
                            Number(sku.finalPurchaseQuantity || 0) > 0
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-gray-50 text-gray-500'
                          }`}
                        >
                          {Number(sku.finalPurchaseQuantity || 0) > 0 ? '是' : '否'}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <span className="inline-block min-w-28 rounded bg-gray-50 px-2 py-1 text-sm text-gray-700">
                          {formatReadonlyQuantity(sku.juneEndingRemainingQuantity)}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex min-w-32 flex-col gap-1">
                          <button
                            onClick={() => void queryInventory(sku.goodsCode)}
                            className="rounded border border-blue-200 px-2 py-1 text-sm text-blue-600 hover:bg-blue-50"
                          >
                            查询库存
                          </button>
                          <span className="text-xs text-gray-500">
                            {inventoryByGoodsCode[sku.goodsCode] || '未查询'}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <select
                          className="w-24 rounded border border-gray-300 px-2 py-1"
                          value={sku.status}
                          onChange={(e) =>
                            updateSku(index, 'status', e.target.value as SkuDraft['status'])
                          }
                        >
                          <option>采购</option>
                          <option>借调</option>
                          <option>备货</option>
                          <option>无需处理</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-40 rounded border border-gray-300 px-2 py-1"
                          value={sku.remark}
                          onChange={(e) => updateSku(index, 'remark', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => removeSku(index)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 保存按钮 */}
        <div className="sticky bottom-0 -mx-2 flex items-center justify-between gap-4 border-t border-gray-200 bg-gray-50/95 px-2 py-4 backdrop-blur">
          <p className="text-sm text-gray-600">
            {message || '修改后点击保存，保存结果会显示在右上角。'}
          </p>
          <div className="flex justify-end space-x-4">
          <button
            onClick={saveActivity}
            disabled={isSaving}
            className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? '保存中...' : '暂存草稿'}
          </button>
          <button
            onClick={saveActivity}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? '保存中...' : '保存活动'}
          </button>
          </div>
        </div>
      </div>
    </WorkArea>
  );
}
