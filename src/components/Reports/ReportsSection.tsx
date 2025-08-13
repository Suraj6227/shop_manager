import { useState, useEffect } from 'react';
import { Download, Calendar, TrendingUp, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SaleItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  products: {
    name: string;
    price: number;
  };
}

interface Sale {
  id: string;
  sale_number: string;
  total_amount: number;
  created_at: string;
  customer_name: string | null;
  payment_method: string;
  sale_items: SaleItem[];
}

interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  avgSaleAmount: number;
  topPaymentMethod: string;
}

const ReportsSection = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState<SalesStats>({
    totalSales: 0,
    totalRevenue: 0,
    avgSaleAmount: 0,
    topPaymentMethod: 'cash'
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { isOwner } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    // Set default dates (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    
    fetchSalesData(thirtyDaysAgo.toISOString(), today.toISOString());
  }, []);

  const fetchSalesData = async (start?: string, end?: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from('sales')
        .select(`
          *,
          sale_items (
            id,
            product_id,
            quantity,
            unit_price,
            total_price,
            products (
              name,
              price
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (start) {
        query = query.gte('created_at', start);
      }
      if (end) {
        query = query.lte('created_at', end);
      }

      const { data, error } = await query;

      if (error) throw error;

      setSales(data || []);
      calculateStats(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch sales data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (salesData: Sale[]) => {
    const totalSales = salesData.length;
    const totalRevenue = salesData.reduce((sum, sale) => sum + sale.total_amount, 0);
    const avgSaleAmount = totalSales > 0 ? totalRevenue / totalSales : 0;
    
    // Find most common payment method
    const paymentMethods = salesData.reduce((acc, sale) => {
      acc[sale.payment_method] = (acc[sale.payment_method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topPaymentMethod = Object.keys(paymentMethods).reduce((a, b) => 
      paymentMethods[a] > paymentMethods[b] ? a : b, 'cash'
    );

    setStats({
      totalSales,
      totalRevenue,
      avgSaleAmount,
      topPaymentMethod
    });
  };

  const handleDateFilter = () => {
    if (startDate && endDate) {
      const start = new Date(startDate).toISOString();
      const end = new Date(endDate + 'T23:59:59').toISOString();
      fetchSalesData(start, end);
    }
  };

  const downloadCSV = () => {
    if (sales.length === 0) {
      toast({
        title: "No Data",
        description: "No sales data to export",
        variant: "destructive",
      });
      return;
    }

    const headers = ['Sale Number', 'Date', 'Customer', 'Product Name', 'Quantity', 'Unit Price', 'Total Price', 'Payment Method'];
    const rows: string[] = [];
    
    sales.forEach(sale => {
      if (sale.sale_items && sale.sale_items.length > 0) {
        sale.sale_items.forEach(item => {
          rows.push([
            sale.sale_number,
            new Date(sale.created_at).toLocaleDateString(),
            sale.customer_name || 'Walk-in Customer',
            item.products?.name || 'Unknown Product',
            item.quantity.toString(),
            `₹${item.unit_price}`,
            `₹${item.total_price}`,
            sale.payment_method.toUpperCase()
          ].join(','));
        });
      } else {
        rows.push([
          sale.sale_number,
          new Date(sale.created_at).toLocaleDateString(),
          sale.customer_name || 'Walk-in Customer',
          'No items',
          '0',
          '₹0',
          `₹${sale.total_amount}`,
          sale.payment_method.toUpperCase()
        ].join(','));
      }
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `detailed-sales-report-${startDate}-to-${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Detailed sales report downloaded successfully",
    });
  };

  const deleteSale = async (saleId: string) => {
    if (!isOwner) {
      toast({
        title: "Access Denied",
        description: "Only owners can delete sales records",
        variant: "destructive",
      });
      return;
    }

    try {
      // Delete sale items first
      await supabase
        .from('sale_items')
        .delete()
        .eq('sale_id', saleId);

      // Then delete the sale
      const { error } = await supabase
        .from('sales')
        .delete()
        .eq('id', saleId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Sale deleted successfully",
      });
      
      // Refresh data
      if (startDate && endDate) {
        handleDateFilter();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete sale",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-primary">Sales Reports</h1>
        <Button onClick={downloadCSV} disabled={loading || sales.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Download CSV
        </Button>
      </div>

      {/* Date Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Date Range Report</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <Button onClick={handleDateFilter} disabled={loading}>
                <Calendar className="mr-2 h-4 w-4" />
                Filter Range
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div>
                <Label htmlFor="dailyDate">Select Date</Label>
                <Input
                  id="dailyDate"
                  type="date"
                  onChange={(e) => {
                    const selectedDate = e.target.value;
                    if (selectedDate) {
                      const start = new Date(selectedDate).toISOString();
                      const end = new Date(selectedDate + 'T23:59:59').toISOString();
                      fetchSalesData(start, end);
                    }
                  }}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                Select a date to view daily sales report
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold">{stats.totalSales}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">₹{stats.totalRevenue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                <span className="text-sm font-bold">₹</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Avg Sale</p>
                <p className="text-2xl font-bold">₹{stats.avgSaleAmount.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                <span className="text-xs font-bold">💳</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Top Payment</p>
                <p className="text-2xl font-bold capitalize">{stats.topPaymentMethod}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sales</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : sales.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No sales found for the selected period</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Sale #</th>
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Customer</th>
                    <th className="text-left p-2">Products</th>
                    <th className="text-left p-2">Total Amount</th>
                    <th className="text-left p-2">Payment</th>
                    {isOwner && <th className="text-left p-2">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-mono text-sm">{sale.sale_number}</td>
                      <td className="p-2">
                        {new Date(sale.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-2">{sale.customer_name || 'Walk-in'}</td>
                      <td className="p-2">
                        {sale.sale_items && sale.sale_items.length > 0 ? (
                          <div className="space-y-1">
                            {sale.sale_items.map((item, index) => (
                              <div key={item.id} className="text-sm">
                                <span className="font-medium">{item.products?.name || 'Unknown'}</span>
                                <span className="text-muted-foreground ml-2">
                                  ({item.quantity} × ₹{item.unit_price} = ₹{item.total_price})
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No items</span>
                        )}
                      </td>
                      <td className="p-2 font-semibold">₹{sale.total_amount.toFixed(2)}</td>
                      <td className="p-2 capitalize">{sale.payment_method}</td>
                      {isOwner && (
                        <td className="p-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteSale(sale.id)}
                          >
                            Delete
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsSection;
