import { typography } from "@/lib/ui/styles";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
};

export function PageHeader({ eyebrow, title, subtitle }: PageHeaderProps) {
  return (
    <header className="mb-6">
      <p className={typography.eyebrow}>{eyebrow}</p>
      <h1 className={typography.pageTitle}>{title}</h1>
      {subtitle ? <p className={typography.pageSubtitle}>{subtitle}</p> : null}
    </header>
  );
}
