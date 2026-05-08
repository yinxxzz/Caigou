import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

type DbRow = Record<string, unknown>;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 获取活动基本信息
    const activityResult = await db.execute({
      sql: 'SELECT * FROM procurement_activities WHERE id = ?',
      args: [id],
    });

    const activityRow = activityResult.rows[0];
    if (!activityRow) {
      return NextResponse.json({ error: '活动不存在' }, { status: 404 });
    }

    // 获取礼包信息
    const packagesResult = await db.execute({
      sql: 'SELECT * FROM procurement_gift_packages WHERE activity_id = ? ORDER BY sort_order',
      args: [id],
    });

    // 获取订单预测
    const forecastResult = await db.execute({
      sql: 'SELECT * FROM procurement_order_forecasts WHERE activity_id = ?',
      args: [id],
    });

    // 获取 SKU 列表
    const skusResult = await db.execute({
      sql: 'SELECT * FROM procurement_final_skus WHERE activity_id = ? ORDER BY sort_order',
      args: [id],
    });

    const activity = {
      id: activityRow.id,
      activityMonth: activityRow.activity_month,
      theme: activityRow.theme,
      startDate: activityRow.start_date,
      endDate: activityRow.end_date,
      status: activityRow.status,
      orderForecastText: activityRow.order_forecast_text,
      purchaseAdviceText: activityRow.purchase_advice_text,
      riskSummary: activityRow.risk_summary,
      sourceActivityId: activityRow.source_activity_id,
      createdAt: activityRow.created_at,
      updatedAt: activityRow.updated_at,
      packages: packagesResult.rows.map((row: DbRow) => ({
        id: row.id,
        activityId: row.activity_id,
        packageName: row.package_name,
        optionCount: row.option_count,
        chooseCount: row.choose_count,
        applicableScope: row.applicable_scope,
        sortOrder: row.sort_order,
      })),
      forecast: forecastResult.rows[0] ? {
        id: forecastResult.rows[0].id,
        activityId: forecastResult.rows[0].activity_id,
        currentMonthEstimatedOrders: forecastResult.rows[0].current_month_estimated_orders,
        currentMonthActualOrders: forecastResult.rows[0].current_month_actual_orders,
        currentMonthRemainingOrders: forecastResult.rows[0].current_month_remaining_orders,
        nextMonthEstimatedOrders: forecastResult.rows[0].next_month_estimated_orders,
        forecastBasis: forecastResult.rows[0].forecast_basis,
        createdAt: forecastResult.rows[0].created_at,
      } : null,
      skus: skusResult.rows.map((row: DbRow) => ({
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
      })),
    };

    return NextResponse.json(activity);
  } catch (error) {
    console.error('获取活动详情失败:', error);
    return NextResponse.json({ error: '获取活动详情失败' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const {
      activityMonth,
      theme,
      startDate,
      endDate,
      status,
      orderForecastText,
      purchaseAdviceText,
      riskSummary,
    } = body;

    await db.execute({
      sql: `
        UPDATE procurement_activities
        SET activity_month = ?,
            theme = ?,
            start_date = ?,
            end_date = ?,
            status = ?,
            order_forecast_text = ?,
            purchase_advice_text = ?,
            risk_summary = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [
        activityMonth,
        theme,
        startDate,
        endDate,
        status,
        orderForecastText || null,
        purchaseAdviceText || null,
        riskSummary || null,
        id,
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新活动失败:', error);
    return NextResponse.json({ error: '更新活动失败' }, { status: 500 });
  }
}
