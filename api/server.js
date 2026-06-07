// ============================================================
// BADMINTON TOURNAMENT MANAGEMENT SYSTEM - API SERVER
// ============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/players',     require('./routes/players'));
app.use('/api/courts',      require('./routes/courts'));
app.use('/api/teams',       require('./routes/teams'));
app.use('/api/tournaments', require('./routes/tournaments'));
app.use('/api/matches',     require('./routes/matches'));
app.use('/api/standings',   require('./routes/standings'));

// ── Health ────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date() }));

// ── Error Handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => console.log(`🏸 Badminton API running on port ${PORT}`));
module.exports = app;
