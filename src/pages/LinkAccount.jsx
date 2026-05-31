import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Shield, Lock, User, Hash, AlertCircle, ShieldCheck } from 'lucide-react';
import { usePersonnel } from '@/lib/usePersonnel';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';

export default function LinkAccount() {
  const { linkAccount, refresh } = usePersonnel();
  const [pNumber, setPNumber] = useState('');
  const [surname, setSurname] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Bootstrap mode: no personnel records exist at all
  const [noRecords, setNoRecords] = useState(false);
  const [bootstrapMode, setBootstrapMode] = useState(false);
  const [bsForm, setBsForm] = useState({ PNumber: '', FirstName: '', Surname: '', Rank: '' });
  const [bsLoading, setBsLoading] = useState(false);

  useEffect(() => {
    base44.entities.PersonnelManager.list('created_date', 1).then(records => {
      if (records.length === 0) setNoRecords(true);
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await linkAccount(pNumber.trim(), surname.trim(), securityCode.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleBootstrap(e) {
    e.preventDefault();
    setBsLoading(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.PersonnelManager.create({
        PNumber: bsForm.PNumber.trim(),
        FirstName: bsForm.FirstName.trim(),
        Surname: bsForm.Surname.trim(),
        Rank: bsForm.Rank.trim(),
        Type: 'Adult Instructor',
        AccessLevel: 6,
        RoleName: 'System Administrator',
        PersonnelStatus: 'Active',
        IsLinked: true,
        LinkedEmailUID: user.email,
      });
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">ACF Training Manager</h1>
          <p className="text-muted-foreground mt-1">Link your account to continue</p>
        </div>

        {/* Bootstrap panel — only shown when no personnel records exist */}
        {noRecords && !bootstrapMode && (
          <div className="mb-4 p-4 rounded-xl border border-accent/40 bg-accent/5 text-sm">
            <p className="font-semibold text-foreground mb-1 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent" />First-time setup detected
            </p>
            <p className="text-muted-foreground text-xs mb-3">No personnel records exist yet. Create your administrator account to get started.</p>
            <Button size="sm" className="w-full" onClick={() => setBootstrapMode(true)}>
              Create Admin Account
            </Button>
          </div>
        )}

        {bootstrapMode && (
          <Card className="shadow-lg border-accent/40 mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-accent" />Create Administrator Account
              </CardTitle>
              <CardDescription>This will create a Level 6 System Administrator record linked to your login.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBootstrap} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>PNumber *</Label>
                    <Input value={bsForm.PNumber} onChange={e => setBsForm(p => ({...p, PNumber: e.target.value}))} placeholder="e.g. P123456" className="mt-1" required />
                  </div>
                  <div>
                    <Label>Rank</Label>
                    <Input value={bsForm.Rank} onChange={e => setBsForm(p => ({...p, Rank: e.target.value}))} placeholder="e.g. Maj" className="mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>First Name</Label>
                    <Input value={bsForm.FirstName} onChange={e => setBsForm(p => ({...p, FirstName: e.target.value}))} placeholder="First name" className="mt-1" />
                  </div>
                  <div>
                    <Label>Surname *</Label>
                    <Input value={bsForm.Surname} onChange={e => setBsForm(p => ({...p, Surname: e.target.value}))} placeholder="Surname" className="mt-1" required />
                  </div>
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4 shrink-0" />{error}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => { setBootstrapMode(false); setError(''); }}>Back</Button>
                  <Button type="submit" className="flex-1" disabled={bsLoading || !bsForm.PNumber || !bsForm.Surname}>
                    {bsLoading ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : 'Create & Enter'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-lg border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="w-4 h-4 text-accent" />
              Account Verification
            </CardTitle>
            <CardDescription>
              Enter your personnel details and security code to link your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pnumber">PNumber</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="pnumber"
                    placeholder="Enter your PNumber"
                    value={pNumber}
                    onChange={(e) => setPNumber(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="surname">Surname</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="surname"
                    placeholder="Enter your surname"
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Security Code</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="code"
                    type="password"
                    placeholder="Enter security code"
                    value={securityCode}
                    onChange={(e) => setSecurityCode(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  'Link Account'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}