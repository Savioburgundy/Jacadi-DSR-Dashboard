import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/db';
import { authenticateJWT, authorizeRole } from '../middleware/auth.middleware';

const router = Router();

// Apply Authentication & Authorization (Admin Only)
router.use(authenticateJWT);
router.use(authorizeRole(['admin']));

// GET /api/users - List all users
router.get('/', async (req, res) => {
    try {
        const query = 'SELECT id, email, full_name, role, active, created_at FROM users ORDER BY created_at DESC';
        const result = await db.query(query);
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// POST /api/users - Create new user
router.post('/', async (req, res) => {
    const { email, password, full_name, role } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        // Check if user exists
        const check = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (check.rows.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const id = uuidv4();
        const hashedPassword = await bcrypt.hash(password, 10);
        const now = new Date().toISOString();

        await db.query(
            'INSERT INTO users (id, email, password_hash, full_name, role, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, email, hashedPassword, full_name, role, 1, now, now]
        );

        res.status(201).json({ message: 'User created successfully', user: { id, email, role } });
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM users WHERE id = ?', [id]);
        res.json({ message: 'User deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

export default router;
