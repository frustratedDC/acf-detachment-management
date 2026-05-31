import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import { AlertCircle } from "lucide-react";

export default function ReportIssue() {
  return (
    <div className="min-h-screen">
      <PageHeader 
        title="Report Issue to DC" 
        description="Submit concerns to the Detachment Commander"
        icon={AlertCircle}
      />
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>This feature is currently in development</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Report issues and concerns to your Detachment Commander.</p>
        </CardContent>
      </Card>
    </div>
  );
}