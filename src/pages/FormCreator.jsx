import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import { FolderOpen } from "lucide-react";

export default function FormCreator() {
  return (
    <div className="min-h-screen">
      <PageHeader 
        title="Form & Resource Creator" 
        description="Create and manage detachment forms and resources"
        icon={FolderOpen}
      />
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>This feature is currently in development</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Create custom forms and upload detachment resources.</p>
        </CardContent>
      </Card>
    </div>
  );
}