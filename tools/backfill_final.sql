-- Final round: confident fills + mark rest as "待查"
-- Run: sqlite3 mwlab.db < tools/backfill_final.sql

-- Confident fills
UPDATE exhibition_brand SET organizer = '重庆市民政局、重庆市老龄工作委员会', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5849' AND organizer = '';
UPDATE exhibition_brand SET organizer = '中国半导体行业协会', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5857' AND organizer = '';
UPDATE exhibition_brand SET organizer = '湖北省口腔医学会', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5876' AND organizer = '';
UPDATE exhibition_brand SET organizer = '台湾区制茶工业同业公会', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5891' AND organizer = '';
UPDATE exhibition_brand SET organizer = '中国网印及制像协会', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5900' AND organizer = '';
UPDATE exhibition_brand SET organizer = '临沂市塑料行业协会', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5907' AND organizer = '';
UPDATE exhibition_brand SET organizer = '中国制冷空调工业协会', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5875' AND organizer = '';
UPDATE exhibition_brand SET organizer = '河南省制冷学会', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5850' AND organizer = '';
UPDATE exhibition_brand SET organizer = '河南省机械工程学会', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5848' AND organizer = '';

-- Mark uncertain ones as "待查"
UPDATE exhibition_brand SET organizer = '待查', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5887' AND organizer = '';
UPDATE exhibition_brand SET organizer = '待查', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5890' AND organizer = '';
UPDATE exhibition_brand SET organizer = '待查', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5892' AND organizer = '';
UPDATE exhibition_brand SET organizer = '待查', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5898' AND organizer = '';
UPDATE exhibition_brand SET organizer = '待查', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5899' AND organizer = '';
UPDATE exhibition_brand SET organizer = '待查', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5908' AND organizer = '';
UPDATE exhibition_brand SET organizer = '待查', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5911' AND organizer = '';
UPDATE exhibition_brand SET organizer = '待查', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5933' AND organizer = '';
UPDATE exhibition_brand SET organizer = '待查', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5934' AND organizer = '';

-- Record to manual_tag_history
INSERT INTO manual_tag_history (brand_id, field_name, old_value, new_value, changed_by, changed_at)
SELECT brand_id, 'organizer', '', organizer, 'manual_final', datetime('now','localtime')
FROM exhibition_brand
WHERE organizer != '' 
AND brand_id IN ('EXPO-5849','EXPO-5857','EXPO-5876','EXPO-5891','EXPO-5900','EXPO-5907','EXPO-5875','EXPO-5850','EXPO-5848','EXPO-5887','EXPO-5890','EXPO-5892','EXPO-5898','EXPO-5899','EXPO-5908','EXPO-5911','EXPO-5933','EXPO-5934')
AND updated_at >= datetime('now','localtime','-1 minute');
