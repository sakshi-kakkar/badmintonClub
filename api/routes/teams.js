const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
module.exports = router;

// GET all teams with members
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*,
        COALESCE(json_agg(
          json_build_object('id',p.id,'name',p.name,'photo_url',p.photo_url,'skill_level',p.skill_level,'role',tm.role)
        ) FILTER (WHERE p.id IS NOT NULL), '[]') AS members
       FROM teams t
       LEFT JOIN team_members tm ON tm.team_id = t.id
       LEFT JOIN players p ON p.id = tm.player_id AND p.active = true
       WHERE t.active = true
       GROUP BY t.id
       ORDER BY t.name`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// GET single team
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*,
        COALESCE(json_agg(
          json_build_object('id',p.id,'name',p.name,'photo_url',p.photo_url,'skill_level',p.skill_level,'role',tm.role)
        ) FILTER (WHERE p.id IS NOT NULL), '[]') AS members
       FROM teams t
       LEFT JOIN team_members tm ON tm.team_id = t.id
       LEFT JOIN players p ON p.id = tm.player_id
       WHERE t.id=$1
       GROUP BY t.id`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Team not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// POST create team
router.post('/', async (req, res, next) => {
  try {
    const { name, color, logo_url } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO teams (name,color,logo_url) VALUES ($1,$2,$3) RETURNING *',
      [name, color || '#3B82F6', logo_url || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// PUT update team
router.put('/:id', async (req, res, next) => {
  try {
    const { name, color, logo_url } = req.body;
    const { rows } = await pool.query(
      'UPDATE teams SET name=$1,color=$2,logo_url=$3 WHERE id=$4 RETURNING *',
      [name, color, logo_url || null, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// DELETE team
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('UPDATE teams SET active=false WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// POST add member to team
router.post('/:id/members', async (req, res, next) => {
  try {
    const { player_id, role } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO team_members (team_id, player_id, role) VALUES ($1,$2,$3) 
       ON CONFLICT (team_id, player_id) DO UPDATE SET role=$3 RETURNING *`,
      [req.params.id, player_id, role || 'player']
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// DELETE remove member from team
router.delete('/:id/members/:player_id', async (req, res, next) => {
  try {
    await pool.query(
      'DELETE FROM team_members WHERE team_id=$1 AND player_id=$2',
      [req.params.id, req.params.player_id]
    );
    res.json({ success: true });
  } catch (e) { next(e); }
});
