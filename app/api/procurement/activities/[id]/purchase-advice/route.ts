import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: activityId } = await params;
    const body = await request.json();
    const { purchaseAdviceText, riskSummary } = body;

    await db.execute({
      sql: `
        UPDATE procurement_activities
        SET purchase_advice_text = ?,
            risk_summary = ?,
            status = CASE
              WHEN status IN ('草稿', '已预测') THEN '已建议'
              ELSE status
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [purchaseAdviceText || '', riskSummary || '', activityId],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('保存采购建议失败:', error);
    return NextResponse.json({ error: '保存采购建议失败' }, { status: 500 });
  }
}
