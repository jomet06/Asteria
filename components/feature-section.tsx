
import { ModuleCard } from "@/components/module-card";

import type { FeatureDefinition } from "@/features/types";

type FeatureSectionProps = {
  title: string;
  description: string;
  features: FeatureDefinition[];
};

export function FeatureSection({
  title,
  description,
  features,
}: FeatureSectionProps) {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-16">
      <div className="mb-8">
        <h2 className="text-3xl font-semibold tracking-tight">
          {title}
        </h2>

        <p className="mt-2 text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <ModuleCard
            key={feature.id}
            title={feature.title}
            description={feature.description}
            status={feature.status}
            icon={feature.icon}
          />
        ))}
      </div>
    </section>
  );
}
