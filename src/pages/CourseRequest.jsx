import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import { BookOpen } from "lucide-react";

export default function CourseRequest() {
  return (
    <div className="min-h-screen">
      <PageHeader 
        title="Course Request" 
        description="Request attendance at training courses"
        icon={BookOpen}
      />
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>This feature is currently in development</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Submit course enrollment and training requests.</p>
        </CardContent>
      </Card>
    </div>
  );
}