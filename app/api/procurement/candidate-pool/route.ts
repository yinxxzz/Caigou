import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

type DbRow = Record<string, unknown>;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const snapshotMonth = searchParams.get('snapshotMonth');

    let sql = 'SELECT * FROM procurement_candidate_pool_items';
    const args: string[] = [];

    if (snapshotMonth) {
      sql += ' WHERE snapshot_month = ?';
      args.push(snapshotMonth);
    }

    sql += ' ORDER BY created_at DESC, id DESC';

    const result = await db.execute({ sql, args });
    const items = result.rows.map((row: DbRow) => ({
      id: row.id,
      snapshotMonth: row.snapshot_month,
      sourceType: row.source_type,
      productId: row.product_id,
      goodsCode: row.goods_code,
      productName: row.product_name,
      goodsName: row.goods_name,
      category: row.category,
      productType: row.product_type,
      costRange: row.cost_range,
      brand: row.brand,
      materialUrl: row.material_url,
      shopUrl: row.shop_url,
      needsSpecialPackaging: Boolean(row.needs_special_packaging),
      rawPayload: row.raw_payload,
      createdAt: row.created_at,
    }));

    return NextResponse.json(items);
  } catch (error) {
    console.error('获取候补池失败:', error);
    return NextResponse.json({ error: '获取候补池失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { snapshotMonth, sourceType = 'csv', items = [] } = body;

    if (!snapshotMonth) {
      return NextResponse.json({ error: '缺少 snapshotMonth' }, { status: 400 });
    }

    await db.execute({
      sql: 'DELETE FROM procurement_candidate_pool_items WHERE snapshot_month = ?',
      args: [snapshotMonth],
    });

    for (const item of items) {
      await db.execute({
        sql: `
          INSERT INTO procurement_candidate_pool_items (
            snapshot_month,
            source_type,
            product_id,
            goods_code,
            product_name,
            goods_name,
            category,
            product_type,
            cost_range,
            brand,
            material_url,
            shop_url,
            needs_special_packaging,
            raw_payload
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          snapshotMonth,
          sourceType,
          item.productId || '',
          item.goodsCode || '',
          item.productName || '',
          item.goodsName || '',
          item.category || '',
          item.productType || '',
          item.costRange || '',
          item.brand || '',
          item.materialUrl || '',
          item.shopUrl || '',
          item.needsSpecialPackaging ? 1 : 0,
          JSON.stringify(item),
        ],
      });
    }

    return NextResponse.json({ success: true, importedCount: items.length });
  } catch (error) {
    console.error('导入候补池失败:', error);
    return NextResponse.json({ error: '导入候补池失败' }, { status: 500 });
  }
}
