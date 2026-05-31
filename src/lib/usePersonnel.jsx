import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const PersonnelContext = createContext(null);

export function PersonnelProvider({ children }) {
  const [personnel, setPersonnel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsLinking, setNeedsLinking] = useState(false);
  const [viewAs, setViewAsState] = useState(null);

  useEffect(() => {
    checkPersonnel();
  }, []);

  async function checkPersonnel() {
    setLoading(true);
    const user = await base44.auth.me();
    if (!user) {
      setLoading(false);
      return;
    }
    const records = await base44.entities.PersonnelManager.filter({ LinkedEmailUID: user.email });
    if (records.length > 0) {
      // DEFENSIVE FIX: Sort by created_date ascending (oldest first)
      // Ensures the original May 10 record is always selected, not the May 31 duplicate
      const sorted = records.sort((a, b) => {
        const dateA = new Date(a.created_date || 0);
        const dateB = new Date(b.created_date || 0);
        return dateA - dateB;
      });
      const authoritative = sorted[0];
      if (authoritative.IsLinked) {
        setPersonnel(authoritative);
        setNeedsLinking(false);
      } else {
        setNeedsLinking(true);
      }
    } else {
      setNeedsLinking(true);
    }
    setLoading(false);
  }

  async function linkAccount(pNumber, surname, securityCode) {
    if (securityCode !== '1992') {
      throw new Error('Invalid security code');
    }
    const matches = await base44.entities.PersonnelManager.filter({ PNumber: pNumber });
    if (matches.length === 0) {
      throw new Error('PNumber not found');
    }
    // DEFENSIVE FIX: Sort by created_date ascending (oldest first)
    const sorted = matches.sort((a, b) => {
      const dateA = new Date(a.created_date || 0);
      const dateB = new Date(b.created_date || 0);
      return dateA - dateB;
    });
    const record = sorted[0];
    if (record.Surname.toLowerCase() !== surname.toLowerCase()) {
      throw new Error('Surname does not match');
    }
    if (record.IsLinked) {
      throw new Error('This PNumber is already linked to another account');
    }
    const user = await base44.auth.me();
    await base44.entities.PersonnelManager.update(record.id, {
      IsLinked: true,
      LinkedEmailUID: user.email,
    });
    const updated = await base44.entities.PersonnelManager.filter({ PNumber: pNumber });
    const updatedSorted = updated.sort((a, b) => {
      const dateA = new Date(a.created_date || 0);
      const dateB = new Date(b.created_date || 0);
      return dateA - dateB;
    });
    setPersonnel(updatedSorted[0]);
    setNeedsLinking(false);
    return updatedSorted[0];
  }

  const setViewAs = useCallback((person) => { setViewAsState(person); }, []);
  const effectivePersonnel = viewAs || personnel;

  return (
    <PersonnelContext.Provider value={{ personnel: effectivePersonnel, realPersonnel: personnel, viewAs, setViewAs, loading, needsLinking, linkAccount, refresh: checkPersonnel }}>
      {children}
    </PersonnelContext.Provider>
  );
}

export function usePersonnel() {
  const ctx = useContext(PersonnelContext);
  if (!ctx) throw new Error('usePersonnel must be used within PersonnelProvider');
  return ctx;
}