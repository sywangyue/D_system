-- 007: data_provenance 去重 + (brand_id, source_url) 唯一索引
-- 支持幂等重跑合并：INSERT OR IGNORE 由唯一索引保证不重复插入

-- 删除重复行，保留每组 (brand_id, source_url) 中 rowid 最小的那行
DELETE FROM data_provenance
WHERE rowid NOT IN (
    SELECT MIN(rowid)
    FROM data_provenance
    GROUP BY brand_id, source_url
);

-- 唯一索引（INSERT OR IGNORE 配合此键实现幂等）
CREATE UNIQUE INDEX IF NOT EXISTS idx_provenance_brand_url
    ON data_provenance(brand_id, source_url);
