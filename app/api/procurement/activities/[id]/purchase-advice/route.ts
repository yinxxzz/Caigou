import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

async function ensureProcurementInputColumns() {
  const columns = [
    ['current_consumption_summary', 'TEXT'],
    ['pending_inbound_items_text', 'TEXT'],
  ];

  for (const [name, type] of columns) {
    try {
      await db.execute(`ALTER TABLE procurement_activities ADD COLUMN ${name} ${type}`);
    } catch {
      // Column already exists in initialized databases.
    }
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureProcurementInputColumns();
    const { id: activityId } = await params;
    const body = await request.json();
    const {
      purchaseAdviceText,
      riskSummary,
      currentConsumptionSummary,
      pendingInboundItemsText,
    } = body;

    await db.execute({
      sql: `
        UPDATE procurement_activities
        SET purchase_advice_text = ?,
            risk_summary = ?,
            current_consumption_summary = ?,
            pending_inbound_items_text = ?,
            status = CASE
              WHEN status IN ('草稿', '已预测') THEN '已建议'
              ELSE status
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [
        purchaseAdviceText || '',
        riskSummary || '',
        currentConsumptionSummary || '',
        pendingInboundItemsText || '',
        activityId,
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('保存采购建议失败:', error);
    return NextResponse.json({ error: '保存采购建议失败' }, { status: 500 });
  }
}
