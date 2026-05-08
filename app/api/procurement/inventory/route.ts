import { NextResponse } from 'next/server';

const COOKIE_SERVICES = ['http://127.0.0.1:18899', 'http://10.134.208.184:18899'];
const INVENTORY_URL = 'https://conan.zhenguanyu.com/bolt-logistics-admin/api/channel-inventories/';

type InventoryRow = Record<string, unknown>;

async function fetchJson(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${url} ${response.status}`);
  }
  return response.json();
}

async function getCookie() {
  for (const baseUrl of COOKIE_SERVICES) {
    try {
      const payload = await fetchJson(`${baseUrl}/cookie`, { cache: 'no-store' });
      if (payload.cookie) {
        return String(payload.cookie);
      }
    } catch {
      // Try next cookie service.
    }
  }

  throw new Error('供应链 Cookie 服务不可用');
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const goodsCode = String(searchParams.get('goodsCode') || '').trim();
    const channelId = String(searchParams.get('channelId') || '1051');

    if (!goodsCode) {
      return NextResponse.json({ error: '缺少 goodsCode' }, { status: 400 });
    }

    const cookie = await getCookie();
    let availableQuantity = 0;
    let goodsName = '';

    for (let page = 0; page < 80; page++) {
      const url = new URL(INVENTORY_URL);
      url.searchParams.set('bizId', '6000');
      url.searchParams.set('channelIds', channelId);
      url.searchParams.set('page', String(page));
      url.searchParams.set('pageSize', '100');

      const payload = await fetchJson(url.toString(), {
        cache: 'no-store',
        headers: {
          Cookie: cookie,
          Accept: 'application/json, text/plain, */*',
          Referer: 'https://lean.zhenguanyu.com/',
          'User-Agent': 'Mozilla/5.0',
        },
      });
      const rows = (payload.list || payload.data?.list || []) as InventoryRow[];

      for (const row of rows) {
        if (String(row.goodsCode || row.sku || '').trim() !== goodsCode) {
          continue;
        }

        availableQuantity += toNumber(row.availableQuantity ?? row.sumAvailableQuantity);
        goodsName = String(row.goodsName || goodsName);
      }

      const totalPage = payload.pageInfo?.totalPage || payload.data?.pageInfo?.totalPage;
      if ((totalPage !== undefined && page + 1 >= Number(totalPage)) || rows.length === 0) {
        break;
      }
    }

    return NextResponse.json({
      goodsCode,
      goodsName,
      availableQuantity,
      channelId: Number(channelId),
    });
  } catch (error) {
    console.error('查询实时库存失败:', error);
    return NextResponse.json({ error: '查询实时库存失败' }, { status: 500 });
  }
}
