import { useEffect, useState } from "react";
import { AppProvider } from "./store";
import { StaffAccess } from "./StaffAccess";
import { PatientPortal } from "./pages/Patient";
import { PublicEmailEnquiry } from "./pages/EmailValidation";
import { StaffWorkspace } from "./pages/StaffWorkspace";

export default function App() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const change = () => setHash(window.location.hash);
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  if (hash.startsWith("#staff"))
    return (
      <StaffAccess>
        <StaffWorkspace />
      </StaffAccess>
    );
  if (hash.startsWith("#enquire")) return <PublicEmailEnquiry />;
  return (
    <AppProvider>
      <PatientPortal />
    </AppProvider>
  );
}
