import React, { createContext, useContext } from 'react';

interface AdminUiContextValue {
  isAdmin: boolean;
}

const AdminUiContext = createContext<AdminUiContextValue>({ isAdmin: false });

export function AdminUiProvider({
  isAdmin,
  children,
}: {
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  return (
    <AdminUiContext.Provider value={{ isAdmin }}>
      {children}
    </AdminUiContext.Provider>
  );
}

export function useAdminUi() {
  return useContext(AdminUiContext);
}

export function getAdminRoleTip(isAdmin: boolean, role: string, _detail?: React.ReactNode) {
  if (!isAdmin) return undefined;
  return role;
}
