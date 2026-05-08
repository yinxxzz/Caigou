import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

type DbRow = Record<string, unknown>;

function mapSku(row: DbRow) {
  return {
    id: row.id,
    activityId: row.activity_id,
    packageId: row.package_id,
    packageName: row.package_name,
    isNewProduct: Boolean(row.is_new_product),
    goodsCode: row.goods_code,
    goodsName: row.goods_name,
    displayName: row.display_name,
    category: row.category,
    unitCost: row.unit_cost,
    suggestedPurchaseQuantity: row.suggested_purchase_quantity,
    finalPurchaseQuantity: row.final_purchase_quantity,
    status: row.status,
    remark: row.remark,
    sortOrder: row.sort_order,
  };
}

async function ensureFinalSkuColumns() {
  try {
    await db.execute('ALTER TABLE procurement_final_skus ADD COLUMN package_name TEXT');
  } catch {
    // Column already exists in initialized databases.
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureFinalSkuColumns();
    const { id: activityId } = await params;
    const result = await db.execute({
      sql: 'SELECT * FROM procurement_final_skus WHERE activity_id = ? ORDER BY sort_order',
      args: [activityId],
    });

    return NextResponse.json(result.rows.map(mapSku));
  } catch (error) {
    console.error('获取最终 SKU 失败:', error);
    return NextResponse.json({ error: '获取最终 SKU 失败' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureFinalSkuColumns();
    const { id: activityId } = await params;
    const body = await request.json();
    const { skus = [] } = body;

    await db.execute({
      sql: 'DELETE FROM procurement_final_skus WHERE activity_id = ?',
      args: [activityId],
    });

    for (let i = 0; i < skus.length; i++) {
      const sku = skus[i];
      await db.execute({
        sql: `
          INSERT INTO procurement_final_skus (
            activity_id,
            package_id,
            package_name,
            is_new_product,
            goods_code,
            goods_name,
            display_name,
            category,
            unit_cost,
            suggested_purchase_quantity,
            final_purchase_quantity,
            status,
            remark,
            sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          activityId,
          sku.packageId || null,
          sku.packageName || '',
          sku.isNewProduct ? 1 : 0,
          sku.goodsCode || '',
          sku.goodsName || '',
          sku.displayName || '',
          sku.category || '',
          Number(sku.unitCost || 0),
          Number(sku.suggestedPurchaseQuantity || 0),
          Number(sku.finalPurchaseQuantity || 0),
          sku.status || '待确认',
          sku.remark || '',
          i,
        ],
      });
    }

    await db.execute({
      sql: `
        UPDATE procurement_activities
        SET status = CASE
              WHEN status IN ('草稿', '已预测', '已建议') THEN '已定稿'
              ELSE status
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [activityId],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('保存最终 SKU 失败:', error);
    return NextResponse.json({ error: '保存最终 SKU 失败' }, { status: 500 });
  }
}
