import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: activityId } = await params;
    const body = await request.json();

    const {
      currentMonthEstimatedOrders,
      currentMonthActualOrders,
      currentMonthRemainingOrders,
      nextMonthEstimatedOrders,
      forecastBasis,
      forecastText,
    } = body;

    // 先检查是否已有预测记录
    const existingResult = await db.execute({
      sql: 'SELECT id FROM procurement_order_forecasts WHERE activity_id = ?',
      args: [activityId],
    });

    if (existingResult.rows.length > 0) {
      // 更新
      await db.execute({
        sql: `
          UPDATE procurement_order_forecasts
          SET current_month_estimated_orders = ?,
              current_month_actual_orders = ?,
              current_month_remaining_orders = ?,
              next_month_estimated_orders = ?,
              forecast_basis = ?
          WHERE activity_id = ?
        `,
        args: [
          currentMonthEstimatedOrders,
          currentMonthActualOrders,
          currentMonthRemainingOrders,
          nextMonthEstimatedOrders,
          forecastBasis || '',
          activityId,
        ],
      });
    } else {
      // 插入
      await db.execute({
        sql: `
          INSERT INTO procurement_order_forecasts (
            activity_id,
            current_month_estimated_orders,
            current_month_actual_orders,
            current_month_remaining_orders,
            next_month_estimated_orders,
            forecast_basis
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [
          activityId,
          currentMonthEstimatedOrders,
          currentMonthActualOrders,
          currentMonthRemainingOrders,
          nextMonthEstimatedOrders,
          forecastBasis || '',
        ],
      });
    }

    // 更新活动的订单预测文本
    if (forecastText) {
      await db.execute({
        sql: 'UPDATE procurement_activities SET order_forecast_text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: [forecastText, activityId],
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('保存订单预测失败:', error);
    return NextResponse.json({ error: '保存订单预测失败' }, { status: 500 });
  }
}
