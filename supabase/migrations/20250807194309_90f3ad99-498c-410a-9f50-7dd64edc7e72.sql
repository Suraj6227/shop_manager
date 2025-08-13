-- Enable authentication trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'User'),
    'employee'::app_role
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Update store settings for tax management
INSERT INTO public.store_settings (key, value) VALUES 
  ('tax_percentage', '18.0'),
  ('store_name', 'Masala Shop'),
  ('currency', 'INR')
ON CONFLICT (key) DO NOTHING;