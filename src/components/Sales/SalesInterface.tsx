import { useState, useEffect } from 'react';
import { Search, Plus, Minus, ShoppingCart, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  inventory: {
    quantity_in_stock: number;
  };
}

interface CartItem extends Product {
  quantity: number;
  total: number;
}

interface StoreSettings {
  tax_percentage: number;
  store_name: string;
  currency: string;
}

const SalesInterface = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<StoreSettings>({
    tax_percentage: 18,
    store_name: 'Masala Shop',
    currency: 'INR'
  });
  
  const { toast } = useToast();

  useEffect(() => {
    fetchProducts();
    fetchSettings();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select(`
        id, name, price, unit,
        inventory (quantity_in_stock)
      `)
      .order('name');

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch products",
        variant: "destructive",
      });
    } else {
      setProducts(data || []);
    }
  };

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('store_settings')
      .select('key, value')
      .in('key', ['tax_percentage', 'store_name', 'currency']);

    if (data) {
      const settingsObj: any = data.reduce((acc, item) => ({
        ...acc,
        [item.key]: item.key === 'tax_percentage' ? parseFloat(item.value) : item.value
      }), {});
      
      setSettings({
        tax_percentage: settingsObj.tax_percentage || 18,
        store_name: settingsObj.store_name || 'Masala Shop',
        currency: settingsObj.currency || 'INR'
      });
    }
  };

  const addToCart = (product: Product, quantity: number = 1) => {
    const availableStock = product.inventory?.quantity_in_stock || 0;
    const existingItem = cart.find(item => item.id === product.id);
    const currentQuantity = existingItem ? existingItem.quantity : 0;

    if (currentQuantity + quantity > availableStock) {
      toast({
        title: "Insufficient Stock",
        description: `Only ${availableStock} ${product.unit} available`,
        variant: "destructive",
      });
      return;
    }

    if (existingItem) {
      updateCartQuantity(product.id, currentQuantity + quantity);
    } else {
      const cartItem: CartItem = {
        ...product,
        quantity,
        total: product.price * quantity
      };
      setCart([...cart, cartItem]);
    }
  };

  const updateCartQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(cart.map(item => 
      item.id === productId 
        ? { ...item, quantity: newQuantity, total: item.price * newQuantity }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.total, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal();
  };

  const processSale = async () => {
    if (cart.length === 0) {
      toast({
        title: "Error",
        description: "Cart is empty",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Create sale record
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          total_amount: calculateTotal(),
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          payment_method: paymentMethod,
          sale_number: `SALE-${Date.now()}`,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const saleItems = cart.map(item => ({
        sale_id: saleData.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.total
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Update inventory quantities manually
      for (const item of cart) {
        const { data: currentInventory } = await supabase
          .from('inventory')
          .select('quantity_in_stock')
          .eq('product_id', item.id)
          .single();
        
        if (currentInventory) {
          const newQuantity = currentInventory.quantity_in_stock - item.quantity;
          const { error: inventoryError } = await supabase
            .from('inventory')
            .update({ quantity_in_stock: newQuantity })
            .eq('product_id', item.id);

          if (inventoryError) throw inventoryError;
        }
      }

      toast({
        title: "Sale Completed",
        description: `Sale #${saleData.sale_number} processed successfully`,
      });

      // Reset form
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      fetchProducts(); // Refresh product stock
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to process sale",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const printBill = async () => {
    const printData = {
      storeName: settings.store_name,
      customerName: customerName || 'Walk-in',
      customerPhone: customerPhone || '',
      items: cart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.total
      })),
      subtotal: calculateSubtotal(),
      tax: (calculateSubtotal() * settings.tax_percentage) / 100,
      taxPercentage: settings.tax_percentage,
      total: calculateTotal(),
      currency: '₹',
      paymentMethod: paymentMethod
    };

    try {
      const { POSPrinter } = await import('@/utils/posPrint');
      await POSPrinter.print(printData);
      toast({
        title: "Receipt Printed",
        description: "Receipt sent to POS printer successfully",
      });
    } catch (error) {
      console.error('Print error:', error);
      toast({
        title: "Print Error",
        description: "Failed to print receipt. Please check printer connection.",
        variant: "destructive",
      });
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-primary mb-6">Sales Interface</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Search & Selection */}
        <div className="lg:col-span-2">
          <div className="mb-4">
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
            {filteredProducts.map((product) => {
              const stock = product.inventory?.quantity_in_stock || 0;
              return (
                <Card key={product.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => addToCart(product)}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                      <Badge variant={stock > 0 ? 'default' : 'destructive'}>
                        {stock} {product.unit}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-primary">₹{product.price}</p>
                    <Button 
                      size="sm" 
                      className="mt-2 w-full"
                      disabled={stock === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(product);
                      }}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add to Cart
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Cart & Checkout */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ShoppingCart className="mr-2 h-5 w-5" />
                Cart ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer Details */}
              <div className="space-y-2">
                <Input
                  placeholder="Customer Name (optional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
                <Input
                  placeholder="Customer Phone (optional)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Cart Items */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">₹{item.price} x {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bill Summary */}
              {cart.length > 0 && (
                <div className="space-y-2 pt-4 border-t">
                  <div className="flex justify-between font-bold">
                    <span>Total:</span>
                    <span>₹{calculateTotal().toFixed(2)}</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={processSale} 
                      disabled={loading}
                      className="flex-1"
                    >
                      {loading ? 'Processing...' : 'Complete Sale'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={printBill}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SalesInterface;