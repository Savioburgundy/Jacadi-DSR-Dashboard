import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from '../config/db';

const router = Router();

// Login Route
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Support login by username OR email
        const result = await db.query('SELECT * FROM users WHERE email = ? OR username = ?', [email, email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password (password column in DB)
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.full_name },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '24h' }
        );

        res.json({ token, user: { id: user.id, username: user.username, role: user.role, name: user.full_name } });
    } catch (error: any) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get Current User
router.get('/me', async (req: any, res) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const result = await db.query('SELECT id, username, role, full_name, email FROM users WHERE id = ?', [req.user.id]);
        res.json(result.rows[0]);
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

export default router;
