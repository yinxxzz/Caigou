import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

type DbRow = Record<string, unknown>;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    let sql = `
      SELECT *
      FROM procurement_activities
      WHERE id IN (
        SELECT MAX(id)
        FROM procurement_activities
        GROUP BY start_date, end_date
      )
    `;
    const args: string[] = [];

    if (month) {
      sql += ' AND activity_month = ?';
      args.push(month);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await db.execute({ sql, args });

    const activities = result.rows.map((row: DbRow) => ({
      id: row.id,
      activityMonth: row.activity_month,
      theme: row.theme,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      orderForecastText: row.order_forecast_text,
      purchaseAdviceText: row.purchase_advice_text,
      riskSummary: row.risk_summary,
      sourceActivityId: row.source_activity_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json(activities);
  } catch (error) {
    console.error('获取活动列表失败:', error);
    return NextResponse.json({ error: '获取活动列表失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      activityMonth,
      theme,
      startDate,
      endDate,
      status = '草稿',
      sourceActivityId,
    } = body;

    const existingResult = await db.execute({
      sql: `
        SELECT id
        FROM procurement_activities
        WHERE start_date = ? AND end_date = ?
        ORDER BY id DESC
      `,
      args: [startDate, endDate],
    });

    const existingId = existingResult.rows[0]?.id;

    if (existingId) {
      await db.execute({
        sql: `
          UPDATE procurement_activities
          SET activity_month = ?,
              theme = ?,
              start_date = ?,
              end_date = ?,
              status = ?,
              source_activity_id = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        args: [activityMonth, theme, startDate, endDate, status, sourceActivityId || null, existingId],
      });

      return NextResponse.json({
        success: true,
        id: existingId,
        reused: true,
      });
    }

    const result = await db.execute({
      sql: `
        INSERT INTO procurement_activities (
          activity_month, theme, start_date, end_date, status, source_activity_id
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [activityMonth, theme, startDate, endDate, status, sourceActivityId || null],
    });

    return NextResponse.json({
      success: true,
      id: result.lastInsertRowid,
      reused: false,
    });
  } catch (error) {
    console.error('创建活动失败:', error);
    return NextResponse.json({ error: '创建活动失败' }, { status: 500 });
  }
}
