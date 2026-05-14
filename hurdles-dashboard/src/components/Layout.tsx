import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthProvider";
import TabBar from "./TabBar";
import ExportMenu from "./ExportMenu";

export default function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight">
              400m Hurdles Dashboard
            </h1>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <ExportMenu />
            <button
              onClick={signOut}
              className="text-xs text-slate-600 hover:text-slate-900 underline"
            >
              Sign out
            </button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-3">
          <TabBar />
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}
