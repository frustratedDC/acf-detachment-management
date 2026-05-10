import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { PersonnelProvider, usePersonnel } from '@/lib/usePersonnel';

// Layout
import AppLayout from '@/components/layout/AppLayout';

// Pages
import LinkAccount from '@/pages/LinkAccount';
import Dashboard from '@/pages/Dashboard';
import ParadeState from '@/pages/ParadeState';
import LessonAttendance from '@/pages/LessonAttendance';
import TrainingSchedule from '@/pages/TrainingSchedule';
import SyllabusMaster from '@/pages/SyllabusMaster';
import PersonalSyllabus from '@/pages/PersonalSyllabus';
import ProgressMatrix from '@/pages/ProgressMatrix';
import TaskList from '@/pages/TaskList';
import TrainingManager from '@/pages/TrainingManager';
import Personnel from '@/pages/Personnel';
import AdminControls from '@/pages/AdminControls';
import HelpWiki from '@/pages/HelpWiki';
import TrainingPlanExport from '@/pages/TrainingPlanExport';

const AppContent = () => {
  const { personnel, loading, needsLinking } = usePersonnel();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (needsLinking) {
    return <LinkAccount />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/parade" element={<ParadeState />} />
        <Route path="/attendance" element={<LessonAttendance />} />
        <Route path="/schedule" element={<TrainingSchedule />} />
        <Route path="/syllabus" element={<SyllabusMaster />} />
        <Route path="/personal-syllabus" element={<PersonalSyllabus />} />
        <Route path="/progress" element={<ProgressMatrix />} />
        <Route path="/tasks" element={<TaskList />} />
        <Route path="/training-manager" element={<TrainingManager />} />
        <Route path="/personnel" element={<Personnel />} />
        <Route path="/admin" element={<AdminControls />} />
        <Route path="/training-plan-export" element={<TrainingPlanExport />} />
        <Route path="/help" element={<HelpWiki />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <PersonnelProvider>
      <AppContent />
    </PersonnelProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App