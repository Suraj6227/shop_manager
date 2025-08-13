import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Profile {
  id: string;
  role: 'owner' | 'employee';
  full_name: string;
  username: string;
}

// Hardcoded users
const USERS = {
  'Saurabh': { password: 'saurabh89', role: 'owner' as const, full_name: 'Saurabh' },
  'employee': { password: '12345', role: 'employee' as const, full_name: 'Employee' }
};

export const useAuth = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session in localStorage
    try {
      const savedUser = localStorage.getItem('masala_shop_user');
      if (savedUser) {
        setProfile(JSON.parse(savedUser));
      }
    } catch (error) {
      console.error('Error loading saved user:', error);
      localStorage.removeItem('masala_shop_user');
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = async (username: string, password: string) => {
    const user = USERS[username as keyof typeof USERS];
    
    if (!user || user.password !== password) {
      return { 
        data: null, 
        error: { message: 'Invalid username or password' } 
      };
    }

    const profile: Profile = {
      id: username,
      role: user.role,
      full_name: user.full_name,
      username: username
    };

    setProfile(profile);
    localStorage.setItem('masala_shop_user', JSON.stringify(profile));
    
    return { data: { user: profile }, error: null };
  };

  const signOut = async () => {
    setProfile(null);
    localStorage.removeItem('masala_shop_user');
    navigate('/auth');
    return { error: null };
  };

  const isOwner = profile?.role === 'owner';
  const isEmployee = profile?.role === 'employee';

  return {
    user: profile,
    session: profile ? { user: profile } : null,
    profile,
    loading,
    signIn,
    signOut,
    isOwner,
    isEmployee,
    isAuthenticated: !!profile,
  };
};