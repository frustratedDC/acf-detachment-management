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

      // Resolve the actual logged-in user, then find THEIR linked personnel record only —
      // never just "the first linked record" (that leaked other tenants' identities).
      const authUser = await base44.auth.me();
      const records = await base44.entities.PersonnelManager.filter({ LinkedEmailUID: authUser.email });

      if (records && records.length > 0) {
        // Single-user mode: grant full access (L6) regardless of stored role
        const record = { ...records[0], AccessLevel: 6 };
        setPersonnel(record);
      } else {
        // No personnel record — still grant full access as the single authorised user
        setPersonnel({ AccessLevel: 6, DetachmentID: 'LEIGH', FirstName: '', Surname: '', PNumber: '' });
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