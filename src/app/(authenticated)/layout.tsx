import { TopBar } from "../TopBar";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TopBar />
      {children}
    </>
  );
}
