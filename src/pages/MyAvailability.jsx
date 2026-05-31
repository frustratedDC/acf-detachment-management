import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import { CalendarCheck } from "lucide-react";

export default function MyAvailability() {
  return (
    <div className="min-h-screen">
      <PageHeader 
        title="My Availability" 
        description="Manage your training night availability"
        icon={CalendarCheck}
      />
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>This feature is currently in development</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Submit your availability for upcoming training sessions.</p>
        </CardContent>
      </Card>
    </div>
  );
}