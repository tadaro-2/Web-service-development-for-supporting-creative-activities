import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import FeedPage from './pages/FeedPage';
import OnboardingPage from './pages/OnboardingPage';
import AdminPage from './pages/AdminPage';
import MaterialsPage from './pages/MaterialsPage';
import PublicProfilePage from './pages/PublicProfilePage';
import BookmarksPage from './pages/BookmarksPage';
import ChallengesPage from './pages/ChallengesPage';
import ChallengeDetailPage from './pages/ChallengeDetailPage';
import GenerationPage from './pages/GenerationPage';
import PalettesPage from './pages/PalettesPage.tsx';
import RequireAuth from './RequireAuth';
import RequireAdmin from './RequireAdmin';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <OnboardingPage />
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        }
      />
      <Route
        path="/feed"
        element={
          <RequireAuth>
            <FeedPage />
          </RequireAuth>
        }
      />
      <Route
        path="/bookmarks"
        element={
          <RequireAuth>
            <BookmarksPage />
          </RequireAuth>
        }
      />
      <Route
        path="/challenges"
        element={
          <RequireAuth>
            <ChallengesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/challenges/:id"
        element={
          <RequireAuth>
            <ChallengeDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/materials"
        element={
          <RequireAuth>
            <MaterialsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/generation"
        element={
          <RequireAuth>
            <GenerationPage />
          </RequireAuth>
        }
      />
      <Route
        path="/palettes"
        element={
          <RequireAuth>
            <PalettesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/u/:userId"
        element={
          <RequireAuth>
            <PublicProfilePage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
