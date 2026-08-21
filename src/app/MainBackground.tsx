export function MainBackground() {
  return (
    <>
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: "url(/fondo-menu-principal.png)" }}
      />
      <div className="fixed inset-0 -z-10 bg-white/80" />
    </>
  );
}
