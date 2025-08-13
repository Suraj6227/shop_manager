import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Edit, Trash2, Search, Barcode } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ProductForm from './ProductForm';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  unit: string;
  barcode?: string;
  quantity: number;
  inventory: {
    quantity_in_stock: number;
    minimum_stock_level: number;
  };
}

const InventoryManager = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const { isOwner } = useAuth();
  const { toast } = useToast();

  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          inventory (
            quantity_in_stock,
            minimum_stock_level
          )
        `)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch products",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleDeleteProduct = async (productId: string) => {
    if (!isOwner) {
      toast({
        title: "Access Denied",
        description: "Only owners can delete products",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      });
    }
  };

  const generateBarcode = useCallback((productId: string) => {
    return `MSP${productId.replace(/-/g, '').substring(0, 8).toUpperCase()}`;
  }, []);

  const updateProductBarcode = async (productId: string) => {
    const barcode = generateBarcode(productId);
    try {
      const { error } = await supabase
        .from('products')
        .update({ barcode })
        .eq('id', productId);

      if (error) throw error;

      toast({
        title: "Barcode Generated",
        description: "Product barcode has been generated successfully",
      });

      fetchProducts();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate barcode",
        variant: "destructive",
      });
    }
  };

  const generateBarcodeImage = async (product: Product) => {
    try {
      if (!product.barcode) {
        toast({
          title: "No Barcode",
          description: "This product doesn't have a barcode yet",
          variant: "destructive",
        });
        return;
      }

      const canvas = document.createElement('canvas');
      
      JsBarcode(canvas, product.barcode, {
        format: "CODE128",
        width: 2,
        height: 100,
        displayValue: true,
        fontSize: 14,
        margin: 10
      });

      const dataURL = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataURL;
      link.download = `barcode-${product.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Barcode Downloaded",
        description: "Barcode image has been downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate barcode image",
        variant: "destructive",
      });
    }
  };

  const filteredProducts = useMemo(() => 
    products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase())
    ), [products, searchTerm]
  );

  const getStockStatus = (product: Product) => {
    const stock = product.inventory?.quantity_in_stock || 0;
    const minLevel = product.inventory?.minimum_stock_level || 1;
    
    if (stock === 0) return { label: 'Out of Stock', variant: 'destructive' as const };
    if (stock <= minLevel) return { label: 'Low Stock', variant: 'secondary' as const };
    return { label: 'In Stock', variant: 'default' as const };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-primary">Inventory Management</h1>
        {isOwner && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        )}
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product) => {
          const stockStatus = getStockStatus(product);
          const stock = product.inventory?.quantity_in_stock || 0;
          
          return (
            <Card key={product.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  <Badge variant={stockStatus.variant}>
                    {stockStatus.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{product.description}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Price:</span>
                    <span className="font-semibold">₹{product.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Stock:</span>
                    <span className="font-semibold">{stock} {product.unit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Category:</span>
                    <span className="text-sm capitalize">{product.category}</span>
                   </div>
                   {product.barcode && (
                     <div className="flex justify-between">
                       <span className="text-sm">Barcode:</span>
                       <span className="text-sm font-mono">{product.barcode}</span>
                     </div>
                   )}
                 </div>
                 
                 <div className="flex gap-2 mt-4">
                   {isOwner && (
                     <>
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => {
                           setEditingProduct(product);
                           setShowForm(true);
                         }}
                       >
                         <Edit className="mr-1 h-3 w-3" />
                         Edit
                       </Button>
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => handleDeleteProduct(product.id)}
                       >
                         <Trash2 className="mr-1 h-3 w-3" />
                         Delete
                       </Button>
                     </>
                   )}
                   {!product.barcode ? (
                     <Button 
                       size="sm" 
                       variant="secondary" 
                       onClick={() => updateProductBarcode(product.id)}
                       disabled={!isOwner}
                     >
                       Generate Barcode
                     </Button>
                   ) : (
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={() => generateBarcodeImage(product)}
                      >
                        <Barcode className="h-3 w-3 mr-1" />
                        Barcode
                      </Button>
                   )}
                 </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No products found</p>
        </div>
      )}

      <ProductForm
        open={showForm}
        onOpenChange={setShowForm}
        product={editingProduct}
        onSuccess={() => {
          fetchProducts();
          setShowForm(false);
          setEditingProduct(null);
        }}
      />
    </div>
  );
};

export default InventoryManager;