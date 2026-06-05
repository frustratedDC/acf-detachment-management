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
import TrainingCalendar from '@/pages/TrainingCalendar';
import BulkProgressEntry from '@/pages/BulkProgressEntry';
import CFAVGovernance from '@/pages/CFAVGovernance';
import ImportantNotices from '@/pages/ImportantNotices';
import WeaponHandlingTests from '@/pages/WeaponHandlingTests';
import StaffAvailability from '@/pages/StaffAvailability';
import InstructorQualMatrix from '@/pages/InstructorQualMatrix';
import AnalyticsDashboard from '@/pages/AnalyticsDashboard';
import TrainingPlanGenerator from '@/pages/TrainingPlanGenerator';
import KASessions from '@/pages/KASessions';
import KeepingActiveTracker from '@/pages/KeepingActiveTracker';
import KASessionForm from '@/pages/KASessionForm';
import KALeaderboard from '@/pages/KALeaderboard';
import MyProgress from '@/pages/MyProgress';
import FormsResources from '@/pages/FormsResources';
import MyGovernance from '@/pages/MyGovernance';
import MyAvailability from '@/pages/MyAvailability';
import MyQualifications from '@/pages/MyQualifications';
import Accounts from '@/pages/Accounts';
import AccountsLedger from '@/pages/AccountsLedger';
import AllAvailability from '@/pages/AllAvailability';
import FormCreator from '@/pages/FormCreator';
import UniformExchange from '@/pages/UniformExchange';
import CourseRequest from '@/pages/CourseRequest';
import ReportIssue from '@/pages/ReportIssue';
import HealthyMinds from '@/pages/HealthyMinds';
import CommunityEngagement from '@/pages/CommunityEngagement';
import InstructorEngagement from '@/pages/InstructorEngagement';

const AppContent = () => {
  const { personnel, loading } = usePersonnel();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
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
        <Route path="/calendar" element={<TrainingCalendar />} />
        <Route path="/training-calendar" element={<TrainingCalendar />} />
        <Route path="/bulk-progress" element={<BulkProgressEntry />} />
        <Route path="/cfav-governance" element={<CFAVGovernance />} />
        <Route path="/notices" element={<ImportantNotices />} />
        <Route path="/wht" element={<WeaponHandlingTests />} />
        <Route path="/staff-availability" element={<StaffAvailability />} />
        <Route path="/instructor-quals" element={<InstructorQualMatrix />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
        <Route path="/plan-generator" element={<TrainingPlanGenerator />} />
        <Route path="/ka-sessions" element={<KASessions />} />
        <Route path="/keeping-active" element={<KeepingActiveTracker />} />
        <Route path="/ka-session-new" element={<KASessionForm />} />
        <Route path="/ka-leaderboard" element={<KALeaderboard />} />
        <Route path="/my-progress" element={<MyProgress />} />
        <Route path="/forms-resources" element={<FormsResources />} />
        <Route path="/my-governance" element={<MyGovernance />} />
        <Route path="/my-availability" element={<MyAvailability />} />
        <Route path="/my-qualifications" element={<MyQualifications />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/accounts-ledger" element={<AccountsLedger />} />
        <Route path="/all-availability" element={<AllAvailability />} />
        <Route path="/form-creator" element={<FormCreator />} />
        <Route path="/uniform-exchange" element={<UniformExchange />} />
        <Route path="/course-request" element={<CourseRequest />} />
        <Route path="/report-issue" element={<ReportIssue />} />
        <Route path="/healthy-minds" element={<HealthyMinds />} />
        <Route path="/community-engagement" element={<CommunityEngagement />} />
        <Route path="/instructor-engagement" element={<InstructorEngagement />} />
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