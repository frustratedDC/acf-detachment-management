import React from 'react';

// RBAC removed — sole admin user, all access granted unconditionally.
export default function AccessGate({ children }) {
  return <>{children}</>;
}