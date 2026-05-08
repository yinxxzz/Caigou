import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

type DbRow = Record<string, unknown>;

export async function GET() {
  try {
    const result = await db.execute(`
      SELECT
        a.id,
        a.activity_month,
        a.theme,
        a.start_date,
        a.end_date,
        a.status,
        f.next_month_estimated_orders,
        r.actual_order_count,
        r.order_deviation,
        r.estimated_sku_quantity,
        r.actual_sku_quantity,
        r.total_cost,
        r.avg_cost_per_order,
        r.generated_at
      FROM procurement_activities a
      LEFT JOIN (
        SELECT *
        FROM procurement_order_forecasts
        WHERE id IN (
          SELECT MAX(id)
          FROM procurement_order_forecasts
          GROUP BY activity_id
        )
      ) f ON f.activity_id = a.id
      LEFT JOIN (
        SELECT *
        FROM procurement_review_snapshots
        WHERE id IN (
          SELECT MAX(id)
          FROM procurement_review_snapshots
          GROUP BY activity_id
        )
      ) r ON r.activity_id = a.id
      WHERE a.id IN (
        SELECT MAX(id)
        FROM procurement_activities
        GROUP BY start_date, end_date
      )
      ORDER BY a.start_date DESC, a.created_at DESC
    `);

    const reviews = result.rows.map((row: DbRow) => ({
      id: row.id,
      activityMonth: row.activity_month,
      theme: row.theme,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      estimatedOrderCount: row.next_month_estimated_orders,
      actualOrderCount: row.actual_order_count,
      orderDeviation: row.order_deviation,
      estimatedSkuQuantity: row.estimated_sku_quantity,
      actualSkuQuantity: row.actual_sku_quantity,
      totalCost: row.total_cost,
      avgCostPerOrder: row.avg_cost_per_order,
      generatedAt: row.generated_at,
    }));

    return NextResponse.json(reviews);
  } catch (error) {
    console.error('获取复盘列表失败:', error);
    return NextResponse.json({ error: '获取复盘列表失败' }, { status: 500 });
  }
}
