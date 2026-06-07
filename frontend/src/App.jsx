import { Routes, Route, Navigate } from 'react-router-dom';
import Nav             from './components/Nav';
import Dashboard       from './pages/Dashboard';
import Players         from './pages/Players';
import Teams           from './pages/Teams';
import Courts          from './pages/Courts';
import Tournaments     from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';

export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9' }}>
      <Nav />
      <Routes>
        <Route path="/"                    element={<Dashboard />} />
        <Route path="/players"             element={<Players />} />
        <Route path="/teams"               element={<Teams />} />
        <Route path="/courts"              element={<Courts />} />
        <Route path="/tournaments"         element={<Tournaments />} />
        <Route path="/tournaments/:id"     element={<TournamentDetail />} />
        <Route path="*"                    element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
