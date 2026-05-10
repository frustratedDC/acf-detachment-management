import { useState, useEffect, createContext, useContext } from 'react';
import { base44 } from '@/api/base44Client';

const PersonnelContext = createContext(null);

export function PersonnelProvider({ children }) {
  const [personnel, setPersonnel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsLinking, setNeedsLinking] = useState(false);

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
    if (records.length > 0 && records[0].IsLinked) {
      setPersonnel(records[0]);
      setNeedsLinking(false);
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
    const record = matches[0];
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
    setPersonnel(updated[0]);
    setNeedsLinking(false);
    return updated[0];
  }

  return (
    <PersonnelContext.Provider value={{ personnel, loading, needsLinking, linkAccount, refresh: checkPersonnel }}>
      {children}
    </PersonnelContext.Provider>
  );
}

export function usePersonnel() {
  const ctx = useContext(PersonnelContext);
  if (!ctx) throw new Error('usePersonnel must be used within PersonnelProvider');
  return ctx;
}