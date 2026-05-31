import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import { Shield } from "lucide-react";

export default function Accounts() {
  return (
    <div className="min-h-screen">
      <PageHeader 
        title="Accounts" 
        description="Manage user accounts and access levels"
        icon={Shield}
      />
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>This feature is currently in development</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Manage detachment user accounts and access control.</p>
        </CardContent>
      </Card>
    </div>
  );
}