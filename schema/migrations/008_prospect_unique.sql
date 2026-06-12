-- 008: customer_prospect (brand_id, qcc_key_no) 部分唯一索引 + 存量去重

-- 删除重复行（仅 qcc_key_no IS NOT NULL 范围），保留每组中 rowid 最小的
DELETE FROM customer_prospect
WHERE qcc_key_no IS NOT NULL
  AND rowid NOT IN (
      SELECT MIN(rowid)
      FROM customer_prospect
      WHERE qcc_key_no IS NOT NULL
      GROUP BY brand_id, qcc_key_no
  );

-- 部分唯一索引：qcc_key_no 为 NULL 的行不参与唯一约束
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospect_brand_qcc
    ON customer_prospect(brand_id, qcc_key_no)
    WHERE qcc_key_no IS NOT NULL;
