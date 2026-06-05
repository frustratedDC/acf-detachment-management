import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const PersonnelContext = createContext(null);

export function PersonnelProvider({ children }) {
  const [personnel, setPersonnel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewAs, setViewAsState] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPersonnel();
  }, []);

  async function loadPersonnel() {
    try {
      setLoading(true);
      setError(null);
      
      // Sole admin user — grab the first (oldest) linked record
      const records = await base44.entities.PersonnelManager.filter({ IsLinked: true });
      
      if (records && records.length > 0) {
        const sorted = records.sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));
        setPersonnel(sorted[0]);
      } else {
        setPersonnel(null);
      }
    } catch (err) {
      console.error('Failed to load personnel:', err);
      setPersonnel(null);
      setError(err?.message || 'Failed to load personnel data');
    } finally {
      setLoading(false);
    }
  }

  const setViewAs = useCallback((person) => { setViewAsState(person); }, []);
  const effectivePersonnel = viewAs || personnel;

  return (
    <PersonnelContext.Provider value={{ personnel: effectivePersonnel, realPersonnel: personnel, viewAs, setViewAs, loading, error, needsLinking: false, refresh: loadPersonnel }}>
      {children}
    </PersonnelContext.Provider>
  );
}

export function usePersonnel() {
  const ctx = useContext(PersonnelContext);
  if (!ctx) throw new Error('usePersonnel must be used within PersonnelProvider');
  return ctx;
}