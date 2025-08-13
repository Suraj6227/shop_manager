-- Remove any triggers that might be causing double inventory deduction
DROP TRIGGER IF EXISTS update_inventory_after_sale_trigger ON public.sale_items;

-- Also check for any other triggers on inventory updates
DROP TRIGGER IF EXISTS update_inventory_trigger ON public.sale_items;