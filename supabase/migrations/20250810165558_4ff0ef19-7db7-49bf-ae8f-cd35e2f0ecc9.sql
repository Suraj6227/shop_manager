-- Remove the trigger causing double inventory deduction
DROP TRIGGER IF EXISTS after_sale_item_insert ON public.sale_items;