import { useState, useEffect } from 'react';
import { Save, Store, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Settings {
  tax_percentage: string;
  store_name: string;
  currency: string;
}

const SettingsSection = () => {
  const [settings, setSettings] = useState<Settings>({
    tax_percentage: '18.0',
    store_name: 'Krushnkamal Masale',
    currency: 'INR'
  });
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  
  const { isOwner, profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('store_settings')
        .select('key, value')
        .in('key', ['tax_percentage', 'store_name', 'currency']);

      if (error) throw error;

      if (data) {
        const settingsObj: any = data.reduce((acc, item) => ({
          ...acc,
          [item.key]: item.value
        }), {});
        
        setSettings({
          tax_percentage: settingsObj.tax_percentage || '18.0',
          store_name: settingsObj.store_name || 'Masala Shop',
          currency: settingsObj.currency || 'INR'
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!isOwner) {
      toast({
        title: "Access Denied",
        description: "Only owners can update settings",
        variant: "destructive",
      });
      return;
    }

    setSaveLoading(true);
    try {
      // Validate tax percentage
      const taxPercentage = parseFloat(settings.tax_percentage);
      if (isNaN(taxPercentage) || taxPercentage < 0 || taxPercentage > 100) {
        toast({
          title: "Invalid Input",
          description: "Tax percentage must be between 0 and 100",
          variant: "destructive",
        });
        return;
      }

      // Update each setting
      for (const [key, value] of Object.entries(settings)) {
        const { error } = await supabase
          .from('store_settings')
          .upsert({
            key,
            value: value.toString(),
            updated_by: profile?.id
          });

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Settings updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleInputChange = (key: keyof Settings, value: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-primary">Settings</h1>
        {isOwner && (
          <Button onClick={saveSettings} disabled={saveLoading}>
            <Save className="mr-2 h-4 w-4" />
            {saveLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </div>

      {!isOwner && (
        <div className="mb-6 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            You are logged in as an employee. Only owners can modify settings.
          </p>
        </div>
      )}

      {/* Store Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Store className="mr-2 h-5 w-5" />
            Store Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="storeName">Store Name</Label>
            <Input
              id="storeName"
              value={settings.store_name}
              onChange={(e) => handleInputChange('store_name', e.target.value)}
              disabled={!isOwner}
              placeholder="Enter store name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select 
              value={settings.currency} 
              onValueChange={(value) => handleInputChange('currency', value)}
              disabled={!isOwner}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">Indian Rupee (₹)</SelectItem>
                <SelectItem value="USD">US Dollar ($)</SelectItem>
                <SelectItem value="EUR">Euro (€)</SelectItem>
                <SelectItem value="GBP">British Pound (£)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tax Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Percent className="mr-2 h-5 w-5" />
            Tax Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="taxPercentage">Tax Percentage (%)</Label>
            <Input
              id="taxPercentage"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={settings.tax_percentage}
              onChange={(e) => handleInputChange('tax_percentage', e.target.value)}
              disabled={!isOwner}
              placeholder="Enter tax percentage"
            />
            <p className="text-xs text-muted-foreground">
              This tax rate will be applied to all sales transactions.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* User Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Full Name</Label>
              <Input value={profile?.full_name || ''} disabled />
            </div>
            <div>
              <Label>Username</Label>
              <Input value={profile?.username || ''} disabled />
            </div>
            <div>
              <Label>Role</Label>
              <Input value={profile?.role === 'owner' ? 'Owner' : 'Employee'} disabled />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsSection;