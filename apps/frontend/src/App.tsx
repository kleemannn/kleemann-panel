import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { useTelegramLogin } from '@/hooks/useTelegramLogin';
import { BottomNav } from '@/components/BottomNav';

import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Clients } from '@/pages/Clients';
import { ClientDetails } from '@/pages/ClientDetails';
import { CreateClient } from '@/pages/CreateClient';
import { Extend } from '@/pages/Extend';
import { History } from '@/pages/History';

import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { Resellers } from '@/pages/admin/Resellers';
import { ResellerEdit } from '@/pages/admin/ResellerEdit';
import { ResellerCreate } from '@/pages/admin/ResellerCreate';
import { Squads } from '@/pages/admin/Squads';
import { Audit } from '@/pages/admin/Audit';
import { Backup } from '@/pages/admin/Backup';

export function App() {
  const me = useAuthStore((s) => s.me);
  const accessToken = useAuthStore((s) => s.accessToken);
  const login = useTelegramLogin();

  useEffect(() => {
    if (!accessToken && window.Telegram?.WebApp?.initData && !login.isPending) {
      login.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  if (!accessToken || !me) {
    return <Login loginMutation={login} />;
  }

  const isAdmin = me.role === 'ADMIN';

  return (
    <div className="mx-auto min-h-full max-w-xl pb-24">
      <ScrollToTop />
      <Routes>
        {isAdmin ? (
          <>
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/admin/resellers" element={<Resellers />} />
            <Route path="/admin/resellers/new" element={<ResellerCreate />} />
            <Route path="/admin/resellers/:id" element={<ResellerEdit />} />
            <Route path="/admin/squads" element={<Squads />} />
            <Route path="/admin/audit" element={<Audit />} />
            <Route path="/admin/backup" element={<Backup />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/new" element={<CreateClient />} />
            <Route path="/clients/:id" element={<ClientDetails />} />
            <Route path="/clients/:id/extend" element={<Extend />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/new" element={<CreateClient />} />
            <Route path="/clients/:id" element={<ClientDetails />} />
            <Route path="/clients/:id/extend" element={<Extend />} />
            <Route path="/history" element={<History />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
      <BottomNav />
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}
