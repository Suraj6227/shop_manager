// Barcode generator for products
import { useState } from 'react';
import { Barcode } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Product {
  id: string;
  name: string;
  price: number;
  barcode?: string;
}

interface BarcodeGeneratorProps {
  products: Product[];
  onUpdate: () => void;
}

const BarcodeGenerator = ({ products, onUpdate }: BarcodeGeneratorProps) => {
  const [generating, setGenerating] = useState<string | null>(null);
  const { toast } = useToast();

  const generateBarcode = (productId: string) => {
    return `MSP${productId.replace(/-/g, '').substring(0, 8).toUpperCase()}`;
  };

  const updateProductBarcode = async (product: Product) => {
    setGenerating(product.id);
    const barcode = generateBarcode(product.id);
    
    try {
      const { error } = await supabase
        .from('products')
        .update({ barcode })
        .eq('id', product.id);

      if (error) throw error;

      toast({
        title: "Barcode Generated",
        description: `Barcode generated for ${product.name}`,
      });

      onUpdate();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate barcode",
        variant: "destructive",
      });
    } finally {
      setGenerating(null);
    }
  };

  const generateBarcodePNG = async (product: Product) => {
    try {
      const barcodeValue = product.barcode || generateBarcode(product.id);
      
      // Create a canvas element
      const canvas = document.createElement('canvas');
      
      // Generate barcode on canvas
      JsBarcode(canvas, barcodeValue, {
        format: "CODE128",
        width: 2,
        height: 100,
        displayValue: true,
        fontSize: 14,
        margin: 10
      });

      // Convert canvas to download link
      const dataURL = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataURL;
      link.download = `barcode-${product.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Barcode Downloaded",
        description: `Barcode for ${product.name} has been downloaded`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate barcode",
        variant: "destructive",
      });
    }
  };

  const productsWithoutBarcodes = products.filter(p => !p.barcode);

  if (productsWithoutBarcodes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Barcode className="h-5 w-5" />
            Barcode Generator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">All products have barcodes! You can generate barcode images from the main inventory.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Barcode className="h-5 w-5" />
          Generate Barcodes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {productsWithoutBarcodes.length} products need barcodes before you can scan them.
          </p>
          
          <div className="space-y-2">
            {productsWithoutBarcodes.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <h4 className="font-medium">{product.name}</h4>
                  <p className="text-sm text-muted-foreground">₹{product.price}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => updateProductBarcode(product)}
                    disabled={generating === product.id}
                  >
                    {generating === product.id ? 'Generating...' : 'Generate Barcode'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateBarcodePNG(product)}
                  >
                    <Barcode className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BarcodeGenerator;