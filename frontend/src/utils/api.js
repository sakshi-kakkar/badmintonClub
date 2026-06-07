import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor (add auth token if needed later)
api.interceptors.request.use(cfg => cfg, err => Promise.reject(err));

// Response interceptor
api.interceptors.response.use(
  res => res.data,
  err => {
    const msg = err.response?.data?.error || err.message || 'Network error';
    return Promise.reject(new Error(msg));
  }
);

/* ─── Players ─────────────────────────────────────────────────── */
export const getPlayers    = ()         => api.get('/players');
export const createPlayer  = (data)     => api.post('/players', data);
export const updatePlayer  = (id, data) => api.put(`/players/${id}`, data);
export const deletePlayer  = (id)       => api.delete(`/players/${id}`);

/* ─── Courts ─────────────────────────────────────────────────── */
export const getCourts     = ()         => api.get('/courts');
export const createCourt   = (data)     => api.post('/courts', data);
export const updateCourt   = (id, data) => api.put(`/courts/${id}`, data);
export const deleteCourt   = (id)       => api.delete(`/courts/${id}`);

/* ─── Teams ──────────────────────────────────────────────────── */
export const getTeams      = ()                   => api.get('/teams');
export const getTeam       = (id)                 => api.get(`/teams/${id}`);
export const createTeam    = (data)               => api.post('/teams', data);
export const updateTeam    = (id, data)           => api.put(`/teams/${id}`, data);
export const deleteTeam    = (id)                 => api.delete(`/teams/${id}`);
export const addTeamMember = (id, data)           => api.post(`/teams/${id}/members`, data);
export const removeTeamMember = (id, playerId)    => api.delete(`/teams/${id}/members/${playerId}`);

/* ─── Tournaments ────────────────────────────────────────────── */
export const getTournaments       = ()         => api.get('/tournaments');
export const getTournament        = (id)       => api.get(`/tournaments/${id}`);
export const createTournament     = (data)     => api.post('/tournaments', data);
export const updateTournament     = (id, data) => api.put(`/tournaments/${id}`, data);
export const deleteTournament     = (id)       => api.delete(`/tournaments/${id}`);
export const addTournamentTeams   = (id, data) => api.post(`/tournaments/${id}/teams`, data);
export const generateFixtures     = (id)       => api.post(`/tournaments/${id}/generate-fixtures`);
export const advancePlayoffs      = (id)       => api.post(`/tournaments/${id}/advance-playoffs`);

/* ─── Matches ────────────────────────────────────────────────── */
export const getMatch        = (id)         => api.get(`/matches/${id}`);
export const updateMatchScore  = (id, data) => api.put(`/matches/${id}/score`, data);
export const updateMatchStatus = (id, data) => api.put(`/matches/${id}/status`, data);
export const assignMatchCourt  = (id, data) => api.put(`/matches/${id}/court`, data);

/* ─── Standings ──────────────────────────────────────────────── */
export const getStandings = (tournamentId) => api.get(`/standings/tournament/${tournamentId}`);

export default api;
