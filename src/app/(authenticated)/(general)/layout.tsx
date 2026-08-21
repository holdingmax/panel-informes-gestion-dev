import { MainBackground } from "../../MainBackground";

export default function GeneralLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen w-full">
      <MainBackground />
      {children}
    </div>
  );
}
