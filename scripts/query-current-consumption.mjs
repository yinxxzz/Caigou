#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const DEFAULT_COOKIE_SERVICES = [
  'http://127.0.0.1:18899',
  'http://10.134.208.184:18899',
];

const SHIPMENT_URL = 'https://conan.zhenguanyu.com/bolt-logistics-admin/api/shipments';
const BATCH_SHIPMENT_URL = 'https://conan.zhenguanyu.com/bolt-logistics-admin/api/batch-shipments';
const INVENTORY_URL = 'https://conan.zhenguanyu.com/bolt-logistics-admin/api/channel-inventories/';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (!item.startsWith('--')) {
      continue;
    }
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

async function readJsonInput(inputPath) {
  const text = inputPath
    ? await readFile(inputPath, 'utf8')
    : await new Promise((resolve, reject) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => {
          data += chunk;
        });
        process.stdin.on('end', () => resolve(data));
        process.stdin.on('error', reject);
      });

  return JSON.parse(text);
}

function parseDate(value, endOfDay = false) {
  if (!value) {
    return null;
  }
  const suffix = endOfDay ? 'T23:59:59' : 'T00:00:00';
  return new Date(`${value}${suffix}`);
}

function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function inclusiveDays(start, end) {
  const ms = parseDate(toDateString(end), false).getTime() - parseDate(toDateString(start), false).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

function minDate(a, b) {
  return a.getTime() <= b.getTime() ? a : b;
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanCode(value) {
  return String(value || '').trim();
}

function uniqueFinalSkus(pack) {
  const map = new Map();
  for (const item of pack.savedFinalSkus || []) {
    const code = cleanCode(item.goodsCode);
    if (!code) {
      continue;
    }
    if (!map.has(code)) {
      map.set(code, {
        goodsCode: code,
        goodsName: item.goodsName || item.displayName || code,
      });
    }
  }
  return [...map.values()];
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${url} ${response.status}: ${text.slice(0, 200)}`);
  }
  return response.json();
}

async function getCookie(cookieServiceArg) {
  const services = cookieServiceArg ? [cookieServiceArg] : DEFAULT_COOKIE_SERVICES;
  for (const base of services) {
    try {
      const payload = await fetchJson(`${base}/cookie`, { cache: 'no-store' });
      if (payload.cookie) {
        console.error(`cookie service: ${base}`);
        return payload.cookie;
      }
    } catch (error) {
      console.error(`cookie service failed: ${base} (${error.message})`);
    }
  }
  throw new Error('No usable supply-chain cookie service found.');
}

function buildHeaders(cookie) {
  return {
    Cookie: cookie,
    Accept: 'application/json, text/plain, */*',
    Referer: 'https://lean.zhenguanyu.com/',
    'User-Agent': 'Mozilla/5.0',
  };
}

async function getBatchShipments(headers, ids) {
  const url = new URL(BATCH_SHIPMENT_URL);
  url.searchParams.set('bizId', '6000');
  url.searchParams.set('shipmentIds', ids.join(','));
  return fetchJson(url, { headers, cache: 'no-store' });
}

async function scanShipmentConsumption({ headers, channelId, skuMap, startTime, endTime, maxPages }) {
  const consumption = new Map(
    [...skuMap.values()].map((item) => [
      item.goodsCode,
      {
        goodsCode: item.goodsCode,
        goodsName: item.goodsName,
        consumedQuantity: 0,
      },
    ]),
  );

  let scannedShipments = 0;
  let shipmentCountInRange = 0;
  let pages = 0;
  let minSeen = null;
  let maxSeen = null;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(SHIPMENT_URL);
    url.searchParams.set('bizId', '6000');
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('shipmentSearchTypes', '31');
    url.searchParams.set('channelId', String(channelId));

    const pagePayload = await fetchJson(url, { headers, cache: 'no-store' });
    const ids = pagePayload.list || [];
    if (!ids.length) {
      break;
    }

    const details = await getBatchShipments(headers, ids);
    pages += 1;

    const pageTimes = [];
    for (const shipment of details) {
      scannedShipments += 1;
      const createdTime = num(shipment.createdTime);
      if (createdTime) {
        pageTimes.push(createdTime);
        minSeen = minSeen === null ? createdTime : Math.min(minSeen, createdTime);
        maxSeen = maxSeen === null ? createdTime : Math.max(maxSeen, createdTime);
      }

      if (createdTime < startTime || createdTime > endTime) {
        continue;
      }

      shipmentCountInRange += 1;
      for (const shipmentItem of shipment.shipmentItems || []) {
        const code = cleanCode(shipmentItem.goodsCode);
        const item = consumption.get(code);
        if (!item) {
          continue;
        }
        item.goodsName = shipmentItem.goodsName || item.goodsName;
        item.consumedQuantity += num(shipmentItem.quantity);
      }
    }

    console.error(`shipments page ${page}: scanned ${scannedShipments}`);

    if (pageTimes.length && Math.max(...pageTimes) < startTime) {
      break;
    }
  }

  return {
    consumption,
    scanMeta: {
      pages,
      scannedShipments,
      shipmentCountInRange,
      minSeen: minSeen ? new Date(minSeen).toISOString() : null,
      maxSeen: maxSeen ? new Date(maxSeen).toISOString() : null,
    },
  };
}

async function fetchInventory({ headers, channelId, skuMap }) {
  const inventory = new Map([...skuMap.keys()].map((code) => [code, 0]));
  const names = new Map([...skuMap.values()].map((item) => [item.goodsCode, item.goodsName]));

  for (let page = 0; page < 50; page++) {
    const url = new URL(INVENTORY_URL);
    url.searchParams.set('bizId', '6000');
    url.searchParams.set('channelIds', String(channelId));
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', '100');

    const payload = await fetchJson(url, { headers, cache: 'no-store' });
    const rows = payload.list || payload.data?.list || [];
    for (const row of rows) {
      const code = cleanCode(row.goodsCode || row.sku);
      if (!inventory.has(code)) {
        continue;
      }
      inventory.set(code, inventory.get(code) + num(row.availableQuantity ?? row.sumAvailableQuantity));
      names.set(code, row.goodsName || names.get(code));
    }

    const totalPage = payload.pageInfo?.totalPage || payload.data?.pageInfo?.totalPage;
    if (totalPage !== undefined && page + 1 >= Number(totalPage)) {
      break;
    }
    if (!rows.length) {
      break;
    }
  }

  return { inventory, names };
}

function buildResult({ pack, skuMap, consumption, inventory, names, actualStart, actualEnd, completedOrders }) {
  const activityStart = parseDate(pack.activity?.startDate, false);
  const activityEnd = parseDate(pack.activity?.endDate, true);
  const elapsedDays = inclusiveDays(actualStart, actualEnd);
  const totalDays = inclusiveDays(activityStart, activityEnd);
  const progressRate = Math.round((elapsedDays / totalDays) * 100);
  const projectedTotalOrders =
    typeof completedOrders === 'number' ? Math.round((completedOrders * totalDays) / elapsedDays) : null;
  const remainingEstimatedOrders =
    typeof completedOrders === 'number' ? Math.max(0, projectedTotalOrders - completedOrders) : null;

  const skuItems = [...skuMap.keys()].map((code) => {
    const consumedQuantity = consumption.get(code)?.consumedQuantity || 0;
    const projectedTotalQuantity = consumedQuantity
      ? Math.round((consumedQuantity * totalDays) / elapsedDays)
      : 0;
    const remainingEstimatedQuantity = Math.max(0, projectedTotalQuantity - consumedQuantity);
    const availableQuantity = inventory.get(code) || 0;
    const endingAvailableQuantity = availableQuantity - remainingEstimatedQuantity;
    const noSignal = consumedQuantity === 0 && availableQuantity === 0;

    return {
      goodsCode: code,
      goodsName: names.get(code) || consumption.get(code)?.goodsName || skuMap.get(code).goodsName,
      consumedQuantity,
      projectedTotalQuantity,
      remainingEstimatedQuantity,
      availableQuantity,
      endingAvailableQuantity,
      status: noSignal ? '需确认编码' : endingAvailableQuantity >= 0 ? '够用' : '有风险',
    };
  });

  const consumedSkuQuantity = skuItems.reduce((sum, item) => sum + item.consumedQuantity, 0);
  const projectedTotalSkuQuantity = skuItems.reduce((sum, item) => sum + item.projectedTotalQuantity, 0);
  const remainingEstimatedSkuQuantity = skuItems.reduce((sum, item) => sum + item.remainingEstimatedQuantity, 0);
  const riskItems = skuItems.filter((item) => item.status !== '够用');
  const inventoryRiskSummary = riskItems.length
    ? `${riskItems.length} 个 SKU 需要关注：${riskItems.map((item) => `${item.goodsName}(${item.status})`).join('、')}`
    : '整体库存可覆盖本期剩余预计消耗';

  return {
    progressRate,
    completedOrders,
    projectedTotalOrders,
    remainingEstimatedOrders,
    consumedSkuQuantity,
    projectedTotalSkuQuantity,
    remainingEstimatedSkuQuantity,
    inventoryRiskSummary,
    skuItems,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pack = await readJsonInput(args.input);
  const finalSkus = uniqueFinalSkus(pack);
  if (!finalSkus.length) {
    throw new Error('Input JSON has no savedFinalSkus.');
  }

  const activityStart = parseDate(pack.activity?.startDate, false);
  const activityEnd = parseDate(pack.activity?.endDate, true);
  const yesterday = parseDate(toDateString(addDays(new Date(), -1)), true);
  const actualStart = parseDate(args['actual-start-date'] || pack.activity?.startDate, false);
  const actualEnd = args['actual-end-date']
    ? parseDate(args['actual-end-date'], true)
    : minDate(yesterday, activityEnd);

  if (!activityStart || !activityEnd || !actualStart || !actualEnd) {
    throw new Error('Input JSON must contain activity.startDate and activity.endDate.');
  }

  const channelId = num(pack.baseConfig?.supplyConsumptionLogic?.supplyChannelId, 1051);
  const skuMap = new Map(finalSkus.map((item) => [item.goodsCode, item]));
  const maxPages = num(args['max-pages'], 80);

  console.error(`activity: ${pack.activity?.theme || ''}`);
  console.error(`range: ${toDateString(actualStart)} ~ ${toDateString(actualEnd)}, channel ${channelId}`);
  console.error(`sku count: ${skuMap.size}`);

  let consumption = new Map(
    [...skuMap.values()].map((item) => [
      item.goodsCode,
      {
        goodsCode: item.goodsCode,
        goodsName: item.goodsName,
        consumedQuantity: 0,
      },
    ]),
  );
  let inventory = new Map([...skuMap.keys()].map((code) => [code, 0]));
  let names = new Map([...skuMap.values()].map((item) => [item.goodsCode, item.goodsName]));
  let scanMeta = { pages: 0, scannedShipments: 0, shipmentCountInRange: 0, minSeen: null, maxSeen: null };

  if (!args['dry-run']) {
    const cookie = await getCookie(args['cookie-service']);
    const headers = buildHeaders(cookie);
    const shipmentResult = await scanShipmentConsumption({
      headers,
      channelId,
      skuMap,
      startTime: actualStart.getTime(),
      endTime: actualEnd.getTime(),
      maxPages,
    });
    const inventoryResult = await fetchInventory({ headers, channelId, skuMap });

    consumption = shipmentResult.consumption;
    inventory = inventoryResult.inventory;
    names = inventoryResult.names;
    scanMeta = shipmentResult.scanMeta;
  }

  const completedOrders =
    args['completed-orders'] !== undefined ? num(args['completed-orders']) : null;

  const result = buildResult({
    pack,
    skuMap,
    consumption,
    inventory,
    names,
    actualStart,
    actualEnd,
    completedOrders,
  });

  if (args.debug) {
    result.debug = scanMeta;
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
