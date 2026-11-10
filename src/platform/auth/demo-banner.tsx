export const DEMO_BANNER_TEXT = "Demo sign-in. Replace with OIDC (Okta or Entra ID) in production";

export function DemoBanner() {
  return (
    <div role="note" className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900">
      {DEMO_BANNER_TEXT}
    </div>
  );
}
