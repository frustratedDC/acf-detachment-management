import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import { CalendarCheck } from "lucide-react";

export default function AllAvailability() {
  return (
    <div className="min-h-screen">
      <PageHeader 
        title="All Instructor Availability" 
        description="View all staff availability records"
        icon={CalendarCheck}
      />
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>This feature is currently in development</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Review instructor availability for all training sessions.</p>
        </CardContent>
      </Card>
    </div>
  );
}