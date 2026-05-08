import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: activityId } = await params;
    const body = await request.json();
    const { reviewNote, exceptionNote, nextMonthNote } = body;

    await db.execute({
      sql: `
        UPDATE procurement_review_snapshots
        SET review_note = ?,
            exception_note = ?,
            next_month_note = ?
        WHERE id = (
          SELECT id
          FROM procurement_review_snapshots
          WHERE activity_id = ?
          ORDER BY generated_at DESC
          LIMIT 1
        )
      `,
      args: [
        reviewNote || '',
        exceptionNote || '',
        nextMonthNote || '',
        activityId,
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('保存复盘备注失败:', error);
    return NextResponse.json({ error: '保存复盘备注失败' }, { status: 500 });
  }
}
