import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: activityId } = await params;
    const body = await request.json();
    const { packages } = body;

    // 删除旧的礼包
    await db.execute({
      sql: 'DELETE FROM procurement_gift_packages WHERE activity_id = ?',
      args: [activityId],
    });

    // 插入新的礼包
    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      await db.execute({
        sql: `
          INSERT INTO procurement_gift_packages (
            activity_id, package_name, option_count, choose_count, applicable_scope, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [
          activityId,
          pkg.packageName,
          pkg.optionCount,
          pkg.chooseCount,
          pkg.applicableScope || '',
          i,
        ],
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('保存礼包配置失败:', error);
    return NextResponse.json({ error: '保存礼包配置失败' }, { status: 500 });
  }
}
