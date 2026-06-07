const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

// GET all players
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, 
        COALESCE(json_agg(json_build_object('team_id',tm.team_id,'team_name',t.name,'role',tm.role)) 
          FILTER (WHERE tm.team_id IS NOT NULL), '[]') AS teams
       FROM players p
       LEFT JOIN team_members tm ON tm.player_id = p.id
       LEFT JOIN teams t ON t.id = tm.team_id
       WHERE p.active = true
       GROUP BY p.id
       ORDER BY p.name`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// GET single player
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM players WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Player not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// POST create player
router.post('/', async (req, res, next) => {
  try {
    const { name, email, phone, photo_url, skill_level } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO players (name,email,phone,photo_url,skill_level) 
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, email || null, phone || null, photo_url || null, skill_level || 'intermediate']
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// PUT update player
router.put('/:id', async (req, res, next) => {
  try {
    const { name, email, phone, photo_url, skill_level } = req.body;
    const { rows } = await pool.query(
      `UPDATE players SET name=$1,email=$2,phone=$3,photo_url=$4,skill_level=$5 
       WHERE id=$6 RETURNING *`,
      [name, email || null, phone || null, photo_url || null, skill_level, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Player not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// DELETE player (soft delete)
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('UPDATE players SET active=false WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { next(e); }
});

module.exports = router;
