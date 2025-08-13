-- Fix RLS policies for sale_items to allow anonymous users (since we're using hardcoded auth)
DROP POLICY IF EXISTS "Authenticated users can create sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Everyone can view sale items" ON public.sale_items;

-- Create new policies that allow all operations for anonymous users
CREATE POLICY "Allow all users to manage sale items" 
ON public.sale_items 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Also update other tables to ensure consistent access
DROP POLICY IF EXISTS "Allow all authenticated users to manage inventory" ON public.inventory;
DROP POLICY IF EXISTS "Everyone can view inventory" ON public.inventory;

CREATE POLICY "Allow all users to manage inventory" 
ON public.inventory 
FOR ALL 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all authenticated users to manage products" ON public.products;
DROP POLICY IF EXISTS "Everyone can view products" ON public.products;

CREATE POLICY "Allow all users to manage products" 
ON public.products 
FOR ALL 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all authenticated users to manage sales" ON public.sales;
DROP POLICY IF EXISTS "Everyone can view sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated users can create sales" ON public.sales;
DROP POLICY IF EXISTS "Sales visible to authenticated users" ON public.sales;

CREATE POLICY "Allow all users to manage sales" 
ON public.sales 
FOR ALL 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all authenticated users to manage store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Everyone can view settings" ON public.store_settings;

CREATE POLICY "Allow all users to manage store settings" 
ON public.store_settings 
FOR ALL 
USING (true) 
WITH CHECK (true);