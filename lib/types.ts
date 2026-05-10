// 基础配置
export interface BaseConfig {
  id: number;
  keyfromKeywords: string[];
  keyfromP1Values: string[];
  costLimit: number;
  supplyChannelId: number;
  supplyChannelName: string;
  updatedAt: string;
}

// 月度活动
export interface Activity {
  id: number;
  activityMonth: string;
  theme: string;
  startDate: string;
  endDate: string;
  status: '草稿' | '已预测' | '已建议' | '已定稿' | '已复盘';
  orderForecastText?: string;
  purchaseAdviceText?: string;
  riskSummary?: string;
  sourceActivityId?: number;
  createdAt: string;
  updatedAt: string;
}

// 礼包配置
export interface GiftPackage {
  id: number;
  activityId: number;
  packageName: string;
  optionCount: number; // N 选 M 里的 N
  chooseCount: number; // N 选 M 里的 M
  applicableScope: string;
  sortOrder: number;
}

// 订单预测结果
export interface OrderForecast {
  id: number;
  activityId: number;
  currentMonthEstimatedOrders: number;
  currentMonthActualOrders: number;
  currentMonthRemainingOrders: number;
  nextMonthEstimatedOrders: number;
  forecastBasis: string;
  createdAt: string;
}

// 最终 SKU 定稿
export interface FinalSku {
  id: number;
  activityId: number;
  packageId?: number;
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
  remark?: string;
  sortOrder: number;
}

// 复盘快照
export interface ReviewSnapshot {
  id: number;
  activityId: number;
  actualOrderCount: number;
  estimatedOrderCount: number;
  orderDeviation: number;
  actualSkuQuantity: number;
  estimatedSkuQuantity: number;
  skuQuantityDeviation: number;
  totalCost: number;
  avgCostPerOrder: number;
  generatedAt: string;
  reviewNote?: string;
  exceptionNote?: string;
  nextMonthNote?: string;
}

// SKU 消耗复盘
export interface ReviewSkuItem {
  id: number;
  reviewId: number;
  activityId: number;
  packageId?: number;
  goodsCode: string;
  goodsName: string;
  displayName: string;
  isNewProduct: boolean;
  estimatedQuantity: number;
  actualQuantity: number;
  quantityDeviation: number;
  unitCost: number;
  totalCost: number;
  isOutOfStock: boolean;
  remark?: string;
}

// 候补池快照
export interface CandidatePoolItem {
  id: number;
  snapshotMonth: string;
  sourceType: 'shimo' | 'csv';
  productId: string;
  goodsCode: string;
  productName: string;
  goodsName: string;
  category: string;
  productType: '新品' | '老品';
  costRange: string;
  brand: string;
  materialUrl?: string;
  shopUrl?: string;
  needsSpecialPackaging: boolean;
  rawPayload: string;
  createdAt: string;
}

// Cursor 数据包类型
export interface CursorOrderForecastPackage {
  activityId: number;
  activityMonth: string;
  theme: string;
  keyfromKeywords: string[];
  keyfromP1Values: string[];
  packages: {
    packageName: string;
    optionCount: number;
    chooseCount: number;
    applicableScope: string;
  }[];
  orderCriteria: {
    type: 'keyfrom' | 'keyfrom_p1';
    values: string[];
    courseType: '系统课';
    includeRefunds: boolean;
  };
}

export interface CursorPurchaseAdvicePackage {
  activityId: number;
  activityMonth: string;
  theme: string;
  costLimit: number;
  orderForecast: {
    currentMonthEstimatedOrders: number;
    currentMonthActualOrders: number;
    currentMonthRemainingOrders: number;
    nextMonthEstimatedOrders: number;
    forecastBasis: string;
  };
  packages: {
    packageName: string;
    optionCount: number;
    chooseCount: number;
  }[];
  candidatePool?: CandidatePoolItem[];
}
