import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: '复盘必须使用真实订单、运单和库存查数结果，当前不提供自动生成。' },
    { status: 501 },
  );
}
