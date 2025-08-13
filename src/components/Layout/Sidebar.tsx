import { useState, useCallback } from 'react';
import { 
  Package, 
  ShoppingCart, 
  Scan,
  BarChart3, 
  Settings,
  LogOut,
  Menu,
  X 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { signOut, profile, isOwner } = useAuth();
  const { toast } = useToast();

  const handleSignOut = useCallback(async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed out",
        description: "You have been signed out successfully",
      });
    }
  }, [signOut, toast]);

  const menuItems = [
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'sales', label: 'Sales', icon: ShoppingCart },
    { id: 'scanner', label: 'Barcode Scanner', icon: Scan },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-primary">🏪 Masala Shop</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {profile?.full_name} ({isOwner ? 'Owner' : 'Employee'})
        </p>
      </div>

      <nav className="flex-1 px-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.id}
              variant={activeTab === item.id ? 'default' : 'ghost'}
              className="w-full justify-start mb-2"
              onClick={() => {
                onTabChange(item.id);
                setIsMobileOpen(false);
              }}
            >
              <Icon className="mr-3 h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="mr-3 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="outline"
        size="icon"
        className="lg:hidden fixed top-4 left-4 z-50"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-card border-r">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsMobileOpen(false)} />
          <div className="relative flex w-64 flex-col bg-card border-r">
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;