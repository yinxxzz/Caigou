import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

type DbRow = Record<string, unknown>;

function mapReview(row: DbRow) {
  return {
    id: row.id,
    activityId: row.activity_id,
    actualOrderCount: row.actual_order_count,
    estimatedOrderCount: row.estimated_order_count,
    orderDeviation: row.order_deviation,
    actualSkuQuantity: row.actual_sku_quantity,
    estimatedSkuQuantity: row.estimated_sku_quantity,
    skuQuantityDeviation: row.sku_quantity_deviation,
    totalCost: row.total_cost,
    avgCostPerOrder: row.avg_cost_per_order,
    generatedAt: row.generated_at,
    reviewNote: row.review_note,
    exceptionNote: row.exception_note,
    nextMonthNote: row.next_month_note,
  };
}

function mapReviewSku(row: DbRow) {
  return {
    id: row.id,
    reviewId: row.review_id,
    activityId: row.activity_id,
    packageId: row.package_id,
    packageName: row.package_name,
    goodsCode: row.goods_code,
    goodsName: row.goods_name,
    displayName: row.display_name,
    isNewProduct: Boolean(row.is_new_product),
    estimatedQuantity: row.estimated_quantity,
    actualQuantity: row.actual_quantity,
    quantityDeviation: row.quantity_deviation,
    unitCost: row.unit_cost,
    totalCost: row.total_cost,
    isOutOfStock: Boolean(row.is_out_of_stock),
    remark: row.remark,
  };
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: activityId } = await params;
    const reviewResult = await db.execute({
      sql: `
        SELECT *
        FROM procurement_review_snapshots
        WHERE activity_id = ?
        ORDER BY generated_at DESC
        LIMIT 1
      `,
      args: [activityId],
    });

    const reviewRow = reviewResult.rows[0];
    if (!reviewRow) {
      return NextResponse.json(null);
    }

    const skuResult = await db.execute({
      sql: `
        SELECT ri.*, gp.package_name
        FROM procurement_review_sku_items ri
        LEFT JOIN procurement_gift_packages gp ON gp.id = ri.package_id
        WHERE ri.review_id = ?
        ORDER BY ri.actual_quantity DESC
      `,
      args: [reviewRow.id],
    });

    return NextResponse.json({
      review: mapReview(reviewRow),
      skuItems: skuResult.rows.map(mapReviewSku),
    });
  } catch (error) {
    console.error('获取复盘数据失败:', error);
    return NextResponse.json({ error: '获取复盘数据失败' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: activityId } = await params;
    const body = await request.json();
    const skuItems = Array.isArray(body.skuItems) ? body.skuItems : [];
    const estimatedOrderCount = toNumber(body.estimatedOrderCount);
    const actualOrderCount = toNumber(body.actualOrderCount);
    const estimatedSkuQuantity = skuItems.reduce(
      (sum: number, item: DbRow) => sum + toNumber(item.estimatedQuantity),
      0,
    );
    const actualSkuQuantity = skuItems.reduce(
      (sum: number, item: DbRow) => sum + toNumber(item.actualQuantity),
      0,
    );
    const totalCost = skuItems.reduce(
      (sum: number, item: DbRow) => sum + toNumber(item.totalCost, toNumber(item.actualQuantity) * toNumber(item.unitCost)),
      0,
    );
    const orderDeviation = estimatedOrderCount
      ? (actualOrderCount - estimatedOrderCount) / estimatedOrderCount
      : 0;
    const skuQuantityDeviation = estimatedSkuQuantity
      ? (actualSkuQuantity - estimatedSkuQuantity) / estimatedSkuQuantity
      : 0;
    const avgCostPerOrder = actualOrderCount ? totalCost / actualOrderCount : 0;

    await db.execute({
      sql: 'DELETE FROM procurement_review_sku_items WHERE activity_id = ?',
      args: [activityId],
    });

    await db.execute({
      sql: 'DELETE FROM procurement_review_snapshots WHERE activity_id = ?',
      args: [activityId],
    });

    const reviewResult = await db.execute({
      sql: `
        INSERT INTO procurement_review_snapshots (
          activity_id,
          actual_order_count,
          estimated_order_count,
          order_deviation,
          actual_sku_quantity,
          estimated_sku_quantity,
          sku_quantity_deviation,
          total_cost,
          avg_cost_per_order,
          review_note,
          exception_note,
          next_month_note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        activityId,
        actualOrderCount,
        estimatedOrderCount,
        orderDeviation,
        actualSkuQuantity,
        estimatedSkuQuantity,
        skuQuantityDeviation,
        totalCost,
        avgCostPerOrder,
        String(body.reviewNote || ''),
        String(body.exceptionNote || ''),
        String(body.nextMonthNote || ''),
      ],
    });

    const reviewId = Number(reviewResult.lastInsertRowid);

    for (const item of skuItems) {
      const estimatedQuantity = toNumber(item.estimatedQuantity);
      const actualQuantity = toNumber(item.actualQuantity);
      const unitCost = toNumber(item.unitCost);
      const itemTotalCost = toNumber(item.totalCost, actualQuantity * unitCost);

      await db.execute({
        sql: `
          INSERT INTO procurement_review_sku_items (
            review_id,
            activity_id,
            package_id,
            goods_code,
            goods_name,
            display_name,
            is_new_product,
            estimated_quantity,
            actual_quantity,
            quantity_deviation,
            unit_cost,
            total_cost,
            is_out_of_stock,
            remark
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          reviewId,
          activityId,
          item.packageId ? Number(item.packageId) : null,
          String(item.goodsCode || ''),
          String(item.goodsName || ''),
          String(item.displayName || ''),
          item.isNewProduct ? 1 : 0,
          estimatedQuantity,
          actualQuantity,
          estimatedQuantity ? (actualQuantity - estimatedQuantity) / estimatedQuantity : 0,
          unitCost,
          itemTotalCost,
          item.isOutOfStock ? 1 : 0,
          String(item.remark || ''),
        ],
      });
    }

    await db.execute({
      sql: 'UPDATE procurement_activities SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: ['已复盘', activityId],
    });

    return NextResponse.json({
      success: true,
      reviewId,
      actualOrderCount,
      actualSkuQuantity,
      totalCost,
    });
  } catch (error) {
    console.error('保存复盘数据失败:', error);
    return NextResponse.json({ error: '保存复盘数据失败' }, { status: 500 });
  }
}
