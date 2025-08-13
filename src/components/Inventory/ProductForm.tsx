import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  unit: string;
  barcode?: string;
  quantity: number;
}

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSuccess: () => void;
}

const categories = [
  'spices',
  'grains',
  'pulses', 
  'oil',
  'flour',
  'seeds',
  'masala_powder',
  'dry_fruits',
  'other'
];

const units = ['kg', 'gm', 'litre', 'ml', 'piece', 'packet'];

const ProductForm = ({ open, onOpenChange, product, onSuccess }: ProductFormProps) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: 'spices',
    unit: 'kg',
    barcode: '',
    quantity: '',
    minimumStock: '1',
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        description: product.description || '',
        price: product.price.toString(),
        category: product.category,
        unit: product.unit,
        barcode: product.barcode || '',
        quantity: product.quantity.toString(),
        minimumStock: '1', // Default for editing
      });
    } else {
      setFormData({
        name: '',
        description: '',
        price: '',
        category: 'spices',
        unit: 'kg',
        barcode: '',
        quantity: '',
        minimumStock: '1',
      });
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const productData = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        category: formData.category,
        unit: formData.unit,
        barcode: formData.barcode || null,
        quantity: parseFloat(formData.quantity),
      };

      if (product) {
        // Update existing product
        const { error: productError } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id);

        if (productError) throw productError;

        // Update inventory
        const { error: inventoryError } = await supabase
          .from('inventory')
          .update({
            quantity_in_stock: parseFloat(formData.quantity),
            minimum_stock_level: parseFloat(formData.minimumStock),
          })
          .eq('product_id', product.id);

        if (inventoryError) throw inventoryError;

        toast({
          title: "Success",
          description: "Product updated successfully",
        });
      } else {
        // Create new product
        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert([productData])
          .select()
          .single();

        if (productError) throw productError;

        // Create inventory entry
        const { error: inventoryError } = await supabase
          .from('inventory')
          .insert([{
            product_id: newProduct.id,
            quantity_in_stock: parseFloat(formData.quantity),
            minimum_stock_level: parseFloat(formData.minimumStock),
          }]);

        if (inventoryError) throw inventoryError;

        toast({
          title: "Success",
          description: "Product created successfully",
        });
      }

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save product",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {product ? 'Edit Product' : 'Add New Product'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (₹) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category.replace('_', ' ').toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Select value={formData.unit} onValueChange={(value) => setFormData({ ...formData, unit: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimumStock">Min Stock</Label>
              <Input
                id="minimumStock"
                type="number"
                value={formData.minimumStock}
                onChange={(e) => setFormData({ ...formData, minimumStock: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Saving...' : (product ? 'Update' : 'Create')}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductForm;