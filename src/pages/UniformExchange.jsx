import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import { Shirt } from "lucide-react";

export default function UniformExchange() {
  return (
    <div className="min-h-screen">
      <PageHeader 
        title="Uniform Exchange" 
        description="Request uniform items and exchanges"
        icon={Shirt}
      />
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>This feature is currently in development</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Submit and track uniform requests and exchanges.</p>
        </CardContent>
      </Card>
    </div>
  );
}