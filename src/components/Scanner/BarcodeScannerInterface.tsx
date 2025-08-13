import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Camera, CameraOff, Search, Plus, Minus, Trash2, ShoppingCart, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import BarcodeGenerator from './QRCodeGenerator';

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  quantity: number;
  barcode?: string;
  category: string;
}

interface CartItem extends Product {
  cartQuantity: number;
  total: number;
}

interface StoreSettings {
  storeName: string;
  taxPercentage: number;
  currency: string;
}

const BarcodeScannerInterface = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [physicalScannerMode, setPhysicalScannerMode] = useState(false);
  const [scannedInput, setScannedInput] = useState('');
  const [settings, setSettings] = useState<StoreSettings>({
    storeName: 'Masala Shop',
    taxPercentage: 0,
    currency: '₹'
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const { toast } = useToast();

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;

      setProducts(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch products",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('store_settings')
        .select('key, value');

      if (error) throw error;

      const settingsMap = data?.reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {} as Record<string, string>) || {};

      setSettings({
        storeName: settingsMap.store_name || 'Masala Shop',
        taxPercentage: parseFloat(settingsMap.tax_percentage || '0'),
        currency: settingsMap.currency || '₹'
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchSettings();

    // Physical scanner event listener
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!physicalScannerMode) return;

      if (e.key === 'Enter') {
        if (scannedInput.trim()) {
          handleBarcodeScanned(scannedInput.trim());
          setScannedInput('');
        }
      } else {
        setScannedInput(prev => prev + e.key);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [fetchProducts, fetchSettings, physicalScannerMode, scannedInput]);

  const startScanner = useCallback(async () => {
    try {
      if (!readerRef.current) {
        readerRef.current = new BrowserMultiFormatReader();
      }

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      if (devices.length === 0) {
        throw new Error('No camera devices found');
      }

      setScannerActive(true);
      
      if (videoRef.current) {
        await readerRef.current.decodeFromVideoDevice(
          devices[0].deviceId,
          videoRef.current,
          (result, error) => {
            if (result) {
              const barcode = result.getText();
              handleBarcodeScanned(barcode);
            }
          }
        );
      }
    } catch (error) {
      toast({
        title: "Scanner Error",
        description: "Failed to start camera scanner",
        variant: "destructive",
      });
      setScannerActive(false);
    }
  }, [toast]);

  const stopScanner = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setScannerActive(false);
  }, []);

  const handleBarcodeScanned = useCallback((barcode: string) => {
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      addToCart(product);
      toast({
        title: "Product Scanned",
        description: `${product.name} added to cart`,
      });
    } else {
      toast({
        title: "Product Not Found",
        description: `No product found with barcode: ${barcode}`,
        variant: "destructive",
      });
    }
  }, [products, toast]);

  const addToCart = useCallback((product: Product) => {
    if (product.quantity <= 0) {
      toast({
        title: "Out of Stock",
        description: `${product.name} is currently out of stock`,
        variant: "destructive",
      });
      return;
    }

    setCart(prev => {
      const existingItem = prev.find(item => item.id === product.id);
      if (existingItem) {
        if (existingItem.cartQuantity >= product.quantity) {
          toast({
            title: "Insufficient Stock",
            description: `Only ${product.quantity} ${product.unit} available`,
            variant: "destructive",
          });
          return prev;
        }
        return prev.map(item =>
          item.id === product.id
            ? { ...item, cartQuantity: item.cartQuantity + 1, total: (item.cartQuantity + 1) * item.price }
            : item
        );
      } else {
        return [...prev, { ...product, cartQuantity: 1, total: product.price }];
      }
    });
  }, [toast]);

  const updateCartQuantity = useCallback((productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = products.find(p => p.id === productId);
    if (product && newQuantity > product.quantity) {
      toast({
        title: "Insufficient Stock",
        description: `Only ${product.quantity} ${product.unit} available`,
        variant: "destructive",
      });
      return;
    }

    setCart(prev =>
      prev.map(item =>
        item.id === productId
          ? { ...item, cartQuantity: newQuantity, total: newQuantity * item.price }
          : item
      )
    );
  }, [products, toast]);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  }, []);

  const calculateSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.total, 0);
  }, [cart]);

  const calculateTotal = useMemo(() => {
    const subtotal = calculateSubtotal;
    const tax = (subtotal * settings.taxPercentage) / 100;
    return subtotal + tax;
  }, [calculateSubtotal, settings.taxPercentage]);

  const processSale = async () => {
    if (cart.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Please add items to cart before processing sale",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Create sale record
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          total_amount: calculateTotal,
          payment_method: paymentMethod,
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          sale_number: '', // Will be set by trigger
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const saleItems = cart.map(item => ({
        sale_id: sale.id,
        product_id: item.id,
        quantity: item.cartQuantity,
        unit_price: item.price,
        total_price: item.total,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Update inventory
      for (const item of cart) {
        const { error: inventoryError } = await supabase
          .from('products')
          .update({ quantity: item.quantity - item.cartQuantity })
          .eq('id', item.id);

        if (inventoryError) throw inventoryError;
      }

      toast({
        title: "Sale Completed",
        description: `Sale #${sale.sale_number} completed successfully`,
      });

      // Reset form
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setPaymentMethod('cash');
      fetchProducts(); // Refresh product quantities
    } catch (error) {
      toast({
        title: "Sale Failed",
        description: "Failed to process sale. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const printBill = async () => {
    const printData = {
      storeName: settings.storeName,
      customerName: customerName || 'Walk-in',
      customerPhone: customerPhone || '',
      items: cart.map(item => ({
        name: item.name,
        quantity: item.cartQuantity,
        price: item.price,
        total: item.total
      })),
      subtotal: calculateSubtotal,
      tax: (calculateSubtotal * settings.taxPercentage) / 100,
      taxPercentage: settings.taxPercentage,
      total: calculateTotal,
      currency: settings.currency,
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

  const filteredProducts = useMemo(() => 
    products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.barcode && product.barcode.includes(searchTerm))
    ), [products, searchTerm]
  );

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Barcode Scanner</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => setPhysicalScannerMode(!physicalScannerMode)}
            variant={physicalScannerMode ? "default" : "outline"}
          >
            {physicalScannerMode ? 'Physical Scanner ON' : 'Physical Scanner OFF'}
          </Button>
          <Button
            onClick={scannerActive ? stopScanner : startScanner}
            variant={scannerActive ? "destructive" : "outline"}
          >
            {scannerActive ? <CameraOff className="mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}
            {scannerActive ? 'Stop Camera' : 'Start Camera'}
          </Button>
        </div>
      </div>

      {physicalScannerMode && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <p className="text-green-700 font-medium">Physical Scanner Active - Scan a barcode now!</p>
            </div>
            {scannedInput && (
              <p className="text-sm text-green-600 mt-2">Scanning: {scannedInput}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scanner Section */}
        <div className="lg:col-span-2">
          {scannerActive && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Camera Scanner</CardTitle>
              </CardHeader>
              <CardContent>
                <video
                  ref={videoRef}
                  className="w-full h-64 bg-black rounded-lg"
                  autoPlay
                  playsInline
                />
              </CardContent>
            </Card>
          )}

          {/* Product Search */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products by name, category, or barcode..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {filteredProducts.map((product) => (
                  <Card key={product.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium">{product.name}</h3>
                        <Badge variant={product.quantity > 0 ? "default" : "destructive"}>
                          {product.quantity} {product.unit}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{product.category}</p>
                      {product.barcode && (
                        <p className="text-xs text-muted-foreground mb-2">Barcode: {product.barcode}</p>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold">{settings.currency}{product.price}</span>
                        <Button
                          size="sm"
                          onClick={() => addToCart(product)}
                          disabled={product.quantity <= 0}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Barcode Generator for products without barcodes */}
          <BarcodeGenerator products={products} onUpdate={fetchProducts} />
        </div>

        {/* Cart Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Cart ({cart.length} items)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Cart is empty</p>
              ) : (
                <>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{item.name}</h4>
                          <p className="text-xs text-muted-foreground">{settings.currency}{item.price}/{item.unit}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateCartQuantity(item.id, item.cartQuantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm">{item.cartQuantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateCartQuantity(item.id, item.cartQuantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 pt-4 border-t">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{settings.currency}{calculateSubtotal.toFixed(2)}</span>
                    </div>
                    {settings.taxPercentage > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Tax ({settings.taxPercentage}%):</span>
                        <span>{settings.currency}{((calculateSubtotal * settings.taxPercentage) / 100).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total:</span>
                      <span>{settings.currency}{calculateTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {cart.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Checkout</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customer-name">Customer Name</Label>
                  <Input
                    id="customer-name"
                    placeholder="Enter customer name (optional)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer-phone">Phone Number</Label>
                  <Input
                    id="customer-phone"
                    placeholder="Enter phone number (optional)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment-method">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={processSale} 
                    disabled={loading}
                    className="flex-1"
                  >
                    <Receipt className="mr-2 h-4 w-4" />
                    {loading ? 'Processing...' : 'Complete Sale'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={printBill}
                    disabled={cart.length === 0}
                  >
                    Print Bill
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarcodeScannerInterface;