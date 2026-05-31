import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import { GraduationCap } from "lucide-react";

export default function MyQualifications() {
  return (
    <div className="min-h-screen">
      <PageHeader 
        title="My Qualifications" 
        description="Your training and qualifications record"
        icon={GraduationCap}
      />
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>This feature is currently in development</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">View your teaching qualifications and certifications.</p>
        </CardContent>
      </Card>
    </div>
  );
}