import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

// Redirect hub: lleva al usuario a su dashboard según rol
export default function Dashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/", { replace: true });
      return;
    }
    navigate("/inicio", { replace: true });
  }, [isAuthenticated, role, navigate]);

  return null;
}
