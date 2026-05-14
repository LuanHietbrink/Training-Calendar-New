import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import LoginPage from "./auth/LoginPage";
import Layout from "./components/Layout";
import TrainingTab from "./features/training/TrainingTab";
import SpeedTab from "./features/speed/SpeedTab";
import WeightTab from "./features/weight/WeightTab";

function Protected() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }
  if (!session) return <LoginPage />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/training" replace />} />
        <Route path="/training" element={<TrainingTab />} />
        <Route path="/speed" element={<SpeedTab />} />
        <Route path="/weight" element={<WeightTab />} />
        <Route path="*" element={<Navigate to="/training" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Protected />
    </AuthProvider>
  );
}
