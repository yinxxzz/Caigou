import { createClient } from '@libsql/client';

const dbPath = process.env.DATABASE_URL || 'file:local.db';

export const db = createClient({
  url: dbPath,
});

export async function initDatabase() {
  // 创建表的 SQL 语句
  const schema = `
    CREATE TABLE IF NOT EXISTS procurement_base_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      keyfrom_keywords TEXT,
      keyfrom_p1_values TEXT,
      cost_limit INTEGER DEFAULT 70,
      supply_channel_id INTEGER DEFAULT 1051,
      supply_channel_name TEXT DEFAULT '辅导服务-用户增长-扩科',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS procurement_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_month TEXT,
      theme TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      status TEXT DEFAULT '草稿',
      order_forecast_text TEXT,
      purchase_advice_text TEXT,
      risk_summary TEXT,
      current_consumption_summary TEXT,
      pending_inbound_items_text TEXT,
      source_activity_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS procurement_gift_packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      package_name TEXT NOT NULL,
      option_count INTEGER,
      choose_count INTEGER,
      applicable_scope TEXT,
      sort_order INTEGER,
      FOREIGN KEY (activity_id) REFERENCES procurement_activities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS procurement_order_forecasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      current_month_estimated_orders INTEGER,
      current_month_actual_orders INTEGER,
      current_month_remaining_orders INTEGER,
      next_month_estimated_orders INTEGER,
      forecast_basis TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (activity_id) REFERENCES procurement_activities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS procurement_final_skus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      package_id INTEGER,
      package_name TEXT,
      is_new_product INTEGER,
      goods_code TEXT,
      goods_name TEXT,
      display_name TEXT,
      category TEXT,
      unit_cost REAL,
      suggested_purchase_quantity INTEGER,
      final_purchase_quantity INTEGER,
      current_with_pending_quantity INTEGER DEFAULT 0,
      activity_start_estimated_quantity INTEGER DEFAULT 0,
      june_ending_remaining_quantity INTEGER DEFAULT 0,
      realtime_inventory_quantity INTEGER DEFAULT 0,
      status TEXT DEFAULT '无需处理',
      remark TEXT,
      sort_order INTEGER,
      FOREIGN KEY (activity_id) REFERENCES procurement_activities(id) ON DELETE CASCADE,
      FOREIGN KEY (package_id) REFERENCES procurement_gift_packages(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS procurement_review_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      actual_order_count INTEGER,
      estimated_order_count INTEGER,
      order_deviation REAL,
      actual_sku_quantity INTEGER,
      estimated_sku_quantity INTEGER,
      sku_quantity_deviation REAL,
      total_cost REAL,
      avg_cost_per_order REAL,
      generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      review_note TEXT,
      exception_note TEXT,
      next_month_note TEXT,
      FOREIGN KEY (activity_id) REFERENCES procurement_activities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS procurement_review_sku_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER NOT NULL,
      activity_id INTEGER NOT NULL,
      package_id INTEGER,
      goods_code TEXT,
      goods_name TEXT,
      display_name TEXT,
      is_new_product INTEGER,
      estimated_quantity INTEGER,
      actual_quantity INTEGER,
      quantity_deviation REAL,
      unit_cost REAL,
      total_cost REAL,
      is_out_of_stock INTEGER DEFAULT 0,
      remark TEXT,
      FOREIGN KEY (review_id) REFERENCES procurement_review_snapshots(id) ON DELETE CASCADE,
      FOREIGN KEY (activity_id) REFERENCES procurement_activities(id) ON DELETE CASCADE,
      FOREIGN KEY (package_id) REFERENCES procurement_gift_packages(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS procurement_candidate_pool_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_month TEXT,
      source_type TEXT,
      product_id TEXT,
      goods_code TEXT,
      product_name TEXT,
      goods_name TEXT,
      category TEXT,
      product_type TEXT,
      cost_range TEXT,
      brand TEXT,
      material_url TEXT,
      shop_url TEXT,
      needs_special_packaging INTEGER DEFAULT 0,
      raw_payload TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 插入默认基础配置
    INSERT OR IGNORE INTO procurement_base_config (id, keyfrom_keywords, keyfrom_p1_values, cost_limit, supply_channel_id, supply_channel_name)
    VALUES (1, '', '', 70, 1051, '辅导服务-用户增长-扩科');
  `;

  const statements = schema.split(';').filter(s => s.trim());

  for (const statement of statements) {
    if (statement.trim()) {
      await db.execute(statement);
    }
  }

  return { success: true };
}
