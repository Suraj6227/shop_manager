-- Check for any remaining triggers that might be causing double inventory updates
SELECT 
    t.tgname AS trigger_name,
    t.tgrelid::regclass AS table_name,
    p.proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid IN (
    SELECT oid FROM pg_class 
    WHERE relname IN ('sale_items', 'inventory') 
    AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
)
AND NOT t.tgisinternal;