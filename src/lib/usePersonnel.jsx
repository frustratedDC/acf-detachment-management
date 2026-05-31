import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const PersonnelContext = createContext(null);

export function PersonnelProvider({ children }) {
  const [personnel, setPersonnel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewAs, setViewAsState] = useState(null);

  useEffect(() => {
    loadPersonnel();
  }, []);

  async function loadPersonnel() {
    setLoading(true);
    // Sole admin user — grab the first (oldest) linked record
    const records = await base44.entities.PersonnelManager.filter({ IsLinked: true });
    if (records.length > 0) {
      const sorted = records.sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));
      setPersonnel(sorted[0]);
    }
    setLoading(false);
  }

  const setViewAs = useCallback((person) => { setViewAsState(person); }, []);
  const effectivePersonnel = viewAs || personnel;

  return (
    <PersonnelContext.Provider value={{ personnel: effectivePersonnel, realPersonnel: personnel, viewAs, setViewAs, loading, needsLinking: false, refresh: loadPersonnel }}>
      {children}
    </PersonnelContext.Provider>
  );
}

export function usePersonnel() {
  const ctx = useContext(PersonnelContext);
  if (!ctx) throw new Error('usePersonnel must be used within PersonnelProvider');
  return ctx;
}