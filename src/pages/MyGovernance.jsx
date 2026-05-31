import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import { ShieldCheck } from "lucide-react";

export default function MyGovernance() {
  return (
    <div className="min-h-screen">
      <PageHeader 
        title="My Governance" 
        description="Training and compliance records"
        icon={ShieldCheck}
      />
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>This feature is currently in development</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">View your governance qualifications, renewal dates, and compliance status.</p>
        </CardContent>
      </Card>
    </div>
  );
}