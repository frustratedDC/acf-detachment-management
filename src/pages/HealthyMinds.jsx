import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import { Brain } from "lucide-react";

export default function HealthyMinds() {
  return (
    <div className="min-h-screen">
      <PageHeader 
        title="Healthy Minds" 
        description="Mental health resources and support"
        icon={Brain}
      />
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>This feature is currently in development</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Access mental health resources and wellbeing support.</p>
        </CardContent>
      </Card>
    </div>
  );
}