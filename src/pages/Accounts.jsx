import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import AccessGate from "@/components/shared/AccessGate";
import { BookOpen } from "lucide-react";
import { ACCESS_LEVELS } from "@/lib/accessLevels";

export default function Accounts() {
  return (
    <AccessGate level={ACCESS_LEVELS.DET_2IC}>
    <div className="min-h-screen">
      <PageHeader title="Accounts" description="Detachment financial management" icon={BookOpen} />
      <Card>
        <CardHeader>
          <CardTitle>Detachment Cash & Bank Ledger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">Double-entry cash and bank ledger with running balances, voucher generation, and CSV export.</p>
          <Button asChild>
            <Link to="/accounts-ledger">Open Accounts Ledger</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
    </AccessGate>
  );
}