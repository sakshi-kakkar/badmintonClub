// ── Courts ────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
module.exports = router;

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM courts ORDER BY name');
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, location, surface_type } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO courts (name,location,surface_type) VALUES ($1,$2,$3) RETURNING *',
      [name, location || null, surface_type || 'synthetic']
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, location, surface_type, is_available } = req.body;
    const { rows } = await pool.query(
      'UPDATE courts SET name=$1,location=$2,surface_type=$3,is_available=$4 WHERE id=$5 RETURNING *',
      [name, location || null, surface_type, is_available, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM courts WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { next(e); }
});
