-- Check if there's a trigger on sale_items causing double deduction
-- First, let's see what triggers exist
SELECT schemaname, tablename, triggername, definition 
FROM pg_triggers 
WHERE tablename = 'sale_items' AND schemaname = 'public';