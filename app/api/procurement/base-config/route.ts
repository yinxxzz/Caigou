import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const result = await db.execute('SELECT * FROM procurement_base_config WHERE id = 1');
    const row = result.rows[0];

    if (!row) {
      return NextResponse.json({
        id: 1,
        keyfromKeywords: [],
        keyfromP1Values: [],
        costLimit: 70,
        supplyChannelId: 1051,
        supplyChannelName: '辅导服务-用户增长-扩科',
      });
    }

    return NextResponse.json({
      id: row.id,
      keyfromKeywords: row.keyfrom_keywords
        ? String(row.keyfrom_keywords).split(',').filter(Boolean)
        : [],
      keyfromP1Values: row.keyfrom_p1_values
        ? String(row.keyfrom_p1_values).split(',').filter(Boolean)
        : [],
      costLimit: row.cost_limit,
      supplyChannelId: row.supply_channel_id,
      supplyChannelName: row.supply_channel_name,
    });
  } catch (error) {
    console.error('获取基础配置失败:', error);
    return NextResponse.json({ error: '获取基础配置失败' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { keyfromKeywords, keyfromP1Values, costLimit, supplyChannelId, supplyChannelName } = body;

    await db.execute({
      sql: `
        UPDATE procurement_base_config
        SET keyfrom_keywords = ?,
            keyfrom_p1_values = ?,
            cost_limit = ?,
            supply_channel_id = ?,
            supply_channel_name = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `,
      args: [
        keyfromKeywords?.join(',') || '',
        keyfromP1Values?.join(',') || '',
        costLimit || 70,
        supplyChannelId || 1051,
        supplyChannelName || '辅导服务-用户增长-扩科',
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('保存基础配置失败:', error);
    return NextResponse.json({ error: '保存基础配置失败' }, { status: 500 });
  }
}
