
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ModuleCardProps = {
  title: string;
  description: string;
  status: "MVP" | "Future";
  icon: LucideIcon;
};

export function ModuleCard({
  title,
  description,
  status,
  icon: Icon,
}: ModuleCardProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-5 w-5" />
          </div>

          <Badge
            variant={status === "MVP" ? "secondary" : "outline"}
          >
            {status}
          </Badge>
        </div>

        <CardTitle>{title}</CardTitle>

        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
