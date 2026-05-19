-- Manual organizer backfill for remaining brands
-- Run: sqlite3 mwlab.db < tools/backfill_remaining_organizers.sql

-- 6 no-edition (well-known German exhibitions)
UPDATE exhibition_brand SET organizer = 'Messe Düsseldorf', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-172E87D7' AND organizer = '';
UPDATE exhibition_brand SET organizer = 'Messe Düsseldorf', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-2A7FE8CC' AND organizer = '';
UPDATE exhibition_brand SET organizer = 'Messe Düsseldorf', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-2C1AFDD0' AND organizer = '';
UPDATE exhibition_brand SET organizer = 'Messe Düsseldorf', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-9E1DEC4F' AND organizer = '';
UPDATE exhibition_brand SET organizer = 'Messe Düsseldorf', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-D92BC0D6' AND organizer = '';
UPDATE exhibition_brand SET organizer = 'Messe Düsseldorf', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-27ACD341' AND organizer = '';

-- Major Chinese exhibitions
UPDATE exhibition_brand SET organizer = '中华人民共和国商务部、上海市人民政府', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5847' AND organizer = '';
UPDATE exhibition_brand SET organizer = '中国航空工业集团有限公司', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5869' AND organizer = '';
UPDATE exhibition_brand SET organizer = '慕尼黑展览（上海）有限公司', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5910' AND organizer = '';
UPDATE exhibition_brand SET organizer = '中国电子器材有限公司', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5859' AND organizer = '';
UPDATE exhibition_brand SET organizer = '上海博华国际展览有限公司', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5858' AND organizer = '';
UPDATE exhibition_brand SET organizer = '上海博华国际展览有限公司', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5866' AND organizer = '';
UPDATE exhibition_brand SET organizer = '中国内燃机工业协会', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5874' AND organizer = '';
UPDATE exhibition_brand SET organizer = '法兰克福展览（上海）有限公司', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5935' AND organizer = '';
UPDATE exhibition_brand SET organizer = '中国五金制品协会、德国科隆国际展览有限公司', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5173' AND organizer = '';
UPDATE exhibition_brand SET organizer = '深圳市工业和信息化局', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5842' AND organizer = '';
UPDATE exhibition_brand SET organizer = '中国和平利用军工技术协会', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5925' AND organizer = '';
UPDATE exhibition_brand SET organizer = '广东省医药行业协会', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5926' AND organizer = '';
UPDATE exhibition_brand SET organizer = '福建省人民政府', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5897' AND organizer = '';
UPDATE exhibition_brand SET organizer = '上海市现代食用农产品交流促进中心', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5868' AND organizer = '';
UPDATE exhibition_brand SET organizer = 'Messe Düsseldorf', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5141' AND organizer = '';
UPDATE exhibition_brand SET organizer = '上海励扩展览有限公司', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5174' AND organizer = '';
UPDATE exhibition_brand SET organizer = '中国五金制品协会', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5175' AND organizer = '';
UPDATE exhibition_brand SET organizer = '上海励扩展览有限公司', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5176' AND organizer = '';
UPDATE exhibition_brand SET organizer = '中国五金制品协会', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5177' AND organizer = '';
UPDATE exhibition_brand SET organizer = '深圳市模具技术学会', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5839' AND organizer = '';
UPDATE exhibition_brand SET organizer = '中国罐头工业协会', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5856' AND organizer = '';
UPDATE exhibition_brand SET organizer = 'Informa Markets', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5865' AND organizer = '';
UPDATE exhibition_brand SET organizer = 'Informa Markets', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5877' AND organizer = '';

-- 高交会系列子展 (same organizer as parent)
UPDATE exhibition_brand SET organizer = '中国商务部、科技部、工信部', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5916' AND organizer = '';
UPDATE exhibition_brand SET organizer = '中国商务部、科技部、工信部', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5917' AND organizer = '';
UPDATE exhibition_brand SET organizer = '中国商务部、科技部、工信部', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5918' AND organizer = '';
UPDATE exhibition_brand SET organizer = '中国商务部、科技部、工信部', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5919' AND organizer = '';
UPDATE exhibition_brand SET organizer = '中国商务部、科技部、工信部', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5924' AND organizer = '';
UPDATE exhibition_brand SET organizer = '中国商务部、科技部、工信部', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5927' AND organizer = '';
UPDATE exhibition_brand SET organizer = '中国商务部、科技部、工信部', updated_at = datetime('now','localtime') WHERE brand_id = 'EXPO-5932' AND organizer = '';

-- Record to manual_tag_history for all of the above
INSERT INTO manual_tag_history (brand_id, field_name, old_value, new_value, changed_by, changed_at)
SELECT brand_id, 'organizer', '', organizer, 'manual_inference', datetime('now','localtime')
FROM exhibition_brand
WHERE organizer != '' AND brand_id IN (
  'EXPO-172E87D7','EXPO-2A7FE8CC','EXPO-2C1AFDD0','EXPO-9E1DEC4F','EXPO-D92BC0D6','EXPO-27ACD341',
  'EXPO-5847','EXPO-5869','EXPO-5910','EXPO-5859','EXPO-5858','EXPO-5866','EXPO-5874',
  'EXPO-5935','EXPO-5173','EXPO-5842','EXPO-5925','EXPO-5926','EXPO-5897','EXPO-5868',
  'EXPO-5141','EXPO-5174','EXPO-5175','EXPO-5176','EXPO-5177','EXPO-5839','EXPO-5856',
  'EXPO-5865','EXPO-5877',
  'EXPO-5916','EXPO-5917','EXPO-5918','EXPO-5919','EXPO-5924','EXPO-5927','EXPO-5932'
)
AND brand_id NOT IN (SELECT brand_id FROM manual_tag_history WHERE field_name = 'organizer' AND changed_by = 'manual_inference');
